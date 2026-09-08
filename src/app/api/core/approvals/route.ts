import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isValidDecision } from '@/lib/core-logic'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/core/approvals — client-side review decision on an audit.
 * - 'approved' (while in client_review) finalizes the audit.
 * - 'changes_requested' sends it back to internal review.
 * - 'rejected' / 'clarification' are recorded without moving the audit.
 * Decisions and actor identity are validated — the audit trail must stay accountable.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const { auditId, decision, byName, byRole, comment } = body
  if (typeof auditId !== 'string' || !auditId) return NextResponse.json({ error: 'auditId is required' }, { status: 400 })
  if (!isValidDecision(decision)) {
    return NextResponse.json({ error: "decision must be one of: approved, rejected, changes_requested, clarification" }, { status: 400 })
  }
  if (typeof byName !== 'string' || !byName.trim() || typeof byRole !== 'string' || !byRole.trim()) {
    return NextResponse.json({ error: 'byName and byRole are required — every decision needs an accountable actor' }, { status: 400 })
  }

  const audit = await db.auditProject.findUnique({ where: { id: auditId } })
  if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })

  // RBAC + accountability: CLIENT sessions may only decide on their own
  // client's audits, and the recorded actor IS the signed-in user — the
  // payload cannot attribute a decision to someone else.
  let actorName = typeof byName === 'string' ? byName.trim() : ''
  let actorRole = typeof byRole === 'string' ? byRole.trim() : ''
  if (session.role === 'CLIENT') {
    if (audit.clientId !== session.clientId) {
      return NextResponse.json({ error: 'You can only review audits belonging to your own client' }, { status: 403 })
    }
    actorName = session.name
    actorRole = session.clientName ? `Client · ${session.clientName}` : 'Client'
  }

  await db.approval.create({ data: { clientId: audit.clientId, auditId, decision, byName: actorName, byRole: actorRole, comment: typeof comment === 'string' ? comment : undefined } })

  if (decision === 'approved' && audit.status === 'client_review') {
    await db.auditProject.update({ where: { id: auditId }, data: { status: 'completed' } })
  } else if (decision === 'changes_requested' && audit.status === 'client_review') {
    await db.auditProject.update({ where: { id: auditId }, data: { status: 'review' } })
  }

  await db.auditLog.create({
    data: {
      actor: actorName, role: `Client ${actorRole}`,
      action: decision === 'approved' ? 'APPROVAL_GRANTED' : decision === 'changes_requested' ? 'CHANGES_REQUESTED' : 'REVIEW_COMMENT',
      entity: 'Audit', entityRef: audit.code,
      detail: typeof comment === 'string' && comment ? comment : `Decision: ${decision}`,
    },
  })

  return NextResponse.json({ ok: true })
}
