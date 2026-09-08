import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  validateSyncOp, severityFor, EXCEPTION_TYPES, nextExceptionCode,
} from '@/lib/core-logic'
import { requireRole } from '@/lib/auth'
import { ensureEvidenceImageColumn } from '@/lib/evidence-schema'

export const dynamic = 'force-dynamic'

/** Deterministic accent per evidence row (palette mirrors shared/format seedColor). */
const PHOTO_SEEDS = ['emerald', 'teal', 'amber', 'rose', 'orange'] as const
function seedFor(operationId: string, index: number): string {
  let h = 0
  for (let i = 0; i < operationId.length; i++) h = (h * 31 + operationId.charCodeAt(i)) >>> 0
  return PHOTO_SEEDS[(h + index) % PHOTO_SEEDS.length]
}

/** SQLite/unique races (parallel mobile retries) surface as P2002 — degrade gracefully. */
function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

/**
 * POST /api/core/verify — the mobile sync endpoint.
 *
 * Contract: { operations: SyncOp[] } → { applied, skipped, rejected, items[] }
 * - Idempotent by operationId: replays are reported as `skipped` duplicates.
 * - Per-operation validation: an invalid op is REPORTED (`rejected`) without
 *   aborting the rest of the batch — a partial sync can never 500 or half-die.
 * - 'unregistered' ops create a discovery asset + exception (floor-to-sheet).
 */
