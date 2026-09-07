import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { EXCEPTION_LIFECYCLE, LEGAL_EXCEPTION_TRANSITIONS, isLegalTransition } from '@/lib/core-logic'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/core/exceptions — drive the exception lifecycle:
 * Open → Assigned → Investigating → Resolved → Reviewer Review → Approved → Closed.
 *
 * The state machine is enforced server-side: an action is legal only from its
 * documented source state (no stage skipping, no reopening a closed exception).
 * Illegal moves are rejected with 409; the detection record is never overwritten.
 */
export async function PATCH(req: NextRequest) {
  // RBAC: the exception lifecycle is an internal-ops workflow. Client viewers
  // see exceptions in their portal but drive resolutions through ops.
  if (!(await requireRole(req, ['ADMIN', 'OPS']))) {
    return NextResponse.json({ error: 'Only operations accounts may drive the exception lifecycle' }, { status: 403 })
  }

  let body: { id?: unknown; action?: unknown; note?: unknown; assignedTo?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const { id, action, note, assignedTo } = body
  if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  if (note !== undefined && note !== null && typeof note !== 'string') return NextResponse.json({ error: 'note must be a string' }, { status: 400 })

  const ex = await db.exception.findUnique({ where: { id } })
  if (!ex) return NextResponse.json({ error: 'Exception not found' }, { status: 404 })

  if (typeof action !== 'string' || !(action in EXCEPTION_LIFECYCLE)) {
    return NextResponse.json({ error: `Invalid action. Allowed: ${Object.keys(EXCEPTION_LIFECYCLE).join(', ')}` }, { status: 400 })
  }
  if (!isLegalTransition(action, ex.status)) {
    return NextResponse.json(
      { error: `Illegal transition: cannot '${action}' from status '${ex.status}' (requires '${EXCEPTION_LIFECYCLE[action].from}')` },
      { status: 409 },
    )
  }
  const status = EXCEPTION_LIFECYCLE[action].to

  await db.exception.update({
    where: { id },
    data: {
      status,
      ...(assignedTo && typeof assignedTo === 'string' ? { assignedTo } : {}),
      ...(action === 'investigate' && !ex.assignedTo ? { assignedTo: (typeof assignedTo === 'string' && assignedTo) || 'Ops Team' } : {}),
      ...(action === 'resolve' ? { resolutionNote: typeof note === 'string' && note ? note : 'Resolved with corrected details.', resolvedAt: new Date() } : {}),
    },
  })

  await db.auditLog.create({
    data: {
      actor: 'Operations Team',
      role: action === 'review' || action === 'approve' ? 'Reviewer' : 'Operations',
      action: `EXCEPTION_${action.toUpperCase()}`,
      entity: 'Exception',
      entityRef: ex.code,
      detail: typeof note === 'string' && note ? note : `Status moved to ${status.replace(/_/g, ' ')}`,
    },
  })

  return NextResponse.json({ ok: true, status })
}
