// @es/shared · register-parse
// Pure CSV parsing for client asset-register uploads. No React, no DOM —
// fully unit-testable. Real ERP exports use wildly different column names,
// so headers are mapped through an alias table; headerless files fall back
// to positional order.

export interface ParsedRow {
  clientAssetId?: string
  description?: string
  category?: string
  make?: string
  model?: string
  serialNumber?: string
  barcode?: string
  locationLabel?: string
  custodian?: string
}

/** CSV cell splitter with quoted-cell support ("120, Main St" stays one cell). */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { cells.push(cur); cur = '' }
    else cur += ch
  }
  cells.push(cur)
  return cells.map((c) => c.trim())
}

/** Header aliases — real ERP exports use all kinds of names for the same column. */
export const HEADER_ALIASES: Record<string, keyof ParsedRow> = {
  assetid: 'clientAssetId', asset_id: 'clientAssetId', assetcode: 'clientAssetId', asset_code: 'clientAssetId', id: 'clientAssetId',
  description: 'description', desc: 'description', assetdescription: 'description', particulars: 'description',
  category: 'category', cat: 'category', assetcategory: 'category', group: 'category',
  make: 'make', brand: 'make', manufacturer: 'make',
  model: 'model', modelno: 'model',
  serial: 'serialNumber', serialno: 'serialNumber', serialnumber: 'serialNumber',
  barcode: 'barcode', qr: 'barcode', tag: 'barcode', taglocation: 'barcode',
  location: 'locationLabel', locationlabel: 'locationLabel', floor: 'locationLabel', area: 'locationLabel',
  custodian: 'custodian', user: 'custodian', username: 'custodian', holder: 'custodian', employee: 'custodian',
}

const POSITIONAL_KEYS: (keyof ParsedRow)[] = ['clientAssetId', 'description', 'category', 'make', 'model', 'serialNumber', 'barcode', 'locationLabel', 'custodian']

/** Shared grid parser — one code path for CSV text and Excel sheets alike.
 *  Robust against real-world exports: banner/title rows above the header are
 *  detected and skipped (the header is the first row naming ≥3 known columns). */
function parseGrid(grid: string[][]): { rows: ParsedRow[]; headerMapped: boolean } {
  const lines = grid.filter((r) => r.some((c) => c.trim().length))
  if (!lines.length) return { rows: [], headerMapped: false }

  const mappedFor = (cells: string[]): (keyof ParsedRow | null)[] =>
    cells.map((c) => {
      const clean = c.toLowerCase().replace(/[^a-z ]/g, '').trim()
      return HEADER_ALIASES[clean.replace(/ /g, '')] ?? HEADER_ALIASES[clean] ?? null
    })

  // Header hunting: ERP exports often carry a report title / client banner in
  // the first rows. The real header is the FIRST row naming ≥3 known columns.
  let mapped: (keyof ParsedRow | null)[] = []
  let headerIdx = -1
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const m = mappedFor(lines[i])
    if (m.filter(Boolean).length >= 3) {
      mapped = m
      headerIdx = i
      break
    }
  }
  const headerMapped = headerIdx >= 0 // a real header names at least 3 known columns

  if (headerMapped) {
    const rows = lines.slice(headerIdx + 1).map((cells) => {
      const row: ParsedRow = {}
      mapped.forEach((key, i) => { const v = cells[i]?.trim(); if (key && v) row[key] = v })
      return row
    })
    return { rows, headerMapped: true }
  }

  // Positional fallback: clientAssetId, description, category, make, model, serial, barcode, location, custodian
  return {
    rows: lines.map((cells) => {
      const row: ParsedRow = {}
      POSITIONAL_KEYS.forEach((k, i) => { const v = cells[i]?.trim(); if (v) row[k] = v })
      return row
    }),
    headerMapped: false,
  }
}

/** Parse register text (CSV) → rows. First row is treated as a header when its
 *  cells map to known column aliases; otherwise positional order is assumed. */
export function parseRegister(text: string): { rows: ParsedRow[]; headerMapped: boolean } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length)
  return parseGrid(lines.map(splitCsvLine))
}

export type SheetCell = string | number | boolean | null | undefined

/** Parse worksheet rows (SheetJS `sheet_to_json(ws, { header: 1 })` shape) →
 *  register rows. Numbers (Excel stores amounts/years as numbers) are stringified. */
export function parseSheetRows(cells: SheetCell[][]): { rows: ParsedRow[]; headerMapped: boolean } {
  return parseGrid(cells.map((row) => row.map((c) => (c === null || c === undefined ? '' : String(c)))))
}
