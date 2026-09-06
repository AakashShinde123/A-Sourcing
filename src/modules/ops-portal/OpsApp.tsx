'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ClipboardCheck, Boxes, MapPin, ShieldAlert, ImageIcon, FileText, ChartColumnBig, Users, Building2, History, ArrowLeft, QrCode, Search, Menu, X, ShieldCheck } from 'lucide-react'
import { useES, type OpsView } from '@/modules/shared/store'
import { ModuleSwitcher } from '@/modules/shared/ModuleSwitcher'
import { Asset360Drawer } from '@/modules/shared/views/Asset360Drawer'
import { OpsOverview } from './OpsOverview'
import { AuditsView } from '@/modules/shared/views/AuditsView'
import { AssetsTable } from '@/modules/shared/views/AssetsTable'
import { ExceptionsCenter } from '@/modules/shared/views/ExceptionsCenter'
import { ClientsView, LocationsView, EvidenceView, ReportsView } from '@/modules/shared/views/MiscViews'
import { AnalyticsView, TeamView, LogsView } from './AnalyticsTeamLogs'
import { AccessView } from './AccessView'

const NAV: { section: string; items: { id: OpsView; label: string; icon: React.ReactNode; badge?: 'exceptions' }[] }[] = [
  { section: 'Operations', items: [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'audits', label: 'Audit Projects', icon: <ClipboardCheck className="h-4 w-4" /> },
    { id: 'assets', label: 'Asset Register', icon: <Boxes className="h-4 w-4" /> },
    { id: 'locations', label: 'Locations', icon: <MapPin className="h-4 w-4" /> },
  ] },
  { section: 'Control', items: [
    { id: 'exceptions', label: 'Exception Center', icon: <ShieldAlert className="h-4 w-4" />, badge: 'exceptions' },
    { id: 'evidence', label: 'Evidence', icon: <ImageIcon className="h-4 w-4" /> },
  ] },
  { section: 'Deliver', items: [
    { id: 'reports', label: 'Reports', icon: <FileText className="h-4 w-4" /> },
    { id: 'analytics', label: 'Analytics & Risk', icon: <ChartColumnBig className="h-4 w-4" /> },
    { id: 'logs', label: 'Audit Trail', icon: <History className="h-4 w-4" /> },
  ] },
  { section: 'Manage', items: [
    { id: 'clients', label: 'Clients', icon: <Building2 className="h-4 w-4" /> },
    { id: 'team', label: 'Field Team', icon: <Users className="h-4 w-4" /> },
    { id: 'access', label: 'Access & Accounts', icon: <ShieldCheck className="h-4 w-4" /> },
  ] },
]

const TITLES: Record<OpsView, string> = {
  overview: 'Operations Overview', clients: 'Clients', locations: 'Locations', audits: 'Audit Projects',
  assets: 'Asset Register', exceptions: 'Exception Center', evidence: 'Evidence Center', reports: 'Reports',
  analytics: 'Analytics & Risk', team: 'Field Team', access: 'Access & Accounts', logs: 'Digital Audit Trail',
}

