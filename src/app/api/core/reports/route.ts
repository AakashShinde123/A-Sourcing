import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * POST /api/reports — report versioning engine.
 * action 'generate': next version (Draft → v1 → v2 → Final). action 'finalize': freeze as Final.
 */
export async function POST(req: NextRequest) {
  const { auditId, action } = (await req.json()) as { auditId: string; action: 'generate' | 'finalize' }
  const audit = await db.auditProject.findUnique({ where: { id: auditId }, include: { client: true } })
  if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })

  const existing = await db.report.findMany({ where: { auditId }, orderBy: { generatedAt: 'desc' } })

  if (action === 'generate') {
    const n = (await db.report.count()) + 1
    const versionLabel = existing.length === 0 ? 'v1' : existing[0].versionLabel === 'v1' ? 'v2' : `v${existing.length}`
    const report = await db.report.create({
      data: {
        clientId: audit.clientId, auditId,
        code: `RPT-2026-${String(n).padStart(3, '0')}`,
        name: `${audit.name} — Report ${versionLabel}`,
        type: 'Executive Summary',
        versionLabel,
        status: 'issued',
        generatedBy: 'Meera Rangan (Audit Manager)',
        sizeLabel: `${(1 + Math.random() * 2).toFixed(1)} MB`,
      },
    })
    await db.auditLog.create({ data: { actor: 'Meera Rangan', role: 'Audit Manager', action: 'REPORT_GENERATED', entity: 'Report', entityRef: report.code, detail: `${audit.code} · ${versionLabel}` } })
    return NextResponse.json({ ok: true, report })
  }

  // finalize: mark latest as Final and freeze
  const latest = existing[0]
  if (latest) {
    await db.report.update({ where: { id: latest.id }, data: { versionLabel: 'Final', status: 'final' } })
    await db.auditLog.create({ data: { actor: 'Meera Rangan', role: 'Audit Manager', action: 'REPORT_FINALIZED', entity: 'Report', entityRef: latest.code, detail: `${audit.code} frozen — results & evidence associations locked` } })
  }
  return NextResponse.json({ ok: true })
}
