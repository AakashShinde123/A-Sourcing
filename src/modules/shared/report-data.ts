/**
 * @es/shared · report-data — builds the full report document from the world
 * bootstrap payload. Pure (no React, no fetch) so it is unit-testable and
 * shared by the Ops and Client report viewers.
 *
 * The Report row in the DB is the versioned envelope (code, version, status);
 * the CONTENT is computed live from audit data at open time — always current,
 * and finalized reports freeze the underlying data via the approval flow.
 */

import type { Asset, ExceptionItem, Report, World } from './types'
import { depreciationFor, rateFor, valuationTotals, type DepreciationLine, type ValuationTotals } from '@/lib/depreciation'

export interface ReportDoc {
  header: {
    code: string; name: string; version: string; status: string
    clientName: string; clientCode: string; contact: string | null
    auditCode: string; auditName: string; auditType: string; financialYear: string
    periodStart: string | null; periodEnd: string | null
    generatedBy: string; generatedAt: string; asOf: string
  }
  summary: {
    inScope: number
    verified: number
    verifiedPct: number
    matchRate: number
    byResult: { result: string; count: number }[]
    openExceptions: number
    totalExceptions: number
    photos: number
    auditorsEngaged: string[]
  }
  valuation: ValuationTotals
  schedule: (DepreciationLine & { asset: Asset })[]
  exceptions: { code: string; type: string; severity: string; status: string; title: string; assetCode: string | null; detectedAt: string }[]
  notes: string[]
}

const RESULT_LABELS: Record<string, string> = {
  matched: 'Matched',
  missing: 'Missing',
  location_mismatch: 'Location mismatch',
  custodian_mismatch: 'Custodian mismatch',
  serial_mismatch: 'Serial mismatch',
  condition_exception: 'Condition exception',
  unregistered: 'Discovered unregistered',
  deferred: 'Deferred',
}

export function buildReportDoc(world: World, report: Report, asOf = new Date()): ReportDoc {
  const audit = world.audits.find((a) => a.id === report.auditId) ?? null
  const client = world.clients.find((c) => c.id === report.clientId) ?? null

  // Assets in this audit = register rows assigned to the audit's field scopes.
  const auditAssignmentIds = new Set(world.assignments.filter((asg) => asg.auditId === report.auditId).map((asg) => asg.id))
  const auditAssets = world.assets.filter((a) => (a.assignmentId ? auditAssignmentIds.has(a.assignmentId) : false))
  const auditVerifications = world.verifications.filter((v) => v.auditId === report.auditId)
  const auditExceptions = world.exceptions.filter((e) => e.auditId === report.auditId)
  const auditPhotos = world.evidence.filter((e) => e.auditId === report.auditId && e.kind === 'photo').length

  const verifiedAssets = new Set(auditVerifications.map((v) => v.assetId).filter(Boolean)).size
  const matched = auditVerifications.filter((v) => v.result === 'matched').length
  const byResultMap = new Map<string, number>()
  for (const v of auditVerifications) byResultMap.set(v.result, (byResultMap.get(v.result) ?? 0) + 1)

  const lines = auditAssets.map((asset) => ({
    asset,
    ...depreciationFor(
      { purchaseCost: asset.purchaseCost, purchaseDate: asset.purchaseDate, category: asset.category, currentValue: asset.currentValue },
      asOf,
    ),
  }))
  const valuation = valuationTotals(lines)

  const auditorIds = new Set(world.assignments.filter((asg) => asg.auditId === report.auditId).map((asg) => asg.auditorId))
  const notes: string[] = []
  if (valuation.assetsMissingData > 0) {
    notes.push(`${valuation.assetsMissingData} asset${valuation.assetsMissingData === 1 ? '' : 's'} in this audit carry no purchase cost/date — they are listed in the register but excluded from the valuation totals. Import the register with Cost & Purchase Date columns to value them.`)
  }
  if (audit && audit.totalInScope > auditAssets.length) {
    notes.push(`The audit declares ${audit.totalInScope} assets in scope; ${auditAssets.length} are linked to field scopes so far — assign the remaining locations to bring them into verification and valuation.`)
  }

  return {
    header: {
      code: report.code,
      name: report.name,
      version: report.versionLabel,
      status: report.status,
      clientName: client?.name ?? '—',
      clientCode: client?.code ?? '—',
      contact: client?.contact ?? null,
      auditCode: audit?.code ?? '—',
      auditName: audit?.name ?? report.name,
      auditType: audit?.type ?? 'Fixed Asset Verification',
      financialYear: audit?.financialYear ?? '—',
      periodStart: audit?.startDate ?? null,
      periodEnd: audit?.endDate ?? null,
      generatedBy: report.generatedBy,
      generatedAt: report.generatedAt,
      asOf: asOf.toISOString(),
    },
    summary: {
      inScope: auditAssets.length,
      verified: verifiedAssets,
      verifiedPct: auditAssets.length ? Math.round((verifiedAssets / auditAssets.length) * 100) : 0,
      matchRate: auditVerifications.length ? Math.round((matched / auditVerifications.length) * 100) : 0,
      byResult: [...byResultMap.entries()]
        .map(([result, count]) => ({ result, count }))
        .sort((a, b) => b.count - a.count),
      openExceptions: auditExceptions.filter((e) => e.status !== 'closed' && e.status !== 'approved').length,
      totalExceptions: auditExceptions.length,
      photos: auditPhotos,
      auditorsEngaged: [...auditorIds].map((id) => world.auditors.find((a) => a.id === id)?.name ?? '—'),
    },
    valuation,
    schedule: lines.sort((a, b) => (a.asset.code < b.asset.code ? -1 : 1)),
    exceptions: auditExceptions
      .slice()
      .sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1))
      .slice(0, 200)
      .map((e: ExceptionItem) => ({
        code: e.code, type: e.type, severity: e.severity, status: e.status,
        title: e.title, assetCode: e.assetCode, detectedAt: e.detectedAt,
      })),
    notes,
  }
}

export { RESULT_LABELS, rateFor }
