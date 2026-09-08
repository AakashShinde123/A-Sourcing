// Shared formatting + status design tokens for EasySourcing

export const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const fmtDateShort = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'

export const fmtDateTime = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export const fmtMoney = (n?: number | null) =>
  n == null ? '—' : `₹${n.toLocaleString('en-IN')}`

export const fmtMoneyShort = (n?: number | null) => {
  if (n == null) return '—'
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`
  return `₹${n.toLocaleString('en-IN')}`
}

// ── Audit lifecycle ─────────────────────────────────────────────
export const AUDIT_STAGES = ['draft', 'planning', 'ready', 'in_progress', 'field_complete', 'review', 'client_review', 'completed', 'archived'] as const
export const auditStageIndex = (s: string) => Math.max(0, AUDIT_STAGES.indexOf(s as (typeof AUDIT_STAGES)[number]))

export const auditStatusMeta: Record<string, { label: string; cls: string; dot: string }> = {
  draft: { label: 'Draft', cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200', dot: 'bg-zinc-400' },
  planning: { label: 'Planning', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  ready: { label: 'Ready', cls: 'bg-teal-50 text-teal-700 ring-teal-200', dot: 'bg-teal-500' },
  in_progress: { label: 'In Progress', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  field_complete: { label: 'Field Complete', cls: 'bg-teal-50 text-teal-700 ring-teal-200', dot: 'bg-teal-500' },
  review: { label: 'Internal Review', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  client_review: { label: 'Client Review', cls: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500' },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  archived: { label: 'Archived', cls: 'bg-zinc-100 text-zinc-500 ring-zinc-200', dot: 'bg-zinc-400' },
}

// ── Reconciliation results ──────────────────────────────────────
export const resultMeta: Record<string, { label: string; cls: string; dot: string }> = {
  matched: { label: 'Matched', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  missing: { label: 'Missing', cls: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
  location_mismatch: { label: 'Location Mismatch', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  custodian_mismatch: { label: 'Custodian Mismatch', cls: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500' },
  serial_mismatch: { label: 'Serial Mismatch', cls: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
  condition_exception: { label: 'Condition Exception', cls: 'bg-zinc-100 text-zinc-700 ring-zinc-300', dot: 'bg-zinc-500' },
  unregistered: { label: 'Unregistered', cls: 'bg-teal-50 text-teal-700 ring-teal-200', dot: 'bg-teal-500' },
  deferred: { label: 'Deferred', cls: 'bg-zinc-100 text-zinc-500 ring-zinc-200', dot: 'bg-zinc-400' },
}

// ── Exceptions ──────────────────────────────────────────────────
export const exceptionTypeMeta: Record<string, { label: string }> = {
  missing: { label: 'Missing' }, location_mismatch: { label: 'Location Mismatch' },
  custodian_mismatch: { label: 'Custodian Mismatch' }, serial_mismatch: { label: 'Serial Mismatch' },
  damaged: { label: 'Damaged' }, unregistered: { label: 'Unregistered' },
  duplicate: { label: 'Duplicate' }, tag_issue: { label: 'Tag Issue' },
}

export const exceptionStatusMeta: Record<string, { label: string; cls: string; dot: string }> = {
  open: { label: 'Open', cls: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
  assigned: { label: 'Assigned', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  investigating: { label: 'Investigating', cls: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500' },
  resolved: { label: 'Resolved', cls: 'bg-teal-50 text-teal-700 ring-teal-200', dot: 'bg-teal-500' },
  reviewer_review: { label: 'Reviewer Review', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  closed: { label: 'Closed', cls: 'bg-zinc-100 text-zinc-500 ring-zinc-200', dot: 'bg-zinc-400' },
}

export const severityMeta: Record<string, { label: string; cls: string }> = {
  low: { label: 'Low', cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200' },
  medium: { label: 'Medium', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  high: { label: 'High', cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
  critical: { label: 'Critical', cls: 'bg-red-50 text-red-700 ring-red-200' },
}

// ── Assets ──────────────────────────────────────────────────────
export const assetStatusMeta: Record<string, { label: string; cls: string; dot: string }> = {
  registered: { label: 'Registered', cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200', dot: 'bg-zinc-400' },
  tagged: { label: 'Tagged', cls: 'bg-teal-50 text-teal-700 ring-teal-200', dot: 'bg-teal-500' },
  assigned: { label: 'Assigned', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  maintenance: { label: 'Maintenance', cls: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500' },
  missing: { label: 'Missing', cls: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
  disposed: { label: 'Disposed', cls: 'bg-zinc-100 text-zinc-500 ring-zinc-200', dot: 'bg-zinc-400' },
  retired: { label: 'Retired', cls: 'bg-zinc-100 text-zinc-500 ring-zinc-200', dot: 'bg-zinc-400' },
}

export const conditionMeta: Record<string, { label: string; cls: string }> = {
  excellent: { label: 'Excellent', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  good: { label: 'Good', cls: 'bg-teal-50 text-teal-700 ring-teal-200' },
  fair: { label: 'Fair', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  poor: { label: 'Poor', cls: 'bg-red-50 text-red-700 ring-red-200' },
}

export const seedColor: Record<string, { from: string; to: string; text: string; solid: string; ring: string }> = {
  emerald: { from: 'from-emerald-400', to: 'to-teal-600', text: 'text-emerald-700', solid: 'bg-emerald-500', ring: 'ring-emerald-200' },
  teal: { from: 'from-teal-400', to: 'to-cyan-600', text: 'text-teal-700', solid: 'bg-teal-500', ring: 'ring-teal-200' },
  amber: { from: 'from-amber-400', to: 'to-orange-500', text: 'text-amber-700', solid: 'bg-amber-500', ring: 'ring-amber-200' },
  rose: { from: 'from-rose-400', to: 'to-pink-600', text: 'text-rose-700', solid: 'bg-rose-500', ring: 'ring-rose-200' },
  orange: { from: 'from-orange-400', to: 'to-amber-600', text: 'text-orange-700', solid: 'bg-orange-500', ring: 'ring-orange-200' },
  zinc: { from: 'from-zinc-400', to: 'to-zinc-600', text: 'text-zinc-700', solid: 'bg-zinc-500', ring: 'ring-zinc-200' },
}

export const initials = (name: string) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
