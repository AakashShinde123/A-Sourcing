import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Lifecycle mirrors modules/shared/format.ts AUDIT_STAGES (kept local so the
// API stays dependency-free from client code).
const STAGES = ['draft', 'planning', 'ready', 'in_progress', 'field_complete', 'review', 'client_review', 'completed', 'archived'] as const

const AUDIT_TYPES = [
  'Annual Physical Verification',
  'Fixed Asset Verification',
  'Asset Tagging',
  'Location Verification',
  'Custodian Verification',
  'Special Audit',
]

const str = (v: unknown): string | null => {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

/** Indian fiscal year label for a date — "FY 2026-27" (April → March). */
function fiscalYearOf(d: Date): string {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  return `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`
}

/**
 * Allocate the next AUD-<yyyy>-NNN project code. Max-scan like the other
 * allocators: after deletes a code is never re-issued.
 */
async function allocateAuditCode(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `AUD-${year}-`
  const taken = new Set((await db.auditProject.findMany({ select: { code: true } })).map((a) => a.code))
  let max = 0
  for (const c of taken) if (c.startsWith(prefix)) max = Math.max(max, parseInt(c.slice(prefix.length), 10) || 0)
  let n = max + 1
  while (taken.has(`${prefix}${String(n).padStart(3, '0')}`)) n++
  return `${prefix}${String(n).padStart(3, '0')}`
}

/** Recompute the audit's totalInScope from the assets actually attached. */
async function recomputeScope(auditId: string): Promise<number> {
  const n = await db.asset.count({ where: { assignment: { auditId } } })
  await db.auditProject.update({ where: { id: auditId }, data: { totalInScope: n } })
  return n
}

/**
 * POST /api/core/audits — create an audit project (team only).
 * Contract: { clientId, name, type, financialYear?, startDate?, endDate?,
 *             locationsLabel?, evidenceRequired? } → { audit } 201
 * The project starts as a draft; scopes are published with PATCH assign.
 */
export async function POST(req: NextRequest) {
  const actor = await requireRole(req, ['ADMIN', 'OPS'])
  if (!actor) return NextResponse.json({ error: 'Only operations accounts may create audit projects' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const clientId = str(body.clientId)
  const name = str(body.name)
  const type = str(body.type)

  if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (name.length > 120) return NextResponse.json({ error: 'name is too long (max 120 chars)' }, { status: 400 })
  if (!type || !AUDIT_TYPES.includes(type)) {
    return NextResponse.json({ error: `type must be one of: ${AUDIT_TYPES.join(' | ')}` }, { status: 400 })
  }

  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const startDate = str(body.startDate) ? new Date(String(body.startDate)) : new Date()
  if (isNaN(startDate.getTime())) return NextResponse.json({ error: 'startDate is not a valid date' }, { status: 400 })
  const endDate = str(body.endDate) ? new Date(String(body.endDate)) : null
  if (endDate && isNaN(endDate.getTime())) return NextResponse.json({ error: 'endDate is not a valid date' }, { status: 400 })
  if (endDate && endDate < startDate) return NextResponse.json({ error: 'endDate cannot be before startDate' }, { status: 400 })

  const audit = await db.auditProject.create({
    data: {
      clientId,
      code: await allocateAuditCode(),
      name,
      type,
      status: 'draft',
      financialYear: str(body.financialYear) ?? fiscalYearOf(startDate),
      startDate,
      endDate,
      locationsLabel: str(body.locationsLabel) ?? client.city,
      evidenceRequired: body.evidenceRequired === false ? false : true,
    },
  })

  await db.auditLog.create({
    data: {
      actor: actor.name, role: 'access', action: 'AUDIT_CREATED', entity: 'AuditProject', entityRef: audit.code,
      detail: `${audit.name} · ${type} · ${client.name}`,
    },
  })

  return NextResponse.json({ audit }, { status: 201 })
}

/**
 * PATCH /api/core/audits — planning actions (team only).
 *  { id, action: 'assign', auditorId, locationId?, scope? }
 *      → publishes a field scope. Assets parked at the chosen location and
 *        not already in another scope are attached automatically; a draft
 *        project moves to planning. → { assignment, attached, totalInScope }
 *  { id, action: 'unassign', assignmentId }
 *      → withdraws a scope: assets and verifications are detached (history
 *        kept), the assignment row is removed. → { ok, totalInScope }
 *  { id, action: 'advance' }
 *      → moves the project one lifecycle stage forward. → { audit }
 */
export async function PATCH(req: NextRequest) {
  const actor = await requireRole(req, ['ADMIN', 'OPS'])
  if (!actor) return NextResponse.json({ error: 'Only operations accounts may plan audit projects' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const action = str(body.action)

  // ── assign ─────────────────────────────────────────────────────
  if (action === 'assign') {
    const auditId = str(body.id)
    const auditorId = str(body.auditorId)
    const locationId = str(body.locationId)
    if (!auditId || !auditorId) return NextResponse.json({ error: 'id and auditorId are required' }, { status: 400 })

    const audit = await db.auditProject.findUnique({ where: { id: auditId }, include: { client: true } })
    if (!audit) return NextResponse.json({ error: 'Audit project not found' }, { status: 404 })

    const auditor = await db.auditor.findUnique({ where: { id: auditorId } })
    if (!auditor) return NextResponse.json({ error: 'Field team member not found' }, { status: 404 })

    let location = null
    if (locationId) {
      location = await db.location.findUnique({ where: { id: locationId } })
      if (!location) return NextResponse.json({ error: 'Location not found' }, { status: 404 })
      if (location.clientId !== audit.clientId) {
        return NextResponse.json({ error: 'Location belongs to a different client than the audit' }, { status: 400 })
      }
    }

    const scope = str(body.scope) ?? (location ? `${location.name} — ${audit.name}` : `General scope — ${audit.name}`)
    if (scope.length > 160) return NextResponse.json({ error: 'scope is too long (max 160 chars)' }, { status: 400 })

    const assignment = await db.auditAssignment.create({
      data: { auditId, auditorId, locationId, scope, status: 'assigned' },
      include: { auditor: true, location: true },
    })

    // Auto-link unassigned assets parked at the chosen location.
    let attached = 0
    if (locationId) {
      const res = await db.asset.updateMany({
        where: { clientId: audit.clientId, locationId, assignmentId: null },
        data: { assignmentId: assignment.id },
      })
      attached = res.count
    }

    const totalInScope = await recomputeScope(auditId)

    // First published scope wakes a draft project into planning.
    if (audit.status === 'draft') {
      await db.auditProject.update({ where: { id: auditId }, data: { status: 'planning' } })
    }

    await db.auditLog.create({
      data: {
        actor: actor.name, role: 'access', action: 'SCOPE_ASSIGNED', entity: 'AuditAssignment', entityRef: audit.code,
        detail: `${auditor.name} · ${scope} · ${attached} asset${attached === 1 ? '' : 's'} linked`,
      },
    })

    return NextResponse.json({ assignment, attached, totalInScope }, { status: 201 })
  }

  // ── unassign ───────────────────────────────────────────────────
  if (action === 'unassign') {
    const assignmentId = str(body.assignmentId)
    if (!assignmentId) return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 })

    const assignment = await db.auditAssignment.findUnique({ where: { id: assignmentId } })
    if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

    // Verifications are immutable history — they stay, only the live link breaks.
    await db.$transaction([
      db.asset.updateMany({ where: { assignmentId }, data: { assignmentId: null } }),
      db.verification.updateMany({ where: { assignmentId }, data: { assignmentId: null } }),
      db.auditAssignment.delete({ where: { id: assignmentId } }),
    ])
    const totalInScope = await recomputeScope(assignment.auditId)

    await db.auditLog.create({
      data: {
        actor: actor.name, role: 'access', action: 'SCOPE_WITHDRAWN', entity: 'AuditAssignment', entityRef: assignment.scope,
        detail: `withdrawn from ${assignment.auditId}`,
      },
    })

    return NextResponse.json({ ok: true, totalInScope })
  }

  // ── advance ────────────────────────────────────────────────────
  if (action === 'advance') {
    const auditId = str(body.id)
    if (!auditId) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const audit = await db.auditProject.findUnique({ where: { id: auditId } })
    if (!audit) return NextResponse.json({ error: 'Audit project not found' }, { status: 404 })

    const idx = STAGES.indexOf(audit.status as (typeof STAGES)[number])
    if (idx < 0) return NextResponse.json({ error: `Unknown status ${audit.status}` }, { status: 400 })
    if (idx >= STAGES.length - 1) {
      return NextResponse.json({ error: 'Project is already archived — no further stages' }, { status: 409 })
    }

    const status = STAGES[idx + 1]
    const updated = await db.auditProject.update({ where: { id: auditId }, data: { status } })
    await db.auditLog.create({
      data: {
        actor: actor.name, role: 'access', action: 'AUDIT_STAGE', entity: 'AuditProject', entityRef: audit.code,
        detail: `${audit.status} → ${status}`,
      },
    })
    return NextResponse.json({ audit: updated })
  }

  return NextResponse.json({ error: 'action must be assign | unassign | advance' }, { status: 400 })
}
