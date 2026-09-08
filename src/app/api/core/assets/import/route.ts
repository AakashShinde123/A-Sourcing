import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

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
 *   → { imported, updated, skipped, rejected, locationsUnlinked, items: [{ clientAssetId, status, code?, error? }] }
 *
 * Per-row verdicts (mirrors /verify — one bad row never aborts the batch):
 * - rejected  — missing any of clientAssetId / description / category
 * - duplicate — same clientId + clientAssetId already registered AND nothing
 *               in the row differs (idempotent re-upload, creates nothing)
 * - updated   — same clientAssetId already registered but the row carries new
 *               values (location now exists in the tree, serial corrected…):
 *               the register row is patched in place, the ES code is kept
 * - imported  — created as status 'registered' with a generated ES code
 *
 * Location strings are matched (case/trim-insensitive) against the client's
 * location tree; unknown locations stay unlinked rather than guessed — and the
 * response reports how many rows were affected so ops can fix the tree and
 * re-import the same file to link them.
 * A single append-only audit-log entry summarizes the whole batch.
 */
export async function POST(req: NextRequest) {
  // RBAC: register intake is an internal-ops action (clients send files to ops).
  if (!(await requireRole(req, ['ADMIN', 'OPS']))) {
    return NextResponse.json({ error: 'Only operations accounts may import asset registers' }, { status: 403 })
  }
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

  // clientAssetId snapshot — one upload containing the same ID twice is a
  // duplicate on the second occurrence, and known rows diff against the DB so
  // a re-import can PATCH (register re-sync) instead of being silently dropped.
  const existingAssets = await db.asset.findMany({
    where: { clientId },
    select: { id: true, clientAssetId: true, code: true, description: true, category: true, make: true, model: true, serialNumber: true, barcode: true, locationId: true, custodian: true },
  })
  const seenInBatch = new Set(existingAssets.map((a) => a.clientAssetId))
  const existingByKey = new Map(existingAssets.map((a) => [a.clientAssetId, a]))
  // Rows created earlier in THIS batch: a second occurrence of the same ID is
  // a duplicate (first occurrence wins) — never a mid-batch self-update.
  const inBatch = new Set<string>()

  let imported = 0
  let updated = 0
  let skipped = 0
  let rejected = 0
  let locationsUnlinked = 0
  const items: { clientAssetId: string; status: 'imported' | 'updated' | 'duplicate' | 'rejected'; code?: string; error?: string }[] = []

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

    const locationLabel = str(raw.locationLabel)
    const locationId = locationLabel ? locationByKey.get(locationLabel.toLowerCase()) ?? null : null
    if (locationLabel && !locationId) locationsUnlinked++

    // In-batch repeat of an ID we just created → duplicate (first occurrence wins).
    if (inBatch.has(clientAssetId)) {
      skipped++
      items.push({ clientAssetId, status: 'duplicate' })
      continue
    }

    // Existing row → register re-sync: patch changed fields, keep the ES code.
    const prev = existingByKey.get(clientAssetId)
    if (prev) {
      const patch: Record<string, string | null> = {}
      const consider = (k: string, v: string | null) => { if (v !== null && v !== prev[k as keyof typeof prev]) patch[k] = v }
      consider('description', description)
      consider('category', category)
      consider('make', str(raw.make))
      consider('model', str(raw.model))
      consider('serialNumber', str(raw.serialNumber))
      consider('barcode', str(raw.barcode))
      consider('custodian', str(raw.custodian))
      if (locationId && locationId !== prev.locationId) patch.locationId = locationId

      if (Object.keys(patch).length === 0) {
        skipped++
        items.push({ clientAssetId, status: 'duplicate' })
        continue
      }
      try {
        await db.asset.update({ where: { id: prev.id }, data: patch })
        updated++
        items.push({ clientAssetId, status: 'updated', code: prev.code })
      } catch (e) {
        if (isUniqueViolation(e)) {
          rejected++
          items.push({ clientAssetId, status: 'rejected', error: 'update conflicted with another asset — check barcode/serial uniqueness' })
          continue
        }
        throw e
      }
      continue
    }

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
      existingByKey.set(clientAssetId, { ...created, clientAssetId } as typeof prev)
      inBatch.add(clientAssetId)
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
      detail: `Register import · ${client.code} · ${imported} imported · ${updated} updated · ${skipped} duplicates skipped · ${rejected} rejected${locationsUnlinked ? ` · ${locationsUnlinked} unlinked locations` : ''}`,
    },
  })

  return NextResponse.json({ imported, updated, skipped, rejected, locationsUnlinked, items })
}
