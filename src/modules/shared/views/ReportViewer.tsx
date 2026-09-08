'use client'

/**
 * ReportViewer — the FULL report, rendered in-app.
 *
 * Generated report rows used to be version stubs with nothing to open; this
 * viewer computes the actual document live from audit data: executive summary,
 * per-result verification breakdown, the DEPRECIATION & VALUATION schedule
 * (WDV), the exception register and a sign-off block. Includes CSV export of
 * the valuation schedule and browser printing.
 */

import React, { useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Download, Printer, ShieldCheck, TriangleAlert, Camera, Users, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useES } from '../store'
import { buildReportDoc, RESULT_LABELS } from '../report-data'
import { inr } from '@/lib/depreciation'
import { fmtDateTime } from '../format'
import type { Report } from '../types'

const sevTone: Record<string, string> = {
  low: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  high: 'bg-orange-50 text-orange-700 ring-orange-200',
  critical: 'bg-red-50 text-red-700 ring-red-200',
}

function Section({ n, title, icon, children }: { n: number; title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-7 first-of-type:mt-4">
      <h3 className="flex items-center gap-2 border-b border-zinc-200 pb-1.5 text-[13px] font-bold uppercase tracking-wider text-zinc-500">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-900 text-[10px] font-bold text-white">{n}</span>
        {icon}
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">{label}</div>
      <div className={cn('mt-1 text-lg font-bold tabular-nums text-zinc-900', tone)}>{value}</div>
    </div>
  )
}

