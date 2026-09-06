import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** SQLite/unique races (double-click imports) surface as P2002 — degrade gracefully. */
function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

export interface ImportRow {
  clientAssetId?: unknown
  description?: unknown
  category?: unknown
  make?: unknown
  model?: unknown
  serialNumber?: unknown
  barcode?: unknown
  locationLabel?: unknown
  custodian?: unknown
}

const str = (v: unknown): string | null => {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

/**
 * POST /api/core/assets/import — asset-register intake.
 *
 * This is the workflow's front door: audit companies begin every engagement from
 * the CLIENT'S OWN asset register (Excel/CSV export from their ERP), not from
 * data typed into the platform. The Ops Portal parses the file client-side and
 * posts structured rows here; the endpoint is the controlled, auditable intake.
 *
 * Contract: { clientId, rows: ImportRow[] }
 *   → { imported, skipped, rejected, items: [{ clientAssetId, status, code?, error? }] }
 *
 * Per-row verdicts (mirrors /verify — one bad row never aborts the batch):
 * - rejected  — missing any of clientAssetId / description / category
 * - duplicate — same clientId + clientAssetId already registered (idempotent re-upload)
 * - imported  — created as status 'registered' with a generated ES code
 *
 * Location strings are fuzzy-matched (case/trim-insensitive) against the client's
 * location tree; unknown locations stay unlinked rather than guessed.
 * A single append-only audit-log entry summarizes the whole batch.
 */
export async function POST(req: NextRequest) {
  let body: { clientId?: unknown; rows?: unknown }
  try {
    body = (await req.json()) as { clientId?: unknown; rows?: unknown }
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const clientId = str(body?.clientId)
  if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })

  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) return NextResponse.json({ error: 'clientId not found' }, { status: 404 })

  if (body?.rows !== undefined && body?.rows !== null && !Array.isArray(body.rows)) {
    return NextResponse.json({ error: 'rows must be an array' }, { status: 400 })
  }
  const rows = (body?.rows ?? []) as ImportRow[]
  if (rows.length === 0) return NextResponse.json({ error: 'rows must contain at least one asset' }, { status: 400 })
  if (rows.length > 5000) return NextResponse.json({ error: 'rows exceeds the 5000-row batch limit — split the register' }, { status: 413 })

  // Location lookup table for this client — built once, matched per row.
  const locations = await db.location.findMany({
    where: { clientId },
    select: { id: true, name: true },
  })
  const locationByKey = new Map<string, string>()
  for (const l of locations) locationByKey.set(l.name.trim().toLowerCase(), l.id)

  // ES code allocator — read the table once, advance in memory (same pattern as
  // the discovery allocator in /verify so parallel batches can never collide).
  const prefix = `ES-${client.code}-`
  const existing = (await db.asset.findMany({ where: { code: { startsWith: prefix } }, select: { code: true } })).map((a) => a.code)
  let max = 0
  for (const c of existing) {
    const m = new RegExp(`^${prefix}(\\d+)$`).exec(c)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const nextCode = () => `${prefix}${String(++max).padStart(5, '0')}`

  // clientAssetId uniqueness snapshot — one upload containing the same ID twice
  // is a duplicate on the second occurrence, not a new asset.
  const seenInBatch = new Set(
    (await db.asset.findMany({ where: { clientId }, select: { clientAssetId: true } })).map((a) => a.clientAssetId),
  )

  let imported = 0
  let skipped = 0
  let rejected = 0
  const items: { clientAssetId: string; status: 'imported' | 'duplicate' | 'rejected'; code?: string; error?: string }[] = []

  for (const raw of rows) {
    const clientAssetId = str(raw.clientAssetId)
    const description = str(raw.description)
    const category = str(raw.category)

    if (!clientAssetId || !description || !category) {
      rejected++
      items.push({
        clientAssetId: clientAssetId ?? '(missing)',
        status: 'rejected',
        error: 'clientAssetId, description and category are required',
      })
      continue
    }

    if (seenInBatch.has(clientAssetId)) {
      skipped++
      items.push({ clientAssetId, status: 'duplicate', error: 'asset already registered for this client' })
      continue
    }

    const locationId = raw.locationLabel ? locationByKey.get(String(raw.locationLabel).trim().toLowerCase()) ?? null : null

    try {
      const created = await db.asset.create({
        data: {
          clientId,
          code: nextCode(),
          clientAssetId,
          description,
          category,
          make: str(raw.make),
          model: str(raw.model),
          serialNumber: str(raw.serialNumber),
          barcode: str(raw.barcode),
          locationId,
          custodian: str(raw.custodian),
          status: 'registered',
        },
      })
      seenInBatch.add(clientAssetId)
      imported++
      items.push({ clientAssetId, status: 'imported', code: created.code })
    } catch (e) {
      if (isUniqueViolation(e)) {
        // Lost a race (parallel upload of the same register) — honest duplicate.
        skipped++
        items.push({ clientAssetId, status: 'duplicate', error: 'asset already registered for this client' })
        continue
      }
      throw e
    }
  }

  await db.auditLog.create({
    data: {
      actor: 'Meera Rangan',
      role: 'Ops Manager',
      action: 'REGISTER_IMPORTED',
      entity: 'Asset Register',
      entityRef: clientId,
      detail: `Register import · ${client.code} · ${imported} imported · ${skipped} duplicates skipped · ${rejected} rejected`,
    },
  })

  return NextResponse.json({ imported, skipped, rejected, items })
}
