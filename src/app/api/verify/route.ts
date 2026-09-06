import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type SyncOp = {
  operationId: string
  auditId: string
  assignmentId?: string | null
  auditorId: string
  assetId?: string | null
  result: 'matched' | 'missing' | 'location_mismatch' | 'custodian_mismatch' | 'serial_mismatch' | 'condition_exception' | 'deferred' | 'unregistered'
  method?: string
  gpsLat?: number | null
  gpsLng?: number | null
  gpsAccuracy?: number | null
  gpsStatus?: 'captured' | 'unavailable'
  remarks?: string | null
  photos?: string[]
  createdOffline?: boolean
  verifiedAt?: string
  discovery?: { description: string; make?: string; model?: string; serial?: string; condition?: string; locationLabel?: string }
}

const EXCEPTION_TYPES: Record<string, string> = {
  missing: 'missing',
  location_mismatch: 'location_mismatch',
  custodian_mismatch: 'custodian_mismatch',
  serial_mismatch: 'serial_mismatch',
  condition_exception: 'damaged',
}

function severityFor(result: string): string {
  if (result === 'missing') return 'high'
  if (result === 'location_mismatch' || result === 'serial_mismatch') return 'medium'
  return 'medium'
}

/**
 * POST /api/verify — the mobile sync endpoint.
 * Accepts a batch of verification operations. Idempotent by operationId:
 * replays never create duplicate verification events (sync-engine rule).
 * 'unregistered' ops create a discovery asset + exception (floor-to-sheet).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { operations: SyncOp[] }
  const ops = body.operations ?? []
  if (!ops.length) return NextResponse.json({ applied: 0, skipped: 0, items: [] })

  let applied = 0
  let skipped = 0
  const items: { operationId: string; status: 'applied' | 'duplicate'; exceptionCode?: string }[] = []

  for (const op of ops) {
    const existing = await db.verification.findUnique({ where: { operationId: op.operationId } })
    if (existing) {
      skipped++
      items.push({ operationId: op.operationId, status: 'duplicate' })
      continue
    }

    const verifiedAt = op.verifiedAt ? new Date(op.verifiedAt) : new Date()
    const photos = op.photos ?? []

    let discoveryAssetId: string | null = null
    let discoveryExceptionCode: string | undefined

    if (op.result === 'unregistered' && op.discovery) {
      // Floor-to-sheet discovery: create an unregistered asset record
      const client = op.auditId.startsWith('aud_') ? (await db.auditProject.findUnique({ where: { id: op.auditId } }))!.clientId : null
      const count = (await db.asset.count()) + 1
      const code = `ES-DSC-${String(count).padStart(5, '0')}`
      const asset = await db.asset.create({
        data: {
          clientId: client!,
          code,
          clientAssetId: 'UNREGISTERED',
          description: op.discovery.description,
          category: 'Discovered',
          subcategory: 'Unregistered discovery',
          make: op.discovery.make, model: op.discovery.model,
          serialNumber: op.discovery.serial,
          qrCode: `${code}-${Date.now()}`,
          custodian: null,
          status: 'registered',
          condition: op.discovery.condition ?? 'good',
        },
      })
      discoveryAssetId = asset.id
    }

    const assetId = op.assetId ?? discoveryAssetId
    const asset = assetId ? await db.asset.findUnique({ where: { id: assetId } }) : null

    const v = await db.verification.create({
      data: {
        operationId: op.operationId,
        auditId: op.auditId,
        assignmentId: op.assignmentId ?? null,
        assetId: assetId ?? null,
        auditorId: op.auditorId,
        result: op.result,
        method: op.method ?? 'scan',
        gpsLat: op.gpsLat ?? null,
        gpsLng: op.gpsLng ?? null,
        gpsAccuracy: op.gpsAccuracy ?? null,
        gpsStatus: op.gpsStatus ?? 'captured',
        remarks: op.remarks ?? null,
        photos: JSON.stringify(photos),
        createdOffline: op.createdOffline ?? false,
        verifiedAt,
      },
    })

    if (asset) {
      await db.asset.update({
        where: { id: asset.id },
        data: {
          lastVerifiedAt: verifiedAt,
          ...(op.result === 'missing' ? { status: 'missing' } : {}),
          ...(op.result === 'unregistered' ? { status: 'registered' } : {}),
        },
      })
    }

    for (const seed of photos) {
      await db.evidence.create({
        data: {
          verificationId: v.id, auditId: op.auditId, assetId: assetId, clientId: asset?.clientId ?? (await db.auditProject.findUnique({ where: { id: op.auditId } }))!.clientId,
          kind: 'photo', label: 'Field photo', colorSeed: seed,
          capturedBy: (await db.auditor.findUnique({ where: { id: op.auditorId } }))?.name ?? 'Auditor',
          gpsLat: op.gpsLat ?? null, gpsLng: op.gpsLng ?? null, capturedAt: verifiedAt,
        },
      })
    }

    let exceptionCode: string | undefined
    if (op.result === 'unregistered') {
      const n = (await db.exception.count()) + 1
      exceptionCode = `EX-2026-${String(n).padStart(4, '0')}`
      discoveryExceptionCode = exceptionCode
      await db.exception.create({
        data: {
          code: exceptionCode,
          clientId: asset?.clientId ?? (await db.auditProject.findUnique({ where: { id: op.auditId } }))!.clientId,
          auditId: op.auditId, assetId: assetId,
          type: 'unregistered', severity: 'medium', status: 'open',
          title: `Unregistered asset discovered — ${asset?.code ?? 'floor find'}`,
          description: op.discovery?.description ?? 'Physical asset found without register entry.',
          locationLabel: op.discovery?.locationLabel ?? null,
          detectedBy: (await db.auditor.findUnique({ where: { id: op.auditorId } }))?.name ?? 'Auditor',
          detail: JSON.stringify({ ...(op.discovery ?? {}), photos }),
        },
      })
    } else if (EXCEPTION_TYPES[op.result]) {
      const n = (await db.exception.count()) + 1
      exceptionCode = `EX-2026-${String(n).padStart(4, '0')}`
      await db.exception.create({
        data: {
          code: exceptionCode,
          clientId: asset!.clientId,
          auditId: op.auditId, assetId: assetId,
          type: EXCEPTION_TYPES[op.result], severity: severityFor(op.result), status: 'open',
          title: `${op.result.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} — ${asset?.code}`,
          description: op.remarks ?? 'Detected during physical verification.',
          locationLabel: asset?.locationId ? (await db.location.findUnique({ where: { id: asset.locationId } }))?.name : null,
          detectedBy: (await db.auditor.findUnique({ where: { id: op.auditorId } }))?.name ?? 'Auditor',
        },
      })
    }

    await db.auditLog.create({
      data: {
        actor: (await db.auditor.findUnique({ where: { id: op.auditorId } }))?.name ?? 'Auditor',
        role: 'Auditor',
        action: op.createdOffline ? 'SYNC_APPLIED' : 'VERIFICATION_RECORDED',
        entity: op.result === 'unregistered' ? 'Discovery' : 'Verification',
        entityRef: asset?.code ?? op.operationId,
        detail: op.result === 'matched' ? 'Asset verified & matched' : `Result: ${op.result}${exceptionCode ? ` · Exception ${exceptionCode} opened` : ''}`,
      },
    })

    // move assignment forward
    if (op.assignmentId) {
      const asg = await db.auditAssignment.findUnique({ where: { id: op.assignmentId }, include: { _count: { select: { assets: true } } } })
      if (asg) {
        const done = await db.verification.count({ where: { assignmentId: asg.id, assetId: { not: null } } })
        await db.auditAssignment.update({
          where: { id: asg.id },
          data: { status: done >= asg._count.assets ? 'field_complete' : 'in_progress' },
        })
      }
    }

    applied++
    items.push({ operationId: op.operationId, status: 'applied', exceptionCode })
  }

  return NextResponse.json({ applied, skipped, items })
}
