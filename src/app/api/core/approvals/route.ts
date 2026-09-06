import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * POST /api/approvals — client-side review decision on an audit.
 * approved (while in client_review) finalizes the audit; changes_requested sends it back to internal review.
 */
export async function POST(req: NextRequest) {
  const { auditId, decision, byName, byRole, comment } = (await req.json()) as {
    auditId: string; decision: 'approved' | 'rejected' | 'changes_requested' | 'clarification'; byName: string; byRole: string; comment?: string
  }
  const audit = await db.auditProject.findUnique({ where: { id: auditId } })
  if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })

  await db.approval.create({ data: { clientId: audit.clientId, auditId, decision, byName, byRole, comment } })

  if (decision === 'approved' && audit.status === 'client_review') {
    await db.auditProject.update({ where: { id: auditId }, data: { status: 'completed' } })
  } else if (decision === 'changes_requested' && audit.status === 'client_review') {
    await db.auditProject.update({ where: { id: auditId }, data: { status: 'review' } })
  }

  await db.auditLog.create({
    data: {
      actor: byName, role: `Client ${byRole}`,
      action: decision === 'approved' ? 'APPROVAL_GRANTED' : decision === 'changes_requested' ? 'CHANGES_REQUESTED' : 'REVIEW_COMMENT',
      entity: 'Audit', entityRef: audit.code,
      detail: comment ?? `Decision: ${decision}`,
    },
  })

  return NextResponse.json({ ok: true })
}