// One nav definition shared by the desktop aside and the mobile drawer —
// they can never drift apart.
function OpsNav({ onNavigate }: { onNavigate?: () => void }) {
  const { world, opsView, setOpsView, setSurface, user } = useES()
  const isAdmin = user?.role === 'ADMIN'
  return (
    <>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => (
          <div key={g.section}>
            <div className="flex items-center gap-1.5 px-2 pb-1.5">
              <span className="h-px w-2.5 bg-gradient-to-r from-emerald-500 to-transparent" aria-hidden />
              <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-zinc-400">{g.section}</span>
            </div>
            <div className="space-y-0.5">
              {g.items.filter((it) => it.id !== 'access' || isAdmin).map((it) => {
                const active = opsView === it.id
                const badgeCount = it.badge === 'exceptions' ? (world?.stats.openExceptions ?? 0) : 0
                return (
                  <button key={it.id} onClick={() => { setOpsView(it.id); onNavigate?.() }}
                    className={cn('relative flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition',
                      active
                        ? 'bg-gradient-to-r from-emerald-100/90 to-emerald-50/40 text-emerald-800 ring-1 ring-emerald-200/80'
                        : 'text-zinc-500 hover:bg-emerald-50/60 hover:text-zinc-900')}>
                    {active && <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-emerald-400 to-teal-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]" aria-hidden />}
                    <span className={cn('transition', active ? 'text-emerald-600' : 'text-zinc-400')}>{it.icon}</span>
                    <span className="flex-1 text-left">{it.label}</span>
                    {badgeCount > 0 && <span className="rounded-full bg-gradient-to-r from-red-500 to-rose-500 px-1.5 py-px text-[10px] font-bold text-white shadow-[0_2px_8px_rgba(239,68,68,0.5)]">{badgeCount}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-2 border-t border-zinc-100 bg-zinc-50/60 p-3">
        <ModuleSwitcher current="Operations Portal" direction="up" compact />
        <button onClick={() => { setSurface('landing'); onNavigate?.() }} className="flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-zinc-500 transition hover:bg-white hover:text-zinc-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Hub
        </button>
      </div>
    </>
  )
}

export function OpsApp() {
  const { opsView, setSurface, user } = useES()
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="flex h-dvh bg-[#f4f7f2] text-zinc-900 sm:h-screen">
      {/* Desktop sidebar */}
      <aside className="relative hidden w-60 shrink-0 flex-col border-r border-emerald-900/[0.08] bg-white md:flex">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-emerald-100/70 via-teal-50/40 to-transparent" />
          <div className="absolute -left-10 top-10 h-32 w-32 rounded-full bg-teal-200/30 blur-2xl" />
        </div>
        <div className="relative flex items-center gap-2.5 px-5 pb-4 pt-5">
          <span className="glow-emerald flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600"><QrCode className="h-4.5 w-4.5 text-white" /></span>
          <div>
            <div className="font-display text-[13px] font-bold tracking-tight text-zinc-900">EasySourcing</div>
            <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-emerald-600">Operations Portal</div>
          </div>
        </div>
        <OpsNav />
      </aside>

      {/* Mobile nav drawer */}
      <div className={cn('fixed inset-0 z-50 md:hidden', !navOpen && 'pointer-events-none')}>
        <div onClick={() => setNavOpen(false)} aria-hidden
          className={cn('absolute inset-0 bg-emerald-950/30 backdrop-blur-[2px] transition-opacity duration-300', navOpen ? 'opacity-100' : 'opacity-0')} />
        <aside role="dialog" aria-modal="true" aria-label="Operations navigation"
          className={cn('absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out',
            navOpen ? 'translate-x-0' : '-translate-x-full')}>
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <div className="flex items-center gap-2.5">
              <span className="glow-emerald flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600"><QrCode className="h-4.5 w-4.5 text-white" /></span>
              <div>
                <div className="font-display text-[13px] font-bold tracking-tight text-zinc-900">EasySourcing</div>
                <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-emerald-600">Operations Portal</div>
              </div>
            </div>
            <button onClick={() => setNavOpen(false)} aria-label="Close navigation menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 ring-1 ring-zinc-200 transition hover:bg-zinc-50">
              <X className="h-5 w-5" />
            </button>
          </div>
          <OpsNav onNavigate={() => setNavOpen(false)} />
        </aside>
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-zinc-200/80 bg-white/80 px-3 backdrop-blur-xl sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button onClick={() => setNavOpen(true)} aria-label="Open navigation menu"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-600 ring-1 ring-zinc-200 transition active:bg-zinc-100 md:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <button onClick={() => setSurface('landing')} aria-label="Back to all surfaces" className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg transition hover:bg-zinc-100 md:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 shadow-[0_2px_10px_rgba(16,185,129,0.45)]"><QrCode className="h-4 w-4 text-white" /></span>
            </button>
            <div className="hidden items-center gap-2 text-[13px] text-zinc-400 md:flex">
              <span>EasySourcing</span><span>/</span>
              <span className="font-medium text-zinc-800">{TITLES[opsView]}</span>
            </div>
            <div className="truncate text-[14px] font-semibold tracking-tight text-zinc-900 md:hidden">{TITLES[opsView]}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input placeholder="Global search — asset, serial, QR, custodian…" className="h-9.5 w-72 rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-12 text-[13px] outline-none transition placeholder:text-zinc-400 focus:border-emerald-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
              <kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[9.5px] text-zinc-400 xl:block">⌘K</kbd>
            </div>
            <div className="hidden items-center gap-2 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 py-1 pl-1 pr-3 ring-1 ring-emerald-200/70 sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-bold text-white ring-1 ring-white/20">
                {user ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() : '—'}
              </span>
              <span className="text-[12px] font-medium text-emerald-900/80">{user ? `${user.name} · ${user.role === 'ADMIN' ? 'Platform Admin' : user.role === 'OPS' ? 'Ops Team' : user.role}` : '…'}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-emerald-50/50 via-[#f4f7f2] to-[#eef3ec] p-3 sm:p-4 lg:p-6">
          {opsView === 'overview' && <OpsOverview />}
          {opsView === 'audits' && <AuditsView />}
          {opsView === 'assets' && <AssetsTable />}
          {opsView === 'locations' && <LocationsView />}
          {opsView === 'exceptions' && <ExceptionsCenter />}
          {opsView === 'evidence' && <EvidenceView />}
          {opsView === 'reports' && <ReportsView />}
          {opsView === 'analytics' && <AnalyticsView />}
          {opsView === 'team' && <TeamView />}
          {opsView === 'access' && <AccessView />}
          {opsView === 'logs' && <LogsView />}
          {opsView === 'clients' && <ClientsView />}
        </main>
      </div>
      <Asset360Drawer />
    </div>
  )
}
