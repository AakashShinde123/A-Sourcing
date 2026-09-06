'use client'

import React, { useMemo, useState } from 'react'
import { Building2, MapPin, ChevronRight, ChevronDown, Factory, Landmark, Warehouse, DoorOpen, Layers, Grid3X3, Boxes, ImageIcon, FileText, History } from 'lucide-react'
import { useES } from '@/modules/shared/store'
import { Avatar, Pill, EvidenceThumb, EmptyState, MicroLabel, Bar as ProgressBar } from '@/modules/shared/ui-bits'
import { fmtDate, fmtDateTime, auditStatusMeta } from '@/modules/shared/format'

// ─── Clients ─────────────────────────────────────────────────────
export function ClientsView() {
  const { world, setClientIdentityId, setSurface } = useES()
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Clients</h1>
        <p className="text-[13px] text-zinc-500">{world!.clients.length} organizations under EasySourcing operations</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {world!.clients.map((c) => {
          const assets = world!.assets.filter((a) => a.clientId === c.id).length
          const audits = world!.audits.filter((a) => a.clientId === c.id)
          const open = openId === c.id
          return (
            <div key={c.id} className="rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpenId(open ? null : c.id)}>
                <Avatar name={c.name} seed={c.colorSeed} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[15px] font-semibold text-zinc-900">{c.name}</h3>
                    <Pill size="xs" meta={c.status === 'active' ? { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' } : { label: 'Onboarding', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' }} />
                  </div>
                  <p className="truncate text-xs text-zinc-500">{c.industry} · {c.city} · since {fmtDate(c.since)}</p>
                </div>
                <div className="hidden shrink-0 gap-6 text-right sm:flex">
                  <div><div className="text-sm font-semibold tabular-nums text-zinc-900">{assets}</div><div className="text-[10px] uppercase tracking-wide text-zinc-400">assets</div></div>
                  <div><div className="text-sm font-semibold tabular-nums text-zinc-900">{audits.length}</div><div className="text-[10px] uppercase tracking-wide text-zinc-400">audits</div></div>
                </div>
                {open ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
              </button>
              {open && (
                <div className="border-t border-zinc-100 px-4 py-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <MicroLabel>Primary contact</MicroLabel>
                      <div className="mt-1 text-[13px] text-zinc-700">{c.contact}</div>
                      <div className="text-xs text-zinc-400">{c.email} · {c.phone}</div>
                      <MicroLabel className="mt-3">Portal users</MicroLabel>
                      {c.users.map((u) => (
                        <div key={u.id} className="mt-1 flex items-center gap-2 text-[13px]">
                          <Avatar name={u.name} seed={c.colorSeed} size="sm" />
                          <span className="text-zinc-700">{u.name}</span>
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">{u.role}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <MicroLabel>Recent audits</MicroLabel>
                      <div className="mt-1 space-y-1.5">
                        {audits.slice(0, 3).map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-2 text-[13px]">
                            <span className="truncate text-zinc-600">{a.name}</span>
                            <Pill meta={auditStatusMeta[a.status]} size="xs" />
                          </div>
                        ))}
                        {audits.length === 0 && <div className="text-xs text-zinc-400">No audits yet</div>}
                      </div>
                      <button
                        onClick={() => { setClientIdentityId(c.id); setSurface('client') }}
                        className="mt-4 w-full rounded-lg bg-zinc-900 px-3 py-2 text-[13px] font-medium text-white transition hover:bg-zinc-800">
                        Open {c.code} Client Portal →
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Location hierarchy ──────────────────────────────────────────
const LEVEL_ICON: Record<string, React.ReactNode> = {
  site: <Factory className="h-4 w-4" />, building: <Landmark className="h-4 w-4" />,
  floor: <Layers className="h-4 w-4" />, zone: <Grid3X3 className="h-4 w-4" />,
  department: <Boxes className="h-4 w-4" />, room: <DoorOpen className="h-4 w-4" />,
}

export function LocationsView({ clientIdScope }: { clientIdScope?: string }) {
  const { world, setOpsView } = useES()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const locs = useMemo(
    () => (clientIdScope ? world!.locations.filter((l) => l.clientId === clientIdScope) : world!.locations),
    [world, clientIdScope],
  )
  const roots = locs.filter((l) => !l.parentId)
  const childrenOf = (id: string) => locs.filter((l) => l.parentId === id)
  const assetsAt = (id: string) => world!.assets.filter((a) => a.locationId === id).length
  const toggle = (id: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const renderNode = (l: (typeof locs)[number], depth: number): React.ReactNode => {
    const kids = childrenOf(l.id)
    const isCollapsed = collapsed.has(l.id)
    return (
      <div key={l.id}>
        <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-zinc-50" style={{ marginLeft: depth * 20 }}>
          {kids.length > 0 ? (
            <button onClick={() => toggle(l.id)} className="text-zinc-400 hover:text-zinc-600">{isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button>
          ) : <span className="w-3.5" />}
          <span className="text-zinc-400">{LEVEL_ICON[l.level]}</span>
          <button onClick={() => setOpsView('assets')} className="min-w-0 flex-1 text-left">
            <span className="text-[13px] font-medium text-zinc-800 group-hover:text-emerald-700">{l.name}</span>
            <span className="ml-2 font-mono text-[10px] text-zinc-400">{l.code}</span>
          </button>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium tabular-nums text-zinc-500">{assetsAt(l.id)} assets</span>
        </div>
        {!isCollapsed && kids.map((k) => renderNode(k, depth + 1))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Location Hierarchy</h1>
        <p className="text-[13px] text-zinc-500">Client → Site → Building → Floor → Zone → Department → Room → Asset</p>
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        {roots.map((r) => {
          const client = world!.clients.find((c) => c.id === r.clientId)
          return (
            <div key={r.id} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="mb-2 flex items-center gap-2 border-b border-zinc-100 pb-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <div>
                  <div className="text-[13px] font-semibold text-zinc-800">{r.name}</div>
                  <div className="text-[11px] text-zinc-400">{client?.name}{r.address ? ` · ${r.address}` : ''}</div>
                </div>
              </div>
              {childrenOf(r.id).map((c) => renderNode(c, 0))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Evidence Center ─────────────────────────────────────────────
export function EvidenceView({ clientIdScope }: { clientIdScope?: string }) {
  const { world } = useES()
  const [auditF, setAuditF] = useState('all')
  const evidence = useMemo(
    () => (clientIdScope ? world!.evidence.filter((e) => e.clientId === clientIdScope) : world!.evidence)
      .filter((e) => auditF === 'all' || e.auditId === auditF),
    [world, clientIdScope, auditF],
  )
  const auditLabel = (id: string | null) => world!.audits.find((a) => a.id === id)?.code ?? '—'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Evidence Center</h1>
          <p className="text-[13px] text-zinc-500">{evidence.length} items · every photo stays linked to its originating verification</p>
        </div>
        <div className="flex gap-2">
          <select value={auditF} onChange={(e) => setAuditF(e.target.value)} className="h-9 rounded-md border border-zinc-200 bg-white px-2.5 text-[13px] text-zinc-700">
            <option value="all">All audits</option>
            {world!.audits.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </div>
      </div>
      {evidence.length === 0 ? <EmptyState icon={<ImageIcon className="h-8 w-8" />} title="No evidence" /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {evidence.slice(0, 36).map((e) => (
            <div key={e.id} className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:shadow-md">
              <EvidenceThumb seed={e.colorSeed} code={e.assetCode} kind={e.kind} className="rounded-none" />
              <div className="p-2">
                <div className="truncate text-[11px] font-medium text-zinc-700">{e.label}</div>
                <div className="truncate text-[10px] text-zinc-400">{auditLabel(e.auditId)} · {e.capturedBy}</div>
                <div className="text-[10px] text-zinc-300">{fmtDateTime(e.capturedAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Reports ─────────────────────────────────────────────────────
export function ReportsView({ clientIdScope }: { clientIdScope?: string }) {
  const { world, generateReport, finalizeReport } = useES()
  const reports = useMemo(
    () => (clientIdScope ? world!.reports.filter((r) => r.clientId === clientIdScope) : world!.reports),
    [world, clientIdScope],
  )
  const versionTone = (v: string) => v === 'Final' ? 'bg-emerald-600 text-white' : v === 'Draft' ? 'bg-zinc-200 text-zinc-600' : 'bg-amber-100 text-amber-800'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Reports</h1>
        <p className="text-[13px] text-zinc-500">Consulting-grade deliverables · Draft → v1 → v2 → Final, then frozen</p>
      </div>
      <div className="space-y-3">
        {reports.map((r) => {
          const audit = world!.audits.find((a) => a.id === r.auditId)
          const client = world!.clients.find((c) => c.id === r.clientId)
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900"><FileText className="h-5 w-5 text-white" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[14px] font-semibold text-zinc-900">{r.name}</h3>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${versionTone(r.versionLabel)}`}>{r.versionLabel}</span>
                </div>
                <p className="truncate text-xs text-zinc-500">{client?.name} · {audit?.code ?? '—'} · {r.type} · {r.sizeLabel}</p>
                <p className="text-[11px] text-zinc-400">Generated by {r.generatedBy} · {fmtDateTime(r.generatedAt)}</p>
              </div>
              {r.status === 'final' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <History className="h-3 w-3" />Frozen · audit locked
                </span>
              ) : audit && (
                <div className="flex gap-2">
                  <button onClick={() => generateReport(audit.id)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700">New version</button>
                  <button onClick={() => finalizeReport(audit.id)} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800">Finalize</button>
                </div>
              )}
            </div>
          )
        })}
        {reports.length === 0 && <EmptyState icon={<FileText className="h-8 w-8" />} title="No reports yet" sub="Generate the first report once an audit reaches review." />}
      </div>
    </div>
  )
}