export function ReportViewer({ report, open, onOpenChange }: { report: Report | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { world } = useES()
  const doc = useMemo(
    () => (open && report && world ? buildReportDoc(world, report) : null),
    [open, report, world],
  )

  const exportCsv = () => {
    if (!doc) return
    const rows: (string | number)[][] = [
      ['Asset code', 'Client asset id', 'Description', 'Category', 'Purchase date', 'Cost (INR)', 'WDV rate %', 'Years held', 'Accumulated depreciation (INR)', 'Net book value (INR)', 'Declared value (INR)', 'Variance (INR)', 'Condition', 'Location'],
      ...doc.schedule.map((l) => [
        l.asset.code, l.asset.clientAssetId, l.asset.description, l.asset.category,
        l.asset.purchaseDate ? l.asset.purchaseDate.slice(0, 10) : '',
        l.inScope ? l.cost : '', l.inScope ? Math.round(l.rate * 100) : '',
        l.inScope ? l.yearsElapsed : '', l.inScope ? l.accumulatedDepreciation : '',
        l.inScope ? l.netBookValue : '', l.declaredValue ?? '', l.variance ?? '',
        l.asset.condition ?? '', l.asset.locationPath ?? '',
      ]),
      [],
      ['TOTALS', '', '', '', '', doc.valuation.totalCost, '', '', doc.valuation.totalAccumulated, doc.valuation.totalNBV, doc.valuation.totalDeclared, doc.valuation.totalVariance, '', ''],
    ]
    const csv = rows.map((r) => r.map((c) => (typeof c === 'string' && /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.header.code}-valuation-schedule.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Valuation schedule exported', { description: `${doc.valuation.assetsValued} valued assets · opens in Excel` })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[min(1080px,96vw)] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1080px] sm:rounded-2xl">
        {doc && report && (
          <>
            {/* Report masthead */}
            <DialogHeader className="border-b border-zinc-200 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 px-6 py-5 text-left">
              <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                <div>
                  <DialogTitle className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-zinc-900">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900"><FileText className="h-4 w-4 text-white" /></span>
                    {doc.header.auditName}
                  </DialogTitle>
                  <p className="mt-1 text-[12.5px] text-zinc-500">
                    {doc.header.code} · {doc.header.clientName} ({doc.header.clientCode}) · {doc.header.auditType} · FY {doc.header.financialYear}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {doc.header.periodStart ? `Period: ${doc.header.periodStart.slice(0, 10)} → ${doc.header.periodEnd?.slice(0, 10) ?? 'open'}` : null} · Values as of {doc.header.asOf.slice(0, 10)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('rounded-full px-2.5 py-1 text-[10.5px] font-bold',
                    doc.header.version === 'Final' ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800')}>
                    {doc.header.version} · {doc.header.status}
                  </span>
                  <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Print</Button>
                </div>
              </div>
            </DialogHeader>

            {/* Report body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <Section n={1} title="Executive summary">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                  <Stat label="Assets in scope" value={String(doc.summary.inScope)} />
                  <Stat label="Field verified" value={`${doc.summary.verified} (${doc.summary.verifiedPct}%)`} tone="text-emerald-700" />
                  <Stat label="Match rate" value={`${doc.summary.matchRate}%`} tone={doc.summary.matchRate >= 90 ? 'text-emerald-700' : 'text-amber-700'} />
                  <Stat label="Open exceptions" value={String(doc.summary.openExceptions)} tone={doc.summary.openExceptions ? 'text-orange-600' : 'text-emerald-700'} />
                  <Stat label="Evidence photos" value={String(doc.summary.photos)} />
                  <Stat label="Field team" value={String(doc.summary.auditorsEngaged.length)} />
                </div>
                {doc.summary.auditorsEngaged.length > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] text-zinc-500"><Users className="h-3.5 w-3.5" /> {doc.summary.auditorsEngaged.join(', ')}</p>
                )}
              </Section>

              <Section n={2} title="Verification results breakdown">
                {doc.summary.byResult.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-[13px] text-zinc-400">No verifications synced for this audit yet — the breakdown fills in as the field team works.</p>
                ) : (
                  <div className="space-y-1.5">
                    {doc.summary.byResult.map(({ result, count }) => {
                      const pct = Math.round((count / doc.summary.verified) * 100)
                      return (
                        <div key={result} className="flex items-center gap-3">
                          <span className="w-44 shrink-0 truncate text-[12.5px] font-medium text-zinc-600">{RESULT_LABELS[result] ?? result}</span>
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                            <div className={cn('h-full rounded-full', result === 'matched' ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${Math.max(3, pct)}%` }} />
                          </div>
                          <span className="w-16 text-right text-[12px] font-semibold tabular-nums text-zinc-700">{count} · {pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>

              <Section n={3} title="Depreciation & valuation — written-down value method" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                  <Stat label="Gross block" value={inr(doc.valuation.totalCost)} />
                  <Stat label="Accumulated dep." value={inr(doc.valuation.totalAccumulated)} />
                  <Stat label="Net book value" value={inr(doc.valuation.totalNBV)} tone="text-emerald-700" />
                  <Stat label="Declared value" value={inr(doc.valuation.totalDeclared)} />
                  <Stat label="Variance" value={inr(doc.valuation.totalVariance)} tone={Math.abs(doc.valuation.totalVariance) > 1 ? 'text-orange-600' : 'text-zinc-500'} />
                  <Stat label="Assets valued" value={`${doc.valuation.assetsValued}${doc.valuation.assetsMissingData ? ` (+${doc.valuation.assetsMissingData} no data)` : ''}`} />
                </div>
                <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-zinc-200">
                  <table className="w-full min-w-[860px] border-collapse text-[12px]">
                    <thead className="sticky top-0 bg-zinc-50 text-left text-[10.5px] font-bold uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-2.5 py-2">Asset</th>
                        <th className="px-2.5 py-2">Category</th>
                        <th className="px-2.5 py-2">Purchased</th>
                        <th className="px-2.5 py-2 text-right">Cost</th>
                        <th className="px-2.5 py-2 text-right">Rate</th>
                        <th className="px-2.5 py-2 text-right">Yrs</th>
                        <th className="px-2.5 py-2 text-right">Accum. dep.</th>
                        <th className="px-2.5 py-2 text-right">NBV</th>
                        <th className="px-2.5 py-2 text-right">Declared</th>
                        <th className="px-2.5 py-2 text-right">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {doc.schedule.map((l) => (
                        <tr key={l.asset.id} className={cn('hover:bg-zinc-50/70', !l.inScope && 'bg-zinc-50/40 text-zinc-400')}>
                          <td className="px-2.5 py-1.5">
                            <div className="font-mono text-[11px] font-semibold text-zinc-800">{l.asset.code}</div>
                            <div className="max-w-[220px] truncate text-[11px] text-zinc-500">{l.asset.description}</div>
                          </td>
                          <td className="px-2.5 py-1.5">{l.asset.category}</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5 tabular-nums">{l.asset.purchaseDate ? l.asset.purchaseDate.slice(0, 10) : '—'}</td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums">{l.inScope ? inr(l.cost) : '—'}</td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums">{l.inScope ? `${Math.round(l.rate * 100)}%` : '—'}</td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums">{l.inScope ? l.yearsElapsed : '—'}</td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums">{l.inScope ? inr(l.accumulatedDepreciation) : '—'}</td>
                          <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-zinc-800">{l.inScope ? inr(l.netBookValue) : '—'}</td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums">{l.declaredValue != null ? inr(l.declaredValue) : '—'}</td>
                          <td className={cn('px-2.5 py-1.5 text-right tabular-nums', l.variance !== null && Math.abs(l.variance) > 1 ? 'font-semibold text-orange-600' : 'text-zinc-400')}>
                            {l.variance !== null ? inr(l.variance) : '—'}
                          </td>
                        </tr>
                      ))}
                      {doc.schedule.length === 0 && (
                        <tr><td colSpan={10} className="px-3 py-8 text-center text-zinc-400">No assets linked to this audit yet.</td></tr>
                      )}
                    </tbody>
                    {doc.valuation.assetsValued > 0 && (
                      <tfoot className="border-t-2 border-zinc-300 bg-zinc-50 font-semibold tabular-nums text-zinc-800">
                        <tr>
                          <td className="px-2.5 py-2" colSpan={3}>Totals — {doc.valuation.assetsValued} valued assets</td>
                          <td className="px-2.5 py-2 text-right">{inr(doc.valuation.totalCost)}</td>
                          <td colSpan={3} />
                          <td className="px-2.5 py-2 text-right">{inr(doc.valuation.totalNBV)}</td>
                          <td className="px-2.5 py-2 text-right">{inr(doc.valuation.totalDeclared)}</td>
                          <td className="px-2.5 py-2 text-right">{inr(doc.valuation.totalVariance)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                {doc.notes.map((n, i) => (
                  <p key={i} className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 ring-1 ring-inset ring-amber-200">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {n}
                  </p>
                ))}
              </Section>

              <Section n={4} title="Exception register" icon={<TriangleAlert className="h-3.5 w-3.5" />}>
                {doc.exceptions.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-[13px] text-zinc-400">No exceptions raised — a clean sweep.</p>
                ) : (
                  <div className="max-h-72 space-y-1.5 overflow-auto pr-1">
                    {doc.exceptions.map((e) => (
                      <div key={e.code} className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2">
                        <span className="font-mono text-[11px] font-semibold text-zinc-500">{e.code}</span>
                        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset', sevTone[e.severity] ?? sevTone.medium)}>{e.severity}</span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-zinc-700">{e.title}</span>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium capitalize text-zinc-500">{e.status}</span>
                        <span className="hidden text-[11px] text-zinc-400 sm:block">{e.detectedAt.slice(0, 10)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section n={5} title="Sign-off">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3">
                  <div className="text-[12px] text-zinc-500">
                    Prepared by <b className="text-zinc-800">{doc.header.generatedBy}</b> · {fmtDateTime(doc.header.generatedAt)}
                    <br />Basis: WDV per Companies Act 2013 block rates · salvage floor 5% · values as of {doc.header.asOf.slice(0, 10)}
                  </div>
                  {doc.header.status === 'final' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white"><ShieldCheck className="h-3.5 w-3.5" /> Frozen as Final</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-bold text-amber-800"><Camera className="h-3.5 w-3.5" /> Draft values — regenerate after field work</span>
                  )}
                </div>
              </Section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
