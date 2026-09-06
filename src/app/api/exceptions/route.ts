import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const FLOW: Record<string, string> = {
  assign: 'assigned',
  investigate: 'investigating',
  resolve: 'resolved',
  review: 'reviewer_review',
  approve: 'approved',
  close: 'closed',
}

/**
 * PATCH /api/exceptions — drive the exception lifecycle:
 * Open → Assigned → Investigating → Resolved → Reviewer Review → Approved → Closed.
 * The original detection event is never overwritten; only lifecycle fields move.
 */
export async function PATCH(req: NextRequest) {
  const { id, action, note, assignedTo } = (await req.json()) as { id: string; action: keyof typeof FLOW; note?: string; assignedTo?: string }
  const ex = await db.exception.findUnique({ where: { id } })
  if (!ex) return NextResponse.json({ error: 'Exception not found' }, { status: 404 })

  const status = FLOW[action]
  if (!status) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  await db.exception.update({
    where: { id },
    data: {
      status,
      ...(assignedTo ? { assignedTo } : {}),
      ...(action === 'investigate' && !ex.assignedTo ? { assignedTo: assignedTo ?? 'Ops Team' } : {}),
      ...(action === 'resolve' ? { resolutionNote: note ?? 'Resolved with corrected details.', resolvedAt: new Date() } : {}),
    },
  })

  await db.auditLog.create({
    data: {
      actor: 'Operations Team',
      role: action === 'review' || action === 'approve' ? 'Reviewer' : 'Operations',
      action: `EXCEPTION_${action.toUpperCase()}`,
      entity: 'Exception',
      entityRef: ex.code,
      detail: note ?? `Status moved to ${status.replace(/_/g, ' ')}`,
    },
  })

  return NextResponse.json({ ok: true, status })
}
