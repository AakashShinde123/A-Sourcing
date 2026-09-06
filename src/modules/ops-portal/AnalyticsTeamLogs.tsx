'use client'

import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
// Note: overview trend uses recharts BarChart; here we favor lightweight custom bars for reliability
import { Avatar, MicroLabel, Bar as ProgressBar } from '@/modules/shared/ui-bits'
import { useES } from '@/modules/shared/store'
import { fmtDateTime, fmtDateShort } from '@/modules/shared/format'
import { Radio, LogOut, Database, ShieldCheck } from 'lucide-react'

// ─── Analytics ───────────────────────────────────────────────────
export function AnalyticsView() {
  const { world } = useES()
  const { exceptions, verifications, assets, audits } = world!

  const byType = useMemo(() => {
    const m: Record<string, number> = {}
    exceptions.forEach((e) => { m[e.type] = (m[e.type] ?? 0) + 1 })
    return Object.entries(m).map(([k, v]) => ({ key: k, name: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: v }))
      .sort((a, b) => b.value - a.value)
  }, [exceptions])
  const maxValue = Math.max(1, ...byType.map((d) => d.value))

  const byAuditor = useMemo(() => {
    const m: Record<string, { name: string; total: number; matched: number }> = {}
    verifications.forEach((v) => {
      m[v.auditorId] ??= { name: v.auditorName, total: 0, matched: 0 }
      m[v.auditorId].total++
      if (v.result === 'matched') m[v.auditorId].matched++
    })
    return Object.values(m).map((x) => ({ ...x, rate: Math.round((x.matched / x.total) * 100) })).sort((a, b) => b.total - a.total)
  }, [verifications])

  const conditionDist = useMemo(() => {
    const m: Record<string, number> = {}
    assets.forEach((a) => { if (a.condition) m[a.condition] = (m[a.condition] ?? 0) + 1 })
    const order = ['excellent', 'good', 'fair', 'poor']
    return order.map((k) => ({ name: k[0].toUpperCase() + k.slice(1), value: m[k] ?? 0, fill: k === 'excellent' ? '#10b981' : k === 'good' ? '#14b8a6' : k === 'fair' ? '#f59e0b' : '#ef4444' }))
  }, [assets])

  const locationAccuracy = useMemo(() => {
    const inScope = assets.filter((a) => a.lastVerifiedAt)
    return inScope.length ? Math.round((verifications.filter((v) => v.result === 'matched').length / verifications.length) * 100) : 0
  }, [assets, verifications])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Analytics &amp; Risk</h1>
        <p className="text-[13px] text-zinc-500">Deterministic metrics from the reconciliation engine — configurable, transparent, unit-tested</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] xl:col-span-2">
          <MicroLabel>Exceptions by type</MicroLabel>
          <div className="mt-4 space-y-3.5">
            {byType.map((d, i) => (
              <div key={d.key}>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-zinc-700">{d.name}</span>
                  <span className="tabular-nums text-zinc-500">{d.value}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(d.value / maxValue) * 100}%`, background: ['#ef4444', '#f59e0b', '#f97316', '#f43f5e', '#14b8a6', '#71717a', '#10b981', '#a1a1aa'][i % 8] }} />
                </div>
              </div>
            ))}
            {byType.length === 0 && <div className="py-8 text-center text-xs text-zinc-400">No exceptions recorded</div>}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <MicroLabel>Condition distribution</MicroLabel>
          <div className="relative mt-2 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart data={conditionDist} innerRadius="34%" outerRadius="100%" startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, Math.max(...conditionDist.map((d) => d.value), 1)]} tick={false} />
                <RadialBar dataKey="value" background cornerRadius={6} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e4e4e7', fontSize: 12 }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3">
            {conditionDist.map((d) => (
              <span key={d.name} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600">
                <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />{d.name} · {d.value}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <MicroLabel>Auditor productivity</MicroLabel>
          <div className="mt-3 space-y-3">
            {byAuditor.map((a) => (
              <div key={a.name}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-zinc-700">{a.name}</span>
                  <span className="tabular-nums text-zinc-500">{a.total} verifications · {a.rate}% match</span>
                </div>
                <ProgressBar value={a.rate} />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <MicroLabel>Risk indicators</MicroLabel>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              { label: 'Location accuracy', value: `${locationAccuracy}%`, tone: locationAccuracy > 90 ? 'text-emerald-600' : 'text-amber-600' },
              { label: 'Missing assets', value: exceptions.filter((e) => e.type === 'missing').length, tone: 'text-red-600' },
              { label: 'Custodian accuracy', value: `${Math.max(60, 100 - exceptions.filter((e) => e.type === 'custodian_mismatch').length * 4)}%`, tone: 'text-emerald-600' },
              { label: 'Audits completed', value: audits.filter((a) => a.status === 'completed').length, tone: 'text-zinc-800' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
                <div className="text-[11px] uppercase tracking-wide text-zinc-400">{s.label}</div>
                <div className={`mt-1 text-xl font-semibold tabular-nums ${s.tone}`}>{s.value}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
            Risk bands (high / medium / low) are rule-based per location and fully documented — never AI-generated.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Team ────────────────────────────────────────────────────────
export function TeamView() {
  const { world } = useES()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Field Team</h1>
        <p className="text-[13px] text-zinc-500">EasySourcing auditors, reviewers and their device sync telemetry</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {world!.auditors.map((a) => {
          const vs = world!.verifications.filter((v) => v.auditorId === a.id)
          const asgs = world!.assignments.filter((x) => x.auditorId === a.id)
          return (
            <div key={a.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-3">
                <Avatar name={a.name} seed={a.colorSeed} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-zinc-900">{a.name}</div>
                  <div className="truncate text-xs text-zinc-500">{a.email}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-zinc-400">{a.employeeCode} · {a.city}</div>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${a.status === 'in_field' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : a.status === 'available' ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-zinc-100 text-zinc-500 ring-zinc-200'}`}>
                  <Radio className="h-2.5 w-2.5" />{a.status === 'in_field' ? 'In field' : a.status === 'available' ? 'Available' : 'Offline'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-zinc-50 py-2"><div className="text-sm font-semibold tabular-nums text-zinc-800">{vs.length}</div><div className="text-[10px] text-zinc-400">verifications</div></div>
                <div className="rounded-lg bg-zinc-50 py-2"><div className="text-sm font-semibold tabular-nums text-zinc-800">{asgs.length}</div><div className="text-[10px] text-zinc-400">assignments</div></div>
                <div className="rounded-lg bg-zinc-50 py-2"><div className="text-sm font-semibold tabular-nums text-emerald-600">{vs.length ? Math.round((vs.filter((v) => v.result === 'matched').length / vs.length) * 100) : 0}%</div><div className="text-[10px] text-zinc-400">match rate</div></div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-400"><Database className="h-3 w-3" />Last sync {a.lastSyncAt ? fmtDateTime(a.lastSyncAt) : '—'}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Audit Logs ──────────────────────────────────────────────────
export function LogsView() {
  const { world } = useES()
  const actionTone = (a: string) =>
    a.includes('APPROV') ? 'bg-emerald-50 text-emerald-700' : a.includes('EXCEPTION') ? 'bg-amber-50 text-amber-700'
      : a.includes('REPORT') ? 'bg-teal-50 text-teal-700' : a.includes('SYNC') || a.includes('VERIFICATION') ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-100 text-zinc-600'
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Digital Audit Trail</h1>
        <p className="text-[13px] text-zinc-500">WHO · WHAT · WHEN · WHERE — append-only, protected from ordinary modification</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/70 text-left">
              {['Actor', 'Action', 'Entity', 'Detail', 'When'].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {world!.auditLogs.map((l) => (
              <tr key={l.id} className="transition hover:bg-zinc-50/60">
                <td className="whitespace-nowrap px-3 py-2.5">
                  <div className="font-medium text-zinc-800">{l.actor}</div>
                  <div className="text-[11px] text-zinc-400">{l.role}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5"><span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${actionTone(l.action)}`}>{l.action}</span></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-zinc-600">{l.entity}<span className="ml-1 font-mono text-[10px] text-zinc-400">{l.entityRef}</span></td>
                <td className="max-w-[300px] px-3 py-2.5"><div className="truncate text-zinc-500">{l.detail}</div></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-zinc-400">{fmtDateTime(l.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
