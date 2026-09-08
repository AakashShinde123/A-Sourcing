/**
 * @es/core-logic — pure domain rules for the Core API.
 *
 * Extracted from the route handlers so they can be unit-tested in isolation
 * (white-box) and shared by every deployable service that needs to interpret
 * the same contract. No I/O, no Prisma, no Next — pure functions and constants.
 */

// ─── Verification sync engine ────────────────────────────────────────

/** Every verification result the mobile contract allows. */
export const VERIFICATION_RESULTS = [
  'matched',
  'missing',
  'location_mismatch',
  'custodian_mismatch',
  'serial_mismatch',
  'condition_exception',
  'deferred',
  'unregistered',
] as const
export type VerificationResult = (typeof VERIFICATION_RESULTS)[number]

/** Verification result → Exception.type (results absent from this map open no exception). */
export const EXCEPTION_TYPES: Partial<Record<VerificationResult, string>> = {
  missing: 'missing',
  location_mismatch: 'location_mismatch',
  custodian_mismatch: 'custodian_mismatch',
  serial_mismatch: 'serial_mismatch',
  condition_exception: 'damaged',
}

/** Severity policy for auto-opened exceptions. */
export function severityFor(result: string): 'high' | 'medium' | 'low' {
  if (result === 'missing') return 'high'
  if (result === 'location_mismatch' || result === 'serial_mismatch' || result === 'custodian_mismatch') return 'medium'
  if (result === 'condition_exception') return 'low'
  return 'medium'
}

/** Results that reference a specific registered asset — they are meaningless without assetId. */
export const REQUIRES_ASSET: ReadonlySet<string> = new Set([
  'matched', 'missing', 'location_mismatch', 'custodian_mismatch', 'serial_mismatch', 'condition_exception',
])

/** A sync op is only as valid as its references — every required key must be present. */
export function validateSyncOp(op: unknown): { ok: true; value: SyncOpNormalized } | { ok: false; error: string } {
  if (typeof op !== 'object' || op === null) return { ok: false, error: 'operation must be an object' }
  const o = op as Record<string, unknown>
  if (typeof o.operationId !== 'string' || !o.operationId.trim()) return { ok: false, error: 'operationId is required' }
  if (typeof o.auditId !== 'string' || !o.auditId.trim()) return { ok: false, error: 'auditId is required' }
  if (typeof o.auditorId !== 'string' || !o.auditorId.trim()) return { ok: false, error: 'auditorId is required' }
  if (typeof o.result !== 'string' || !VERIFICATION_RESULTS.includes(o.result as VerificationResult)) {
    return { ok: false, error: `result must be one of: ${VERIFICATION_RESULTS.join(', ')}` }
  }
  if (REQUIRES_ASSET.has(o.result) && typeof o.assetId !== 'string') {
    return { ok: false, error: `result '${o.result}' requires an assetId` }
  }
  if (o.result === 'unregistered') {
    const d = o.discovery
    if (typeof d !== 'object' || d === null || typeof (d as Record<string, unknown>).description !== 'string' || !(d as Record<string, unknown>).description) {
      return { ok: false, error: 'unregistered results require discovery.description' }
    }
  }
  if (o.photos !== undefined && !Array.isArray(o.photos)) return { ok: false, error: 'photos must be an array' }
  return {
    ok: true,
    value: {
      operationId: o.operationId,
      auditId: o.auditId,
      assignmentId: typeof o.assignmentId === 'string' ? o.assignmentId : null,
      auditorId: o.auditorId,
      assetId: typeof o.assetId === 'string' ? o.assetId : null,
      result: o.result as VerificationResult,
      method: typeof o.method === 'string' ? o.method : 'scan',
      remarks: typeof o.remarks === 'string' ? o.remarks : null,
      photos: Array.isArray(o.photos) ? (o.photos as unknown[]).filter((p): p is string => typeof p === 'string') : [],
      createdOffline: o.createdOffline === true,
      discovery: (typeof o.discovery === 'object' && o.discovery !== null) ? (o.discovery as SyncOpNormalized['discovery']) : undefined,
      verifiedAt: typeof o.verifiedAt === 'string' ? o.verifiedAt : undefined,
      gpsLat: typeof o.gpsLat === 'number' ? o.gpsLat : null,
      gpsLng: typeof o.gpsLng === 'number' ? o.gpsLng : null,
      gpsAccuracy: typeof o.gpsAccuracy === 'number' ? o.gpsAccuracy : null,
      gpsStatus: o.gpsStatus === 'unavailable' ? 'unavailable' : 'captured',
    },
  }
}

