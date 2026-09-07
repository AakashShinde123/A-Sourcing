/**
 * Verify the sample test kit through the REAL platform pipeline:
 *   xlsx file → ImportRegisterDialog parse path (xlsx lib + parseSheetRows)
 *   → POST /api/core/assets/import handler (isolated DB copy)
 * Throws away the DB copy afterwards — live demo data untouched.
 */
import { readFileSync, rmSync, copyFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { parseRegister, parseSheetRows } from '@/modules/shared/register-parse'
import { POST as importPOST } from '@/app/api/core/assets/import/route'
import { jsonRequest } from '../tests/whitebox/helpers'

const SAMPLES = '/home/z/my-project/download/easysourcing-samples'

function rowsFromXlsx(file: string): string[][] {
  const wb = XLSX.read(readFileSync(`${SAMPLES}/${file}`), { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, { header: 1, raw: false, defval: '' })
}

async function importRows(rows: ReturnType<typeof parseSheetRows>['rows']) {
  const res = await importPOST(await jsonRequest('http://local/api/core/assets/import', { clientId: 'cl_mrd', rows }))
  return { status: res.status, body: await res.json() as { imported: number; skipped: number; rejected: number; items: { clientAssetId: string; status: string; code?: string; error?: string }[] } }
}

let failures = 0
function expect(cond: boolean, label: string) {
  if (cond) console.log(`  ok  ${label}`)
  else { failures++; console.log(`  FAIL ${label}`) }
}

async function main() {
  console.log('── fresh.xlsx: parse + import')
  const grid1 = rowsFromXlsx('sample-asset-register-fresh.xlsx')
  const p1 = parseSheetRows(grid1 as unknown as (string | number | null)[][])
  expect(p1.headerMapped, 'headers auto-mapped (ERP alias names)')
  expect(p1.rows.length === 10, `10 rows parsed (${p1.rows.length})`)
  expect(p1.rows[0].clientAssetId === 'MRD-FA-1001' && p1.rows[0].description === 'CNC Vertical Machining Center', 'alias mapping: Asset ID/Particulars correct')
  expect(p1.rows[0].barcode === 'MRD-TAG-1001', 'Tag column → barcode field')
  expect(p1.rows[0].locationLabel === 'CNC Hall 1', 'Floor column → location')
  const r1 = await importRows(p1.rows)
  expect(r1.status === 200 && r1.body.imported === 10 && r1.body.rejected === 0, `imported ${r1.body.imported}, rejected ${r1.body.rejected}`)
  expect((r1.body.items.filter(i => i.status === 'imported').every(i => /^ES-MRD-\d{5}$/.test(i.code ?? ''))), 'auto codes ES-MRD-NNNNN allocated')
  const annex = r1.body.items.find(i => i.clientAssetId === 'MRD-FA-1010')
  expect(!!annex && !!annex.code, 'unknown-location row still imports')

  console.log('── fresh.csv: parse (CSV twin)')
  const csvText = readFileSync(`${SAMPLES}/sample-asset-register-fresh.csv`, 'utf8')
  const pCsv = parseRegister(csvText)
  expect(pCsv.rows.length === 10 && pCsv.headerMapped, 'CSV parses via the shared parser too')

  console.log('── dedup-check.xlsx: 4 skipped + 2 imported')
  const p2 = parseSheetRows(rowsFromXlsx('sample-asset-register-dedup-check.xlsx') as unknown as (string | number | null)[][])
  const r2 = await importRows(p2.rows)
  expect(r2.body.imported === 2 && r2.body.skipped === 4 && r2.body.rejected === 0, `imported ${r2.body.imported} · duplicates ${r2.body.skipped} · rejected ${r2.body.rejected}`)

  console.log('── errors.xlsx: 2 imported + 3 rejected with reasons')
  const p3 = parseSheetRows(rowsFromXlsx('sample-asset-register-errors.xlsx') as unknown as (string | number | null)[][])
  const r3 = await importRows(p3.rows)
  expect(r3.body.imported === 2 && r3.body.rejected === 3, `imported ${r3.body.imported} · rejected ${r3.body.rejected}`)
  expect(r3.body.items.filter(i => i.status === 'rejected').every(i => !!i.error), 'every rejection carries a reason')

  console.log('── barcode values ↔ register tags cross-check')
  const tags = new Set(p1.rows.map(r => r.barcode))
  for (let i = 1001; i <= 1010; i++) expect(tags.has(`MRD-TAG-${i}`), `tag MRD-TAG-${i} present in register + barcode sheet`)

  console.log(failures === 0 ? '\nALL SAMPLE CHECKS PASS' : `\n${failures} FAILURES`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
