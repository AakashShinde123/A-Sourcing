/**
 * @es/depreciation — asset valuation & depreciation engine.
 *
 * Pure domain rules (no I/O) shared by the Report Builder and unit tests.
 *
 * Method: Written-Down Value (WDV / declining balance) — the default basis for
 * block-of-assets depreciation under the Indian Companies Act 2013 and Income
 * Tax rules. Each category carries a standard annual rate; pro-rata from the
 * purchase date; NBV never drops below a 5 % salvage floor.
 *
 * When the client's register declares a book value (`currentValue`), both
 * figures are reported side by side so the audit can flag variance — that
 * comparison is exactly what a physical-verification engagement is for.
 */

/** Standard annual WDV depreciation rates keyed by category keyword. */
export const DEPRECIATION_RATES: { match: RegExp; rate: number; label: string }[] = [
  { match: /comput|it\s|laptop|desktop|server|printer|scanner|network|software/i, rate: 0.40, label: 'IT & Computing equipment' },
  { match: /lab|scientific|medical|test(ing)? equip/i, rate: 0.20, label: 'Laboratory & scientific equipment' },
  { match: /machin|plant|production|cnc|press|loom|pump|compressor|furnace/i, rate: 0.15, label: 'Machinery & plant' },
  { match: /electric|motor|generator|panel|transformer|ups|battery/i, rate: 0.15, label: 'Electrical installations' },
  { match: /vehicle|car|truck|van|bike|forklift|trolley|tractor/i, rate: 0.15, label: 'Vehicles' },
  { match: /furniture|fixture|chair|table|desk|cupboard|shelf|rack/i, rate: 0.10, label: 'Furniture & fixtures' },
  { match: /office equip|ac\b|air.?condition|refrigerat|water cooler|printer/i, rate: 0.15, label: 'Office equipment' },
  { match: /build|shed|construction|structure/i, rate: 0.05, label: 'Buildings & structures' },
]

/** Salvage floor — NBV never falls below this share of original cost. */
export const SALVAGE_FLOOR = 0.05

/** Default rate when no category rule matches (general plant & machinery block). */
export const DEFAULT_RATE = 0.15

export function rateFor(category: string): number {
  for (const r of DEPRECIATION_RATES) if (r.match.test(category)) return r.rate
  return DEFAULT_RATE
}

export interface DepreciationInput {
  purchaseCost: number | null
  purchaseDate: string | null
  category: string
  /** Declared book value from the client's register (₹) — compared, not trusted. */
  currentValue?: number | null
}

export interface DepreciationLine {
  method: 'WDV'
  rate: number                      // annual WDV rate, e.g. 0.15
  yearsElapsed: number              // fractional years from purchase to as-of
  cost: number                      // original purchase cost
  accumulatedDepreciation: number   // cost × (1-rate)^years, salvaged
  netBookValue: number              // cost − accumulated
  declaredValue: number | null      // currentValue if the register carried one
  variance: number | null           // declared − NBV (positive = understated schedule)
  inScope: boolean                  // true when cost & date both known
}

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000

/**
 * One valuation line for an asset, as of `asOf`. Assets without cost or date
 * still return a line (inScope: false, zeros) so schedules can report data gaps
 * instead of silently dropping rows.
 */
export function depreciationFor(asset: DepreciationInput, asOf: Date): DepreciationLine {
  const cost = asset.purchaseCost ?? null
  const date = asset.purchaseDate ? new Date(asset.purchaseDate) : null
  if (cost === null || cost <= 0 || !date || Number.isNaN(date.getTime())) {
    const declared = asset.currentValue ?? null
    return {
      method: 'WDV', rate: 0, yearsElapsed: 0, cost: cost ?? 0,
      accumulatedDepreciation: 0, netBookValue: 0, declaredValue: declared, variance: null, inScope: false,
    }
  }
  const rate = rateFor(asset.category)
  const years = Math.max(0, (asOf.getTime() - date.getTime()) / MS_PER_YEAR)
  const floor = cost * SALVAGE_FLOOR
  const raw = cost * Math.pow(1 - rate, years)
  const nbv = Math.max(floor, raw)
  const accumulated = cost - nbv
  const declared = asset.currentValue ?? null
  return {
    method: 'WDV',
    rate,
    yearsElapsed: Math.round(years * 100) / 100,
    cost,
    accumulatedDepreciation: Math.round(accumulated * 100) / 100,
    netBookValue: Math.round(nbv * 100) / 100,
    declaredValue: declared,
    variance: declared === null ? null : Math.round((declared - nbv) * 100) / 100,
    inScope: true,
  }
}

export interface ValuationTotals {
  lines: DepreciationLine[]
  assetsValued: number
  assetsMissingData: number
  totalCost: number
  totalAccumulated: number
  totalNBV: number
  totalDeclared: number
  totalVariance: number
}

/** Totals for a schedule — missing-data assets are counted, never summed. */
export function valuationTotals(lines: DepreciationLine[]): ValuationTotals {
  let totalCost = 0, totalAccumulated = 0, totalNBV = 0, totalDeclared = 0, totalVariance = 0
  let assetsValued = 0, assetsMissingData = 0
  for (const l of lines) {
    if (!l.inScope) { assetsMissingData++; continue }
    assetsValued++
    totalCost += l.cost
    totalAccumulated += l.accumulatedDepreciation
    totalNBV += l.netBookValue
    if (l.declaredValue !== null) { totalDeclared += l.declaredValue; totalVariance += l.variance ?? 0 }
  }
  const r2 = (n: number) => Math.round(n * 100) / 100
  return {
    lines,
    assetsValued,
    assetsMissingData,
    totalCost: r2(totalCost),
    totalAccumulated: r2(totalAccumulated),
    totalNBV: r2(totalNBV),
    totalDeclared: r2(totalDeclared),
    totalVariance: r2(totalVariance),
  }
}

/** ₹ formatting used across the report viewer and CSV export. */
export function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}
