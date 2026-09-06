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

/** Parse register text (CSV) → rows. First row is treated as a header when its
 *  cells map to known column aliases; otherwise positional order is assumed. */
export function parseRegister(text: string): { rows: ParsedRow[]; headerMapped: boolean } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length)
  if (!lines.length) return { rows: [], headerMapped: false }

  const headerCells = splitCsvLine(lines[0]).map((c) => c.toLowerCase().replace(/[^a-z ]/g, '').trim())
  const mapped = headerCells.map((c) => HEADER_ALIASES[c.replace(/ /g, '')] ?? HEADER_ALIASES[c] ?? null)
  const headerMapped = mapped.filter(Boolean).length >= 3 // a real header names at least 3 known columns

  if (headerMapped) {
    const rows = lines.slice(1).map((line) => {
      const cells = splitCsvLine(line)
      const row: ParsedRow = {}
      mapped.forEach((key, i) => { if (key && cells[i]) row[key] = cells[i] })
      return row
    })
    return { rows, headerMapped: true }
  }

  // Positional fallback: clientAssetId, description, category, make, model, serial, barcode, location, custodian
  const keys: (keyof ParsedRow)[] = ['clientAssetId', 'description', 'category', 'make', 'model', 'serialNumber', 'barcode', 'locationLabel', 'custodian']
  return {
    rows: lines.map((line) => {
      const cells = splitCsvLine(line)
      const row: ParsedRow = {}
      keys.forEach((k, i) => { if (cells[i]) row[k] = cells[i] })
      return row
    }),
    headerMapped: false,
  }
}
