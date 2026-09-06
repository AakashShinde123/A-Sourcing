import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  validateSyncOp, severityFor, EXCEPTION_TYPES, nextExceptionCode,
} from '@/lib/core-logic'

export const dynamic = 'force-dynamic'

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
  const items: { operationId: string; status: 'applied' | 'duplicate' | 'rejected'; error?: string; exceptionCode?: string }[] = []

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
          photos: JSON.stringify(op.photos),
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

    for (const seed of op.photos) {
      await db.evidence.create({
        data: {
          verificationId: v.id, auditId: op.auditId, assetId, clientId: audit.clientId,
          kind: 'photo', label: 'Field photo', colorSeed: seed,
          capturedBy: auditor.name,
          gpsLat: op.gpsLat, gpsLng: op.gpsLng, capturedAt: verifiedAt,
        },
      })
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
        detail: JSON.stringify({ ...(op.discovery ?? {}), photos: op.photos }),
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
    items.push({ operationId: op.operationId, status: 'applied', exceptionCode: discoveryExceptionCode ?? exceptionCode })
  }

  return NextResponse.json({ applied, skipped, rejected, items })
}
