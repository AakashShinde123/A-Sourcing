import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * GET /api/core/assets/labels?ids=a,b,c — printable QR label sheet (A4).
 *
 * Field teams physically tag assets before an audit can scan them. Ops picks
 * assets in the Asset Register, opens this sheet and prints it (browser
 * "Save as PDF" works everywhere — phones included). Every label carries a QR
 * encoding the exact value the Auditor Mobile scanner resolves (asset barcode,
 * falling back to the ES code) plus human-readable code, description, serial
 * and client for manual reconciliation.
 *
 * RBAC: ADMIN/OPS only (label generation is an ops workflow; the register
 * itself is team-only data).
 */
export async function GET(req: NextRequest) {
  if (!(await requireRole(req, ['ADMIN', 'OPS']))) {
    return NextResponse.json({ error: 'Only operations accounts may generate asset labels' }, { status: 403 })
  }

  const idsRaw = req.nextUrl.searchParams.get('ids') ?? ''
  const ids = [...new Set(idsRaw.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 500)
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Provide ?ids=assetId1,assetId2 (max 500)' }, { status: 400 })
  }

  const assets = await db.asset.findMany({
    where: { id: { in: ids } },
    include: { client: { select: { name: true, code: true } }, location: { select: { name: true } } },
    orderBy: [{ clientId: 'asc' }, { code: 'asc' }],
  })
  if (assets.length === 0) {
    return NextResponse.json({ error: 'No matching assets for the given ids' }, { status: 404 })
  }

  const labels: string[] = []
  for (const a of assets) {
    const value = a.barcode || a.code // the exact string the field scanner resolves
    let svg = ''
    try {
      svg = await QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
    } catch {
      svg = '<svg xmlns="http://www.w3.org/2000/svg" width="29" height="29"/>'
    }
    // make the QR svg fill its box
    svg = svg.replace('<svg', '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%"')
    labels.push(`
      <div class="label">
        <div class="qr">${svg}</div>
        <div class="meta">
          <div class="code">${escapeHtml(a.code)}</div>
          <div class="val">${escapeHtml(value)}</div>
          <div class="desc" title="${escapeHtml(a.description)}">${escapeHtml(a.description)}</div>
          <div class="sub">${escapeHtml(a.client.name)}${a.location?.name ? ' · ' + escapeHtml(a.location.name) : ''}</div>
          <div class="sub mono">${escapeHtml(a.serialNumber ?? '—')}</div>
        </div>
      </div>`)
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>ES labels — ${assets.length} asset${assets.length === 1 ? '' : 's'}</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; background:#f4f4f5; color:#18181b; }
  .bar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 12px;
         padding: 10px 14px; background: #ffffff; border-bottom: 1px solid #e4e4e7; }
  .bar h1 { font-size: 14px; font-weight: 700; }
  .bar p { font-size: 11px; color: #71717a; margin-top: 2px; }
  .bar button { border: 0; cursor: pointer; border-radius: 10px; padding: 9px 16px; font-size: 13px; font-weight: 700; color: #fff;
                background: linear-gradient(90deg,#10b981,#0d9488); box-shadow: 0 6px 18px -6px rgba(13,148,136,.7); }
  .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; padding: 6mm; max-width: 210mm; margin: 0 auto; }
  .label { display: flex; gap: 2.4mm; align-items: center; background: #fff; border: 1px dashed #d4d4d8; border-radius: 2mm;
           padding: 2mm; height: 34mm; break-inside: avoid; page-break-inside: avoid; }
  .qr { width: 21mm; height: 21mm; flex: none; }
  .meta { min-width: 0; display: flex; flex-direction: column; gap: 0.6mm; }
  .code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 8.5pt; font-weight: 700; letter-spacing: .2px; }
  .val  { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 7pt; color: #3f3f46; word-break: break-all; }
  .desc { font-size: 7pt; font-weight: 600; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .sub  { font-size: 5.8pt; color: #71717a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub.mono { font-family: ui-monospace, Menlo, Consolas, monospace; }
  @page { size: A4; margin: 6mm; }
  @media print {
    body { background: #fff; }
    .bar { display: none; }
    .sheet { padding: 0; gap: 2.5mm; }
    .label { border-color: #e4e4e7; }
  }
</style>
</head>
<body>
  <div class="bar">
    <div>
      <h1>ES Field — asset QR labels</h1>
      <p>${assets.length} label${assets.length === 1 ? '' : 's'} · tap Print and choose “Save as PDF” or your label printer · ~21 labels per A4 sheet</p>
    </div>
    <button onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="sheet">${labels.join('\n')}</div>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}
