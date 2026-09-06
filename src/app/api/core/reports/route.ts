import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { nextVersionLabel } from '@/lib/core-logic'

export const dynamic = 'force-dynamic'

/**
 * POST /api/core/reports — report versioning engine.
 * - action 'generate': next version (v1 → v2 → v3 …), unique & monotonic even
 *   after a report is frozen as Final (numeric version persists in summary JSON).
 * - action 'finalize': freeze the latest report as Final. Requires ≥1 report.
 */
export async function POST(req: NextRequest) {
  let body: { auditId?: unknown; action?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }
  const { auditId, action } = body
  if (typeof auditId !== 'string' || !auditId) return NextResponse.json({ error: 'auditId is required' }, { status: 400 })
  if (action !== 'generate' && action !== 'finalize') {
    return NextResponse.json({ error: "action must be 'generate' or 'finalize'" }, { status: 400 })
  }

  const audit = await db.auditProject.findUnique({ where: { id: auditId }, include: { client: true } })
  if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })

  const existing = await db.report.findMany({ where: { auditId }, orderBy: { generatedAt: 'desc' } })

  if (action === 'generate') {
    const versionLabel = nextVersionLabel(existing)
    const versionNumber = parseInt(versionLabel.slice(1), 10)
    const allCodes = (await db.report.findMany({ select: { code: true } })).map((r) => r.code)
    let max = 0
    for (const c of allCodes) {
      const m = /^RPT-\d{4}-(\d+)$/.exec(c)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    const report = await db.report.create({
      data: {
        clientId: audit.clientId, auditId,
        code: `RPT-2026-${String(max + 1).padStart(3, '0')}`,
        name: `${audit.name} — Report ${versionLabel}`,
        type: 'Executive Summary',
        versionLabel,
        status: 'issued',
        generatedBy: 'Meera Rangan (Audit Manager)',
        sizeLabel: `${(1 + Math.random() * 2).toFixed(1)} MB`,
        summary: JSON.stringify({ version: versionNumber }),
      },
    })
    await db.auditLog.create({ data: { actor: 'Meera Rangan', role: 'Audit Manager', action: 'REPORT_GENERATED', entity: 'Report', entityRef: report.code, detail: `${audit.code} · ${versionLabel}` } })
    return NextResponse.json({ ok: true, report })
  }

  // finalize: mark the latest report as Final and freeze
  const latest = existing[0]
  if (!latest) {
    return NextResponse.json({ error: 'No reports to finalize — generate one first' }, { status: 400 })
  }
  await db.report.update({ where: { id: latest.id }, data: { versionLabel: 'Final', status: 'final' } })
  await db.auditLog.create({ data: { actor: 'Meera Rangan', role: 'Audit Manager', action: 'REPORT_FINALIZED', entity: 'Report', entityRef: latest.code, detail: `${audit.code} frozen — results & evidence associations locked` } })
  return NextResponse.json({ ok: true })
}
