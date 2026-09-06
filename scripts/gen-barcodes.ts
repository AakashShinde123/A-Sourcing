// Generate sample Code128 barcode PNGs + a self-contained printable label sheet.
// Run: bun scripts/gen-barcodes.ts
// Output: download/sample-data/barcodes/<value>.png
//         download/sample-data/barcode-label-sheet.html  (base64-embedded, single file)

import * as bwipjs from 'bwip-js'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT_DIR = '/home/z/my-project/download/sample-data'
const BC_DIR = join(OUT_DIR, 'barcodes')
mkdirSync(BC_DIR, { recursive: true })

interface Label { value: string; description: string; group: string }

// Round 1 register barcodes (BC-MRD-1201..1212) — descriptions match the sample xlsx
const round1: Label[] = [
  ['BC-MRD-1201', 'Vertical Machining Center VMC-850', 'CNC Hall 1'],
  ['BC-MRD-1202', 'CNC Turning Center ST-20', 'CNC Hall 2'],
  ['BC-MRD-1203', 'Hydraulic Pallet Truck 2.5T', 'FG Bay 1'],
  ['BC-MRD-1204', 'Server Rack 42U with PDU', 'Server Room'],
  ['BC-MRD-1205', 'Air Compressor 15 kW', 'Workshop'],
  ['BC-MRD-1206', 'Diesel Generator 125 kVA', 'Maintenance Dept.'],
  ['BC-MRD-1207', 'Assembly Conveyor Section C', 'Assembly Line 1'],
  ['BC-MRD-1208', 'Automatic Band Sealer', 'Finished Goods Store'],
  ['BC-MRD-1209', '3-Axis CMM — Zeiss Contura', 'Workshop'],
  ['BC-MRD-1210', 'Warehouse Rack Bay 12', 'RM Bay'],
  ['BC-MRD-1212', 'Design Workstation Dell 7550', 'Design Studio'],
].map(([value, description, group]) => ({ value, description, group }))

// Round 2 new barcodes
const round2: Label[] = [
  ['BC-MRD-1213', 'Battery Pallet Stacker', 'FG Bay 1'],
  ['BC-MRD-1214', 'Precision Surface Grinder', 'CNC Hall 1'],
  ['BC-MRD-1215', 'Network Switch 24-Port', 'Server Room'],
].map(([value, description, group]) => ({ value, description, group }))

// Platform's own ES codes (already-registered assets) — scan these against Asset 360
const esCodes: Label[] = [
  ['ES-MRD-00001', 'Fire Extinguisher Cabinet', 'Registered asset'],
  ['ES-MRD-00002', 'Toyota Forklift 2.5T', 'Registered asset'],
  ['ES-MRD-00003', 'Dell Latitude 5440 Laptop', 'Registered asset'],
].map(([value, description, group]) => ({ value, description, group }))

const all = [...round1, ...round2, ...esCodes]

async function pngFor(text: string): Promise<Buffer> {
  return (await bwipjs.toBuffer({
    bcid: 'code128',       // industry-standard 1D asset-tag symbology
    text,
    scale: 3,              // 3× ~ 300 dpi print quality
    height: 12,            // mm
    includetext: true,
    textxalign: 'center',
    textsize: 8,
    textyoffset: -2,
  })) as Buffer
}

const embedded: { label: Label; dataUrl: string }[] = []
for (const label of all) {
  const png = await pngFor(label.value)
  const file = join(BC_DIR, `${label.value}.png`)
  writeFileSync(file, png)
  embedded.push({ label, dataUrl: `data:image/png;base64,${png.toString('base64')}` })
  console.log('barcode', label.value, `(${png.length} bytes)`)
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

function labelHtml({ label, dataUrl }: { label: Label; dataUrl: string }): string {
  return `<div class="tag">
    <div class="tag-head"><span class="org">MERIDIAN MFG · FIXED ASSET</span></div>
    <img class="bc" src="${dataUrl}" alt="Code128 barcode ${esc(label.value)}" />
    <div class="code">${esc(label.value)}</div>
    <div class="desc">${esc(label.description)}${label.group ? ` · ${esc(label.group)}` : ''}</div>
  </div>`
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>EasySourcing · Sample Asset Barcode Labels</title>
<style>
  :root { --ink: #1c1917; --muted: #78716c; --line: #e7e5e4; --green: #059669; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif; color: var(--ink); background: #f6f8f4; margin: 0; padding: 24px 16px; }
  .sheet { max-width: 880px; margin: 0 auto; }
  .intro { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 18px 20px; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
  .intro h1 { font-size: 17px; margin: 0 0 6px; }
  .intro p { font-size: 12.5px; line-height: 1.55; color: var(--muted); margin: 4px 0; }
  .intro b { color: var(--green); }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  @media (max-width: 640px) { .grid { grid-template-columns: repeat(2, 1fr); } }
  .tag { background: #fff; border: 1px dashed #d6d3d1; border-radius: 10px; padding: 10px 8px 8px; text-align: center; page-break-inside: avoid; }
  .tag-head { display: flex; justify-content: center; margin-bottom: 4px; }
  .org { font-size: 8px; font-weight: 800; letter-spacing: .12em; color: var(--green); }
  .bc { width: 92%; height: auto; display: block; margin: 2px auto 4px; image-rendering: pixelated; }
  .code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-weight: 700; font-size: 12.5px; letter-spacing: .04em; }
  .desc { font-size: 9.5px; color: var(--muted); margin-top: 2px; }
  h2.sec { font-size: 13px; margin: 22px 0 10px; color: var(--ink); }
  footer { text-align: center; font-size: 10.5px; color: var(--muted); margin-top: 22px; }
  @page { size: A4; margin: 12mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .no-print { display: none !important; }
    .tag { border: 1px solid #d6d3d1; border-radius: 6px; }
    .intro { box-shadow: none; }
  }
  .btn { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(90deg,#10b981,#0d9488); color: #fff; border: 0; border-radius: 10px; padding: 12px 20px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px -4px rgba(16,185,129,.7); }
</style>
</head>
<body>
  <div class="sheet">
    <div class="intro no-print">
      <h1>Sample asset barcode labels — print, cut, stick, scan</h1>
      <p>Code 128 symbology — the same standard EasySourcing field tags use. <b>Print this page at 100% scale</b> (no "fit to page"), cut along the dashed borders, and stick the labels on any object.</p>
      <p><b>Round 1 &amp; 2 labels</b> belong to the sample Excel registers in this folder — import the register first, then scan the tag: the asset appears exactly as imported. <b>ES-MRD labels</b> are the platform's own registered assets.</p>
      <p style="margin-top:12px"><button class="btn" onclick="window.print()">🖨 Print this sheet (A4)</button></p>
    </div>

    <h2 class="sec">Round 1 — sample register barcodes</h2>
    <div class="grid">${embedded.slice(0, round1.length).map(labelHtml).join('')}</div>

    <h2 class="sec">Round 2 — new barcodes (dedup demo)</h2>
    <div class="grid">${embedded.slice(round1.length, round1.length + round2.length).map(labelHtml).join('')}</div>

    <h2 class="sec">Platform ES codes — already registered</h2>
    <div class="grid">${embedded.slice(round1.length + round2.length).map(labelHtml).join('')}</div>

    <footer>EasySourcing · generated sample labels · Code 128 · ${new Date().toISOString().slice(0, 10)}</footer>
  </div>
</body>
</html>`

writeFileSync(join(OUT_DIR, 'barcode-label-sheet.html'), html)
console.log('label sheet written:', join(OUT_DIR, 'barcode-label-sheet.html'))
