import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, type SessionUser } from '@/lib/auth'
import { ensureEvidenceImageColumn } from '@/lib/evidence-schema'

export const dynamic = 'force-dynamic'

/** Photo slot markers → count. Legacy rows kept raw data URLs here; they are
 *  never shipped to clients — only their count (images live on Evidence.image). */
function photoCountOf(json: string | null): number {
  try {
    const a = JSON.parse(json ?? '[]')
    return Array.isArray(a) ? a.length : 0
  } catch { return 0 }
}

/**
 * GET /api/core/bootstrap — the platform world in one payload.
 * Aggregates are computed server-side; the SPA consumes this directly.
 *
 * DATA SCOPING (server-side, not just UI):
 *  - ADMIN / OPS  → the full world (internal team).
 *  - CLIENT       → strictly their own client: their locations, assets,
 *                   audits, verifications, exceptions, evidence, reports,
 *                   approvals and only auditors engaged on their audits.
 *                   Global audit logs and other clients never leave the API.
 *  - AUDITOR      → only their assignments and the data those assignments
 *                   need (their audits' assets, their own verifications).
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  // Evidence queries SELECT the photo column — guarantee it exists first
  // (self-migrating deployments; see evidence-schema.ts).
  await ensureEvidenceImageColumn()

  const [clientsRaw, locationsRaw, assetsRaw, auditorsRaw, auditsRaw, assignmentsRaw, verificationsRaw, exceptionsRaw, evidenceRaw, reportsRaw, approvalsRaw, auditLogsRaw] =
    await Promise.all([
      db.client.findMany({ include: { users: true }, orderBy: { name: 'asc' } }),
      db.location.findMany({ orderBy: { code: 'asc' } }),
      db.asset.findMany({ include: { location: true, assignment: true }, orderBy: { code: 'asc' } }),
      db.auditor.findMany({ orderBy: { name: 'asc' } }),
      db.auditProject.findMany({ orderBy: { code: 'desc' } }),
      db.auditAssignment.findMany({ include: { auditor: true, location: true } }),
      db.verification.findMany({ include: { auditor: true, asset: true }, orderBy: { verifiedAt: 'desc' } }),
      db.exception.findMany({ include: { asset: true, audit: true }, orderBy: { detectedAt: 'desc' } }),
      db.evidence.findMany({ include: { asset: true }, orderBy: { capturedAt: 'desc' } }),
      db.report.findMany({ include: { audit: true }, orderBy: { generatedAt: 'desc' } }),
      db.approval.findMany({ include: { audit: true }, orderBy: { at: 'desc' } }),
      db.auditLog.findMany({ orderBy: { at: 'desc' } }),
    ])

  const isTeam = user.role === 'ADMIN' || user.role === 'OPS'
  const isClient = user.role === 'CLIENT'

  // ── Scope resolution ────────────────────────────────────────────
  let clientScope: string[] | null = null        // null = all clients
  let auditScope: string[] | null = null         // null = all audits
  let auditorScope: string[] | null = null       // null = all auditors (team)
  let verificationsScope: ((v: (typeof verificationsRaw)[number]) => boolean) | null = null
  let auditLogsScope: (typeof auditLogsRaw) | null = auditLogsRaw

  if (isClient) {
    if (!user.clientId) return NextResponse.json({ error: 'Account is not linked to a client' }, { status: 403 })
    clientScope = [user.clientId]
    const myAuditIds = auditsRaw.filter((a) => a.clientId === user.clientId).map((a) => a.id)
    auditScope = myAuditIds
    const engagedAuditorIds = new Set(
      assignmentsRaw.filter((as) => myAuditIds.includes(as.auditId)).map((as) => as.auditorId),
    )
    auditorScope = [...engagedAuditorIds]
    verificationsScope = (v) => myAuditIds.includes(v.auditId)
    auditLogsScope = [] // the immutable ops trail is internal — never exposed to client viewers
  } else if (user.role === 'AUDITOR') {
    const mine = user.auditorId
      ? assignmentsRaw.filter((as) => as.auditorId === user.auditorId)
      : []
    const myAuditIds = [...new Set(mine.map((as) => as.auditId))]
    auditScope = myAuditIds
    clientScope = [...new Set(auditsRaw.filter((a) => myAuditIds.includes(a.id)).map((a) => a.clientId))]
    auditorScope = user.auditorId ? [user.auditorId] : []
    verificationsScope = (v) => v.auditorId === user.auditorId
    auditLogsScope = []
  }

  const inClient = (cid: string) => !clientScope || clientScope.includes(cid)
  const inAudit = (aid: string | null) => !auditScope || (aid !== null && auditScope.includes(aid))
  const inAuditor = (aid: string | null) => !auditorScope || (aid !== null && auditorScope.includes(aid))

  const clients = clientsRaw.filter((c) => inClient(c.id))
  const locations = locationsRaw.filter((l) => inClient(l.clientId))
  const assets = assetsRaw.filter((a) => inClient(a.clientId))
  const auditors = auditorsRaw.filter((a) => inAuditor(a.id))
  const audits = auditsRaw.filter((a) => inAudit(a.id))
  const assignments = assignmentsRaw.filter((as) => inAudit(as.auditId) && inAuditor(as.auditorId))
  const verifications = verificationsRaw.filter(
    (v) => (verificationsScope ? verificationsScope(v) : true) && inAudit(v.auditId),
  )
  const exceptions = exceptionsRaw.filter((e) => inAudit(e.auditId))
  const evidence = evidenceRaw.filter((ev) => inAudit(ev.auditId))
  const reports = reportsRaw.filter((r) => inAudit(r.auditId))
  const approvals = approvalsRaw.filter((ap) => inAudit(ap.auditId))
  const auditLogs = auditLogsScope ?? []

  const locationPath = (locId?: string | null): string => {
    if (!locId) return '—'
    const parts: string[] = []
    let cur = locations.find((l) => l.id === locId)
    let guard = 0
    while (cur && guard++ < 10) {
      parts.unshift(cur.name)
      cur = cur.parentId ? locations.find((l) => l.id === cur!.parentId) : undefined
    }
    return parts.join(' · ')
  }

  const mappedAssets = assets.map((a) => ({
    id: a.id,
    clientId: a.clientId,
    code: a.code,
    clientAssetId: a.clientAssetId,
    description: a.description,
    category: a.category,
    subcategory: a.subcategory,
    make: a.make,
    model: a.model,
    serialNumber: a.serialNumber,
    barcode: a.barcode,
    qrCode: a.qrCode,
    locationId: a.locationId,
    locationLabel: a.location?.name ?? '—',
    locationPath: locationPath(a.locationId),
    custodian: a.custodian,
    status: a.status,
    condition: a.condition,
    purchaseDate: a.purchaseDate,
    purchaseCost: a.purchaseCost,
    currentValue: a.currentValue,
    lastVerifiedAt: a.lastVerifiedAt,
    assignmentId: a.assignmentId,
    createdAt: a.createdAt,
  }))

  const mappedAudits = audits.map((au) => {
    const vs = verifications.filter((v) => v.auditId === au.id && v.assetId)
    const verifiedAssets = new Set(vs.map((v) => v.assetId)).size
    const byResult = vs.reduce<Record<string, number>>((m, v) => { m[v.result] = (m[v.result] ?? 0) + 1; return m }, {})
    const exs = exceptions.filter((e) => e.auditId === au.id)
    const openEx = exs.filter((e) => !['approved', 'closed'].includes(e.status)).length
    return {
      id: au.id, clientId: au.clientId, code: au.code, name: au.name, type: au.type, status: au.status,
      financialYear: au.financialYear, startDate: au.startDate, endDate: au.endDate,
      totalInScope: au.totalInScope, locationsLabel: au.locationsLabel, evidenceRequired: au.evidenceRequired,
      verifiedAssets, matchCount: byResult['matched'] ?? 0, byResult,
      openExceptions: openEx, totalExceptions: exs.length,
      progress: au.totalInScope ? Math.round((verifiedAssets / au.totalInScope) * 100) : 0,
    }
  })

  const globalStats = {
    activeAudits: mappedAudits.filter((a) => ['in_progress', 'field_complete'].includes(a.status)).length,
    assetsRegistered: mappedAssets.length,
    assetsVerified: new Set(verifications.filter((v) => v.assetId).map((v) => v.assetId)).size,
    openExceptions: exceptions.filter((e) => !['approved', 'closed'].includes(e.status)).length,
    inFieldAuditors: auditors.filter((a) => a.status === 'in_field').length,
    matchRate: (() => {
      const total = verifications.filter((v) => v.assetId).length
      return total ? Math.round(((verifications.filter((v) => v.result === 'matched').length) / total) * 1000) / 10 : 0
    })(),
    verificationTrend: (() => {
      const days: { date: string; label: string; matched: number; exceptions: number }[] = []
      for (let i = 13; i >= 0; i--) {
        const d = new Date('2026-09-06T00:00:00+05:30')
        d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0, 10)
        const dayVs = verifications.filter((v) => v.verifiedAt.toISOString().slice(0, 10) === key)
        days.push({
          date: key, label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          matched: dayVs.filter((v) => v.result === 'matched').length,
          exceptions: dayVs.filter((v) => v.result !== 'matched' && v.result !== 'deferred').length,
        })
      }
      return days
    })(),
  }

  return NextResponse.json({
    clients, locations, assets: mappedAssets, auditors, audits: mappedAudits, assignments,
    verifications: verifications.slice(0, 400).map((v) => ({
      id: v.id, operationId: v.operationId, auditId: v.auditId, assignmentId: v.assignmentId,
      assetId: v.assetId, assetCode: v.asset?.code ?? null, assetDescription: v.asset?.description ?? null,
      auditorId: v.auditorId, auditorName: v.auditor?.name ?? '—', result: v.result, method: v.method,
      gpsLat: v.gpsLat, gpsLng: v.gpsLng, gpsAccuracy: v.gpsAccuracy, gpsStatus: v.gpsStatus,
      remarks: v.remarks,
      photoCount: photoCountOf(v.photos), createdOffline: v.createdOffline,
      verifiedAt: v.verifiedAt, syncedAt: v.syncedAt,
    })),
    exceptions: exceptions.map((e) => ({
      id: e.id, code: e.code, clientId: e.clientId, auditId: e.auditId, assetId: e.assetId,
      assetCode: e.asset?.code ?? null, assetDescription: e.asset?.description ?? null,
      type: e.type, severity: e.severity, status: e.status, title: e.title, description: e.description,
      locationLabel: e.locationLabel, detectedBy: e.detectedBy, detectedAt: e.detectedAt,
      assignedTo: e.assignedTo, resolutionNote: e.resolutionNote, resolvedAt: e.resolvedAt, detail: e.detail,
    })),
    evidence: evidence.map((ev) => ({
      id: ev.id, verificationId: ev.verificationId, auditId: ev.auditId, assetId: ev.assetId,
      assetCode: ev.asset?.code ?? null, clientId: ev.clientId, kind: ev.kind, label: ev.label,
      colorSeed: ev.colorSeed, capturedBy: ev.capturedBy, gpsLat: ev.gpsLat, gpsLng: ev.gpsLng, capturedAt: ev.capturedAt,
      hasImage: Boolean(ev.image) || ev.colorSeed.startsWith('data:image/'),
    })),
    reports, approvals,
    auditLogs: auditLogs.slice(0, 60),
    stats: globalStats,
  })
}