export async function POST(req: NextRequest) {
  // RBAC: field verifications come from the field team (and ops supervisors).
  // AUDITOR sessions have their auditorId FORCED from the session — a signed-in
  // field user can never attribute work to a colleague by editing the payload.
  const session = await requireRole(req, ['ADMIN', 'OPS', 'AUDITOR'])
  if (!session) return NextResponse.json({ error: 'Only field team and operations accounts may submit verifications' }, { status: 403 })
  if (session.role === 'AUDITOR' && !session.auditorId) {
    return NextResponse.json({ error: 'Auditor account is not linked to a field team member' }, { status: 403 })
  }

  let body: { operations?: unknown }
  try {
    body = (await req.json()) as { operations?: unknown }
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const raw = body?.operations
  if (raw !== undefined && raw !== null && !Array.isArray(raw)) {
    return NextResponse.json({ error: 'operations must be an array' }, { status: 400 })
  }
  const ops = (raw ?? []) as unknown[]

  let applied = 0
  let skipped = 0
  let rejected = 0
  const items: { operationId: string; status: 'applied' | 'duplicate' | 'rejected'; error?: string; exceptionCode?: string; assetCode?: string; assetId?: string }[] = []

  // Code generators read the table once per batch and advance in memory —
  // two discoveries/exceptions inside one batch can never collide.
  const exceptionCodes = (await db.exception.findMany({ select: { code: true } })).map((e) => e.code)
  const dscCodes = (await db.asset.findMany({ where: { code: { startsWith: 'ES-DSC-' } }, select: { code: true } })).map((a) => a.code)
  const nextDsc = () => {
    let max = 0
    for (const c of dscCodes) {
      const m = /^ES-DSC-(\d+)$/.exec(c)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    const code = `ES-DSC-${String(max + 1).padStart(5, '0')}`
    dscCodes.push(code)
    return code
  }

  for (const rawOp of ops) {
    const verdict = validateSyncOp(rawOp)
    if (!verdict.ok) {
      rejected++
      items.push({ operationId: (rawOp as { operationId?: string })?.operationId ?? '(missing)', status: 'rejected', error: verdict.error })
      continue
    }
    const op = verdict.value
    if (session.role === 'AUDITOR') op.auditorId = session.auditorId! // identity comes from the session, never the payload

    // Reference integrity: audit, auditor and asset must exist before we write.
    const audit = await db.auditProject.findUnique({ where: { id: op.auditId } })
    if (!audit) {
      rejected++
      items.push({ operationId: op.operationId, status: 'rejected', error: 'auditId not found' })
      continue
    }
    const auditor = await db.auditor.findUnique({ where: { id: op.auditorId } })
    if (!auditor) {
      rejected++
      items.push({ operationId: op.operationId, status: 'rejected', error: 'auditorId not found' })
      continue
    }

    // Idempotency gate — after validation so replays of invalid ops stay rejected.
    if (await db.verification.findUnique({ where: { operationId: op.operationId } })) {
      skipped++
      items.push({ operationId: op.operationId, status: 'duplicate' })
      continue
    }

    let assetId: string | null = op.assetId
    let asset = assetId ? await db.asset.findUnique({ where: { id: assetId } }) : null
    if (op.assetId && !asset) {
      rejected++
      items.push({ operationId: op.operationId, status: 'rejected', error: 'assetId not found' })
      continue
    }

    let discoveryExceptionCode: string | undefined
    let discoveryAsset: typeof asset = null

    if (op.result === 'unregistered') {
      // Floor-to-sheet discovery: create an unregistered asset record.
      // Code allocation races with parallel batches are retried with a fresh code.
      let createdAsset: typeof asset = null
      for (let attempt = 0; attempt < 3 && !createdAsset; attempt++) {
        try {
          createdAsset = await db.asset.create({
            data: {
              clientId: audit.clientId,
              code: nextDsc(),
              clientAssetId: 'UNREGISTERED',
              description: op.discovery!.description,
              category: 'Discovered',
              subcategory: 'Unregistered discovery',
              make: op.discovery!.make, model: op.discovery!.model,
              serialNumber: op.discovery!.serial,
              qrCode: `${Date.now().toString(36)}-${op.operationId.slice(-12)}`,
              custodian: null,
              status: 'registered',
              condition: op.discovery!.condition ?? 'good',
            },
          })
        } catch (e) {
          if (!isUniqueViolation(e)) throw e
        }
      }
      if (!createdAsset) {
        rejected++
        items.push({ operationId: op.operationId, status: 'rejected', error: 'could not allocate discovery asset code — retry the sync' })
        continue
      }
      assetId = createdAsset.id
      discoveryAsset = createdAsset
    }
    const effectiveAsset = op.result === 'unregistered' ? await db.asset.findUnique({ where: { id: assetId! } }) : asset

    const verifiedAt = op.verifiedAt ? new Date(op.verifiedAt) : new Date()
    let v
    try {
      v = await db.verification.create({
        data: {
          operationId: op.operationId,
          auditId: op.auditId,
          assignmentId: op.assignmentId,
          assetId,
          auditorId: op.auditorId,
          result: op.result,
          method: op.method,
          gpsLat: op.gpsLat,
          gpsLng: op.gpsLng,
          gpsAccuracy: op.gpsAccuracy,
          gpsStatus: op.gpsStatus,
          remarks: op.remarks,
          // Slot markers only — the real JPEG payloads live on Evidence.image.
          photos: JSON.stringify(op.photos.map((_, i) => `photo-${i + 1}`)),
          createdOffline: op.createdOffline,
          verifiedAt,
        },
      })
    } catch (e) {
      // Lost a race against a parallel retry of the same operationId — count it
      // as a duplicate instead of failing the batch (idempotency under concurrency).
      if (isUniqueViolation(e)) {
        skipped++
        items.push({ operationId: op.operationId, status: 'duplicate' })
        continue
      }
      throw e
    }

    if (effectiveAsset) {
      await db.asset.update({
        where: { id: effectiveAsset.id },
        data: {
          lastVerifiedAt: verifiedAt,
          ...(op.result === 'missing' ? { status: 'missing' } : {}),
        },
      })
    }

    // Real evidence: each captured photo's JPEG data URL is stored verbatim and
    // streamed back to the portals via /api/core/evidence/[id]/image.
    // An evidence problem must NEVER fail the verification (the field result is
    // the source of truth): try image column → legacy colorSeed channel → bare row.
    if (op.photos.length) {
      const imageOk = await ensureEvidenceImageColumn()
      for (let i = 0; i < op.photos.length; i++) {
        const payload = op.photos[i]
        const base = {
          verificationId: v.id, auditId: op.auditId, assetId, clientId: audit.clientId,
          kind: 'photo', label: op.photos.length > 1 ? `Field photo ${i + 1}` : 'Field photo',
          capturedBy: auditor.name,
          gpsLat: op.gpsLat, gpsLng: op.gpsLng, capturedAt: verifiedAt,
        }
        try {
          await db.evidence.create({
            data: {
              ...base,
              ...(imageOk ? { image: payload } : { colorSeed: payload }), // legacy channel renders identically
              ...(imageOk ? { colorSeed: seedFor(op.operationId, i) } : {}),
            },
          })
        } catch {
          // Column vanished mid-flight or unknown DB issue — retry through the
          // legacy colorSeed channel; final resort: plain row (photo skipped).
          try {
            await db.evidence.create({ data: { ...base, colorSeed: payload } })
          } catch {
            await db.evidence.create({ data: { ...base, colorSeed: 'emerald' } }).catch(() => {})
          }
        }
      }
    }

    let exceptionCode: string | undefined
    const createException = async (data: Omit<Prisma.ExceptionUncheckedCreateInput, 'code'>): Promise<string> => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = nextExceptionCode([...exceptionCodes])
        try {
          await db.exception.create({ data: { ...data, code } })
          exceptionCodes.push(code)
          return code
        } catch (e) {
          if (!isUniqueViolation(e)) throw e
          // refresh the snapshot and retry with a new code
          const fresh = (await db.exception.findMany({ select: { code: true } })).map((x) => x.code)
          exceptionCodes.length = 0
          exceptionCodes.push(...fresh)
        }
      }
      throw new Error('could not allocate exception code')
    }

    if (op.result === 'unregistered') {
      exceptionCode = await createException({
        clientId: audit.clientId,
        auditId: op.auditId,
        assetId: assetId ?? undefined,
        type: 'unregistered', severity: 'medium', status: 'open',
        title: `Unregistered asset discovered — ${effectiveAsset?.code ?? 'floor find'}`,
        description: op.discovery!.description,
        locationLabel: op.discovery!.locationLabel ?? null,
        detectedBy: auditor.name,
        detail: JSON.stringify({ ...(op.discovery ?? {}), photoCount: op.photos.length }),
      })
      discoveryExceptionCode = exceptionCode
    } else if (EXCEPTION_TYPES[op.result]) {
      exceptionCode = await createException({
        clientId: audit.clientId,
        auditId: op.auditId,
        assetId: assetId ?? undefined,
        type: EXCEPTION_TYPES[op.result]!, severity: severityFor(op.result), status: 'open',
        title: `${op.result.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} — ${effectiveAsset?.code ?? op.assetId ?? 'unknown asset'}`,
        description: op.remarks ?? 'Detected during physical verification.',
        locationLabel: effectiveAsset?.locationId ? (await db.location.findUnique({ where: { id: effectiveAsset.locationId } }))?.name : null,
        detectedBy: auditor.name,
      })
    }

    await db.auditLog.create({
      data: {
        actor: auditor.name,
        role: 'Auditor',
        action: op.createdOffline ? 'SYNC_APPLIED' : 'VERIFICATION_RECORDED',
        entity: op.result === 'unregistered' ? 'Discovery' : 'Verification',
        entityRef: effectiveAsset?.code ?? op.operationId,
        detail: op.result === 'matched' ? 'Asset verified & matched' : `Result: ${op.result}${exceptionCode ? ` · Exception ${exceptionCode} opened` : ''}`,
      },
    })

    // Move the assignment forward — distinct assets, not raw rows.
    if (op.assignmentId) {
      const asg = await db.auditAssignment.findUnique({ where: { id: op.assignmentId }, include: { _count: { select: { assets: true } } } })
      if (asg) {
        const done = (await db.verification.findMany({
          where: { assignmentId: asg.id, assetId: { not: null } },
          distinct: ['assetId'],
          select: { id: true },
        })).length
        await db.auditAssignment.update({
          where: { id: asg.id },
          data: { status: done >= asg._count.assets ? 'field_complete' : 'in_progress' },
        })
      }
    }

    applied++
    items.push({
      operationId: op.operationId, status: 'applied',
      exceptionCode: discoveryExceptionCode ?? exceptionCode,
      // Discoveries echo the freshly allocated register identity so the field
      // app can show + print the QR tag for the new asset immediately.
      ...(discoveryAsset ? { assetCode: discoveryAsset.code, assetId: discoveryAsset.id } : {}),
    })
  }

  return NextResponse.json({ applied, skipped, rejected, items })
}
