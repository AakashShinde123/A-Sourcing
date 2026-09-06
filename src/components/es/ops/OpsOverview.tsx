'use client'

import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, PieChart, Pie, Legend } from 'recharts'
import { ClipboardCheck, Boxes, ShieldAlert, Users, Radar } from 'lucide-react'
import { useES } from '../store'
import { Kpi, Bar as ProgressBar, SectionHeader, MicroLabel, Avatar, Pill, EmptyState } from '../ui-bits'
import { auditStatusMeta, resultMeta, exceptionStatusMeta, severityMeta, fmtDateShort, fmtDateTime } from '@/lib/es-format'

const RESULT_COLORS: Record<string, string> = {
  matched: '#10b981', missing: '#ef4444', location_mismatch: '#f59e0b',
  custodian_mismatch: '#f97316', serial_mismatch: '#f43f5e',
  condition_exception: '#71717a', unregistered: '#14b8a6',
}

export function OpsOverview() {
  const { world, setOpsView, openAudit } = useES()
  const stats = world?.stats
  const audits = world?.audits ?? []
  const exceptions = world?.exceptions ?? []
  const auditors = world?.auditors ?? []

  const active = useMemo(() => audits.filter((a) => ['in_progress', 'field_complete', 'review', 'client_review'].includes(a.status)), [audits])
  const hero = active.find((a) => a.status === 'in_progress') ?? active[0]
  const donut = useMemo(() => {
    if (!hero) return []
    return Object.entries(hero.byResult).map(([k, v]) => ({ name: resultMeta[k]?.label ?? k, key: k, value: v }))
  }, [hero])

  const recentEx = useMemo(() => exceptions.filter((e) => !['closed'].includes(e.status)).slice(0, 6), [exceptions])

  if (!world || !stats) return null

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Kpi label="Active Audits" value={stats.activeAudits} icon={<ClipboardCheck className="h-4 w-4" />} tone="emerald" onClick={() => setOpsView('audits')} sub="across 3 clients" />
        <Kpi label="Assets Registered" value={stats.assetsRegistered.toLocaleString('en-IN')} icon={<Boxes className="h-4 w-4" />} tone="default" onClick={() => setOpsView('assets')} sub={`${stats.assetsVerified} field-verified`} />
        <Kpi label="Match Rate" value={`${stats.matchRate}%`} icon={<Radar className="h-4 w-4" />} tone="teal" sub="register vs physical" />
        <Kpi label="Open Exceptions" value={stats.openExceptions} icon={<ShieldAlert className="h-4 w-4" />} tone="red" onClick={() => setOpsView('exceptions')} sub="awaiting resolution" />
        <Kpi label="Auditors in Field" value={stats.inFieldAuditors} icon={<Users className="h-4 w-4" />} tone="amber" onClick={() => setOpsView('team')} sub="live right now" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Trend */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] xl:col-span-2">
          <SectionHeader title="Field verification activity" sub="Daily verifications synced from the field · last 14 days" />
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.verificationTrend} barCategoryGap="28%">
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#a1a1aa' }} interval={1} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#a1a1aa' }} allowDecimals={false} width={24} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ borderRadius: 10, border: '1px solid #e4e4e7', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v: number, name: string) => [v, name]} />
                <Bar dataKey="matched" name="Matched" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="exceptions" name="Exceptions raised" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reconciliation donut for hero audit */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <SectionHeader title="Reconciliation snapshot" sub={hero ? `${hero.code} · ${hero.name}` : '—'} />
          {hero && donut.length > 0 ? (
            <div className="mt-2 flex h-56 flex-col">
              <div className="relative h-[75%]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donut} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} strokeWidth={0}>
                      {donut.map((d) => <Cell key={d.key} fill={RESULT_COLORS[d.key] ?? '#a1a1aa'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e4e4e7', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-semibold tabular-nums text-zinc-900">{hero.progress}%</span>
                  <span className="text-[10px] uppercase tracking-wide text-zinc-400">verified</span>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {donut.map((d) => (
                  <span key={d.key} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600">
                    <span className="h-2 w-2 rounded-full" style={{ background: RESULT_COLORS[d.key] }} />{d.name} · {d.value}
                  </span>
                ))}
              </div>
            </div>
          ) : <EmptyState title="No active audit in progress" />}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Active audits */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] xl:col-span-2">
          <SectionHeader title="Audit projects in flight" sub="Live progress across all clients" right={
            <button onClick={() => setOpsView('audits')} className="text-[13px] font-medium text-emerald-700 hover:text-emerald-800">View all →</button>
          } />
          <div className="mt-3 divide-y divide-zinc-100">
            {active.map((a) => {
              const client = world.clients.find((c) => c.id === a.clientId)
              return (
                <button key={a.id} onClick={() => { openAudit(a.id); setOpsView('audits') }}
                  className="flex w-full items-center gap-4 py-3 text-left transition hover:bg-zinc-50/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-zinc-900">{a.name}</span>
                      <Pill meta={auditStatusMeta[a.status]} size="xs" />
                    </div>
                    <div className="mt-0.5 truncate text-xs text-zinc-400">{client?.name} · {a.locationsLabel}</div>
                  </div>
                  <div className="hidden w-40 shrink-0 sm:block">
                    <div className="mb-1 flex justify-between text-[11px] text-zinc-500 tabular-nums">
                      <span>{a.verifiedAssets}/{a.totalInScope} assets</span><span>{a.progress}%</span>
                    </div>
                    <ProgressBar value={a.progress} barClass={a.status === 'client_review' ? 'bg-orange-500' : undefined} />
                  </div>
                  <div className="w-14 shrink-0 text-right">
                    <span className={`text-[13px] font-semibold tabular-nums ${a.openExceptions > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{a.openExceptions}</span>
                    <div className="text-[10px] text-zinc-400">exceptions</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Exception feed */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <SectionHeader title="Exception feed" sub="Highest severity first" right={
            <button onClick={() => setOpsView('exceptions')} className="text-[13px] font-medium text-emerald-700 hover:text-emerald-800">Center →</button>
          } />
          <div className="mt-3 space-y-2.5">
            {recentEx.length === 0 && <EmptyState title="No open exceptions" />}
            {recentEx.map((e) => (
              <div key={e.id} className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-zinc-400">{e.code}</span>
                  <div className="flex items-center gap-1.5">
                    <SimpleBadgeIf label={severityMeta[e.severity]?.label ?? e.severity} cls={severityMeta[e.severity]?.cls ?? ''} />
                  </div>
                </div>
                <div className="mt-1 line-clamp-1 text-xs font-medium text-zinc-800">{e.title}</div>
                <div className="mt-1 flex items-center justify-between">
                  <Pill meta={exceptionStatusMeta[e.status] ?? exceptionStatusMeta.open} size="xs" />
                  <span className="text-[10px] text-zinc-400">{fmtDateShort(e.detectedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Auditor strip */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <SectionHeader title="Field team status" sub="Sync telemetry from auditor devices" right={
          <button onClick={() => setOpsView('team')} className="text-[13px] font-medium text-emerald-700 hover:text-emerald-800">Manage team →</button>
        } />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {auditors.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 rounded-lg border border-zinc-100 p-2.5">
              <Avatar name={a.name} seed={a.colorSeed} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-zinc-800">{a.name}</div>
                <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <span className={`h-1.5 w-1.5 rounded-full ${a.status === 'in_field' ? 'bg-emerald-500' : a.status === 'available' ? 'bg-amber-500' : 'bg-zinc-300'}`} />
                  {a.status === 'in_field' ? 'In field' : a.status === 'available' ? 'Available' : 'Offline'} · {a.lastSyncAt ? `synced ${fmtDateTime(a.lastSyncAt)}` : 'no sync yet'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SimpleBadgeIf({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${cls}`}>{label}</span>
}
