'use client'

import React, { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ClipboardCheck, Boxes, ShieldAlert, ImageIcon, FileText, Stamp, ArrowLeft, QrCode, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { useES, type ClientView } from '@/modules/shared/store'
import { ModuleSwitcher } from '@/modules/shared/ModuleSwitcher'
import { Asset360Drawer } from '@/modules/shared/views/Asset360Drawer'
import { AuditsView } from '@/modules/shared/views/AuditsView'
import { AssetsTable } from '@/modules/shared/views/AssetsTable'
import { ExceptionsCenter } from '@/modules/shared/views/ExceptionsCenter'
import { EvidenceView, ReportsView } from '@/modules/shared/views/MiscViews'
import { Kpi, Bar as ProgressBar, Pill, MicroLabel, Avatar, EmptyState, SectionHeader } from '@/modules/shared/ui-bits'
import { auditStatusMeta, resultMeta, fmtDate } from '@/modules/shared/format'

const NAV: { id: ClientView; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'audits', label: 'Audits', icon: <ClipboardCheck className="h-4 w-4" /> },
  { id: 'assets', label: 'Assets', icon: <Boxes className="h-4 w-4" /> },
  { id: 'exceptions', label: 'Exceptions', icon: <ShieldAlert className="h-4 w-4" /> },
  { id: 'evidence', label: 'Evidence', icon: <ImageIcon className="h-4 w-4" /> },
  { id: 'reports', label: 'Reports', icon: <FileText className="h-4 w-4" /> },
  { id: 'approvals', label: 'Approvals', icon: <Stamp className="h-4 w-4" /> },
]

