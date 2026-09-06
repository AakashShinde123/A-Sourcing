import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/bootstrap — the full demo world in one payload.
 * Aggregates are computed server-side; the SPA consumes this directly.
 */
export async function GET() {
  const [clients, locations, assetsRaw, auditors, auditsRaw, assignments, verifications, exceptions, evidence, reports, approvals, auditLogs] =
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

  const assets = assetsRaw.map((a) => ({
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

  const audits = auditsRaw.map((au) => {
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
    activeAudits: audits.filter((a) => ['in_progress', 'field_complete'].includes(a.status)).length,
    assetsRegistered: assets.length,
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
    clients, locations, assets, auditors, audits, assignments,
    verifications: verifications.slice(0, 400).map((v) => ({
      id: v.id, operationId: v.operationId, auditId: v.auditId, assignmentId: v.assignmentId,
      assetId: v.assetId, assetCode: v.asset?.code ?? null, assetDescription: v.asset?.description ?? null,
      auditorId: v.auditorId, auditorName: v.auditor?.name ?? '—', result: v.result, method: v.method,
      gpsLat: v.gpsLat, gpsLng: v.gpsLng, gpsAccuracy: v.gpsAccuracy, gpsStatus: v.gpsStatus,
      remarks: v.remarks, photos: v.photos, createdOffline: v.createdOffline,
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
    })),
    reports, approvals,
    auditLogs: auditLogs.slice(0, 60),
    stats: globalStats,
  })
}