export interface SyncOpNormalized {
  operationId: string
  auditId: string
  assignmentId: string | null
  auditorId: string
  assetId: string | null
  result: VerificationResult
  method: string
  remarks: string | null
  photos: string[]
  createdOffline: boolean
  discovery?: { description: string; make?: string; model?: string; serial?: string; condition?: string; locationLabel?: string }
  verifiedAt?: string
  gpsLat: number | null
  gpsLng: number | null
  gpsAccuracy: number | null
  gpsStatus: 'captured' | 'unavailable'
}

/** Human-readable ES-DSC-#### code for discovered assets. */
export function discoveryAssetCode(existingCount: number): string {
  return `ES-DSC-${String(Math.max(0, existingCount) + 1).padStart(5, '0')}`
}

/** EX-YYYY-#### code; keeps increasing even after deletes by scanning the max suffix. */
export function nextExceptionCode(existingCodes: string[], year = 2026): string {
  let max = 0
  for (const c of existingCodes) {
    const m = /^EX-\d{4}-(\d+)$/.exec(c)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `EX-${year}-${String(max + 1).padStart(4, '0')}`
}

// ─── Exception lifecycle state machine ───────────────────────────────

/**
 * The 7-stage lifecycle the Ops UI drives:
 * Open → Assigned → Investigating → Resolved → Reviewer Review → Approved → Closed.
 * Each action declares the state it must come FROM and the state it moves TO —
 * no stage skipping, no backwards moves on a closed/approved exception.
 */
export const EXCEPTION_LIFECYCLE: Record<string, { from: string; to: string }> = {
  assign: { from: 'open', to: 'assigned' },
  investigate: { from: 'assigned', to: 'investigating' },
  resolve: { from: 'investigating', to: 'resolved' },
  review: { from: 'resolved', to: 'reviewer_review' },
  approve: { from: 'reviewer_review', to: 'approved' },
  close: { from: 'approved', to: 'closed' },
}

/** action → required source state (derived view used by the guard). */
export const LEGAL_EXCEPTION_TRANSITIONS: Record<string, string> = Object.fromEntries(
  Object.entries(EXCEPTION_LIFECYCLE).map(([action, t]) => [action, t.from]),
)

export type ExceptionAction = keyof typeof EXCEPTION_LIFECYCLE
export const EXCEPTION_ACTIONS = Object.keys(EXCEPTION_LIFECYCLE)

export function isLegalTransition(action: string, currentStatus: string): boolean {
  const t = EXCEPTION_LIFECYCLE[action]
  return t !== undefined && t.from === currentStatus
}

// ─── Report versioning ───────────────────────────────────────────────

export interface ReportVersionInfo {
  versionLabel: string
  summary?: string | null // JSON payload that may carry { version: n }
}

/**
 * Next version label is max(ever-assigned numeric version) + 1, so the
 * sequence is unique and monotonic even after a report is frozen as 'Final'
 * (which overwrites its label) — v1, v2, Final, v4 … never a duplicate.
 */
export function nextVersionLabel(existing: ReportVersionInfo[]): string {
  let max = 0
  for (const r of existing) {
    const m = /^v(\d+)$/.exec(r.versionLabel)
    if (m) max = Math.max(max, parseInt(m[1], 10))
    // A 'Final' row implies at least one prior version existed — never regress below it.
    if (r.versionLabel === 'Final') max = Math.max(max, 1)
    if (r.summary) {
      try {
        const s = JSON.parse(r.summary) as { version?: number }
        if (typeof s.version === 'number') max = Math.max(max, s.version)
      } catch { /* tolerate malformed summary JSON */ }
    }
  }
  return `v${max + 1}`
}

// ─── Client approvals ────────────────────────────────────────────────

export const APPROVAL_DECISIONS = ['approved', 'rejected', 'changes_requested', 'clarification'] as const
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number]

export function isValidDecision(d: unknown): d is ApprovalDecision {
  return typeof d === 'string' && (APPROVAL_DECISIONS as readonly string[]).includes(d)
}