export function ClientApp() {
  const { world, clientView, setClientView, clientIdentityId, setClientIdentityId, setSurface } = useES()
  const client = world!.clients.find((c) => c.id === clientIdentityId)!
  const [userOpen, setUserOpen] = useState(false)
  const user = client.users[0]
  const canApprove = user?.role === 'Client Admin' || user?.role === 'Client Approver'

  const audits = useMemo(() => world!.audits.filter((a) => a.clientId === client.id), [world, client.id])
  const pendingApprovals = audits.filter((a) => a.status === 'client_review').length

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex">
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white', 'from-teal-400 to-teal-600')}><QrCode className="h-4 w-4" /></span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold tracking-tight text-zinc-900">{client.code} Portal</div>
            <div className="truncate text-[10px] font-medium uppercase tracking-widest text-zinc-400">{client.name}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map((it) => (
            <button key={it.id} onClick={() => setClientView(it.id)}
              className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition',
                clientView === it.id ? 'bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-100' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800')}>
              {it.icon}
              <span className="flex-1 text-left">{it.label}</span>
              {it.id === 'approvals' && pendingApprovals > 0 && <span className="rounded-full bg-orange-500 px-1.5 py-px text-[10px] font-bold text-white">{pendingApprovals}</span>}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-zinc-100 p-3">
          <ModuleSwitcher current="Client Portal" dark={false} direction="up" compact />
          <button onClick={() => setSurface('landing')} className="flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-600">
            <ArrowLeft className="h-3.5 w-3.5" /> Hub
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSurface('landing')} aria-label="Back to all surfaces" className="md:hidden">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-500"><QrCode className="h-4 w-4 text-white" /></span>
            </button>
            <div className="hidden items-center gap-2 text-[13px] text-zinc-400 md:flex">
              <span>{client.name}</span><span>/</span>
              <span className="font-medium capitalize text-zinc-800">{clientView}</span>
            </div>
          </div>
          <div className="relative">
            <button onClick={() => setUserOpen((o) => !o)} className="flex items-center gap-2 rounded-full bg-zinc-100 py-1 pl-1 pr-2.5 transition hover:bg-zinc-200/70">
              <Avatar name={user?.name ?? 'Client'} seed={client.colorSeed} size="sm" />
              <span className="hidden text-[12px] font-medium text-zinc-600 sm:block">{user?.name} · {user?.role}</span>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
            </button>
            {userOpen && (
              <div className="absolute right-0 top-11 z-30 w-64 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
                <MicroLabel className="px-2 pb-1 pt-1">Switch portal identity</MicroLabel>
                {client.users.map((u) => (
                  <button key={u.id} onClick={() => { setClientIdentityId(client.id); setUserOpen(false); toast.info(`Viewing as ${u.name} (${u.role})`) }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition hover:bg-zinc-50">
                    <Avatar name={u.name} seed={client.colorSeed} size="sm" />
                    <div><div className="font-medium text-zinc-800">{u.name}</div><div className="text-[11px] text-zinc-400">{u.role}</div></div>
                  </button>
                ))}
                <div className="mt-1 border-t border-zinc-100 px-2 pb-1 pt-2 text-[11px] leading-relaxed text-zinc-400">
                  Permissions are server-side enforced: {canApprove ? 'you can approve & comment.' : 'this role has view-only access.'}
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 bg-white px-3 py-2 md:hidden">
          {NAV.map((it) => (
            <button key={it.id} onClick={() => setClientView(it.id)}
              className={cn('whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium', clientView === it.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600')}>
              {it.label}
            </button>
          ))}
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {clientView === 'dashboard' && <ClientDashboard />}
          {clientView === 'audits' && <AuditsView clientIdScope={client.id} />}
          {clientView === 'assets' && <AssetsTable clientIdScope={client.id} title={`${client.code} Asset Register`} />}
          {clientView === 'exceptions' && <ExceptionsCenter clientIdScope={client.id} readOnly={!canApprove} />}
          {clientView === 'evidence' && <EvidenceView clientIdScope={client.id} />}
          {clientView === 'reports' && <ReportsView clientIdScope={client.id} />}
          {clientView === 'approvals' && <ApprovalsView canApprove={canApprove} />}
        </main>
      </div>
      <Asset360Drawer />
    </div>
  )
}

function ClientDashboard() {
  const { world, clientIdentityId, setClientView, openAudit } = useES()
  const client = world!.clients.find((c) => c.id === clientIdentityId)!
  const audits = world!.audits.filter((a) => a.clientId === client.id)
  const active = audits.filter((a) => !['completed', 'archived', 'draft'].includes(a.status))
  const assets = world!.assets.filter((a) => a.clientId === client.id)
  const verified = assets.filter((a) => a.lastVerifiedAt).length
  const exceptions = world!.exceptions.filter((e) => e.clientId === client.id)
  const openEx = exceptions.filter((e) => !['approved', 'closed'].includes(e.status))
  const hero = active[0]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">{client.name}</h1>
        <p className="text-[13px] text-zinc-500">Your organization&rsquo;s verification universe — nothing internal is visible here.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Active Audits" value={active.length} tone="teal" icon={<ClipboardCheck className="h-4 w-4" />} onClick={() => setClientView('audits')} />
        <Kpi label="Assets Registered" value={assets.length} icon={<Boxes className="h-4 w-4" />} onClick={() => setClientView('assets')} sub={`${verified} verified to date`} />
        <Kpi label="Open Exceptions" value={openEx.length} tone="red" icon={<ShieldAlert className="h-4 w-4" />} onClick={() => setClientView('exceptions')} />
        <Kpi label="Pending Approvals" value={audits.filter((a) => a.status === 'client_review').length} tone="amber" icon={<StampIcon />} onClick={() => setClientView('approvals')} />
      </div>

      {hero && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <SectionHeader title="Audit progress" sub={`${hero.code} · ${hero.name} · ${auditStatusMeta[hero.status].label}`} right={
            <button onClick={() => { openAudit(hero.id); setClientView('audits') }} className="text-[13px] font-medium text-teal-700 hover:text-teal-800">Open audit →</button>
          } />
          <div className="mt-3 flex items-end gap-2">
            <span className="text-3xl font-semibold tabular-nums text-zinc-900">{hero.progress}%</span>
            <span className="pb-1 text-xs text-zinc-400">{hero.verifiedAssets} of {hero.totalInScope} assets verified · started {fmtDate(hero.startDate)}</span>
          </div>
          <ProgressBar value={hero.progress} barClass="bg-teal-500" className="mt-2" />
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {Object.entries(hero.byResult).slice(0, 4).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" style={k !== 'matched' ? { background: '#f59e0b' } : {}} />{resultMeta[k]?.label ?? k}</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-800">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <SectionHeader title="Recent exceptions" right={<button onClick={() => setClientView('exceptions')} className="text-[13px] font-medium text-teal-700">All →</button>} />
          <div className="mt-2 space-y-1.5">
            {exceptions.slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50/70 px-2.5 py-2">
                <div className="min-w-0"><div className="truncate text-[13px] text-zinc-700">{e.title}</div><div className="text-[10px] text-zinc-400">{e.code}</div></div>
                <Pill size="xs" meta={e.status === 'closed' ? { label: 'Closed', cls: 'bg-zinc-100 text-zinc-500 ring-zinc-200', dot: 'bg-zinc-400' } : e.status === 'approved' ? { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' } : { label: 'In progress', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' }} />
              </div>
            ))}
            {exceptions.length === 0 && <EmptyState title="No exceptions — all clean" />}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <SectionHeader title="Latest reports" right={<button onClick={() => setClientView('reports')} className="text-[13px] font-medium text-teal-700">All →</button>} />
          <div className="mt-2 space-y-1.5">
            {world!.reports.filter((r) => r.clientId === client.id).slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-zinc-50/70 px-2.5 py-2 text-[13px]">
                <span className="truncate text-zinc-700">{r.name}</span>
                <span className="ml-2 shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-500 ring-1 ring-zinc-200">{r.versionLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StampIcon() {
  return <Stamp className="h-4 w-4" />
}

function ApprovalsView({ canApprove }: { canApprove: boolean }) {
  const { world, clientIdentityId, submitApproval, setClientView, openAudit } = useES()
  const client = world!.clients.find((c) => c.id === clientIdentityId)!
  const [comment, setComment] = useState('')
  const pending = world!.audits.filter((a) => a.clientId === client.id && a.status === 'client_review')
  const history = world!.approvals.filter((a) => a.audit && world!.audits.find((x) => x.id === a.auditId)?.clientId === client.id)

  async function decide(auditId: string, decision: 'approved' | 'changes_requested') {
    const user = client.users[0]
    await submitApproval(auditId, decision, user.name, user.role, comment || undefined)
    toast.success(decision === 'approved' ? 'Audit approved' : 'Changes requested', { description: decision === 'approved' ? 'Results frozen; final report unlocked.' : 'Sent back to the EasySourcing review team.' })
    setComment('')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Approvals</h1>
        <p className="text-[13px] text-zinc-500">Review evidence-backed results and formally close audits</p>
      </div>

      {pending.map((a) => (
        <div key={a.id} className="rounded-xl border border-orange-200 bg-orange-50/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-zinc-500">{a.code}</span>
                <Pill meta={auditStatusMeta[a.status]} size="xs" />
              </div>
              <h3 className="mt-0.5 text-[15px] font-semibold text-zinc-900">{a.name}</h3>
              <p className="text-xs text-zinc-500">{a.verifiedAssets}/{a.totalInScope} assets verified · {a.openExceptions} open exceptions · {a.locationsLabel}</p>
            </div>
            <button onClick={() => { openAudit(a.id); setClientView('audits') }} className="text-[13px] font-medium text-teal-700">Inspect details →</button>
          </div>
          {canApprove ? (
            <div className="mt-3">
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment for the EasySourcing team (optional)…"
                className="min-h-[64px] w-full rounded-lg border border-orange-200 bg-white p-2.5 text-[13px] outline-none placeholder:text-zinc-400 focus:border-teal-400" />
              <div className="mt-2 flex gap-2">
                <button onClick={() => decide(a.id, 'approved')} className="rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-emerald-700">Approve audit</button>
                <button onClick={() => decide(a.id, 'changes_requested')} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-[13px] font-medium text-zinc-700 transition hover:border-zinc-400">Request changes</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-lg bg-white p-3 text-xs text-zinc-500 ring-1 ring-orange-100">Your role ({client.users[0]?.role}) is view-only. Client Admin / Approver roles can approve.</div>
          )}
        </div>
      ))}
      {pending.length === 0 && <EmptyState icon={<Stamp className="h-8 w-8" />} title="Nothing awaiting approval" sub="Audits in 'Client Review' will appear here for sign-off." />}

      {history.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <MicroLabel>Decision history</MicroLabel>
          <div className="mt-2 space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-lg bg-zinc-50/70 px-3 py-2">
                <div>
                  <div className="text-[13px] text-zinc-700"><span className={h.decision === 'approved' ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>{h.decision === 'approved' ? 'Approved' : 'Changes requested'}</span> · {h.audit?.name}</div>
                  {h.comment && <div className="text-xs text-zinc-500">&ldquo;{h.comment}&rdquo;</div>}
                </div>
                <div className="shrink-0 text-right text-[11px] text-zinc-400">{h.byName}<br />{fmtDate(h.at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
