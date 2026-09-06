'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ClipboardCheck, Boxes, MapPin, ShieldAlert, ImageIcon, FileText, ChartColumnBig, Users, Building2, History, ArrowLeft, QrCode, Search, Menu, X } from 'lucide-react'
import { useES, type OpsView } from '@/modules/shared/store'
import { ModuleSwitcher } from '@/modules/shared/ModuleSwitcher'
import { Asset360Drawer } from '@/modules/shared/views/Asset360Drawer'
import { OpsOverview } from './OpsOverview'
import { AuditsView } from '@/modules/shared/views/AuditsView'
import { AssetsTable } from '@/modules/shared/views/AssetsTable'
import { ExceptionsCenter } from '@/modules/shared/views/ExceptionsCenter'
import { ClientsView, LocationsView, EvidenceView, ReportsView } from '@/modules/shared/views/MiscViews'
import { AnalyticsView, TeamView, LogsView } from './AnalyticsTeamLogs'

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
  ] },
]

const TITLES: Record<OpsView, string> = {
  overview: 'Operations Overview', clients: 'Clients', locations: 'Locations', audits: 'Audit Projects',
  assets: 'Asset Register', exceptions: 'Exception Center', evidence: 'Evidence Center', reports: 'Reports',
  analytics: 'Analytics & Risk', team: 'Field Team', logs: 'Digital Audit Trail',
}

// One nav definition shared by the desktop aside and the mobile drawer —
// they can never drift apart.
function OpsNav({ onNavigate }: { onNavigate?: () => void }) {
  const { world, opsView, setOpsView, setSurface } = useES()
  return (
    <>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => (
          <div key={g.section}>
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{g.section}</div>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const active = opsView === it.id
                const badgeCount = it.badge === 'exceptions' ? (world?.stats.openExceptions ?? 0) : 0
                return (
                  <button key={it.id} onClick={() => { setOpsView(it.id); onNavigate?.() }}
                    className={cn('flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition',
                      active ? 'bg-emerald-500/15 text-emerald-300' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200')}>
                    {it.icon}
                    <span className="flex-1 text-left">{it.label}</span>
                    {badgeCount > 0 && <span className="rounded-full bg-red-500/90 px-1.5 py-px text-[10px] font-bold text-white">{badgeCount}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-2 border-t border-white/5 p-3">
        <ModuleSwitcher current="Operations Portal" direction="up" compact />
        <button onClick={() => { setSurface('landing'); onNavigate?.() }} className="flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Hub
        </button>
      </div>
    </>
  )
}

export function OpsApp() {
  const { opsView, setSurface } = useES()
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="flex h-dvh bg-zinc-50 text-zinc-900 sm:h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-zinc-950 md:flex">
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500"><QrCode className="h-4.5 w-4.5 text-white" /></span>
          <div>
            <div className="text-[13px] font-bold tracking-tight text-white">EasySourcing</div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">Operations Portal</div>
          </div>
        </div>
        <OpsNav />
      </aside>

      {/* Mobile nav drawer */}
      <div className={cn('fixed inset-0 z-50 md:hidden', !navOpen && 'pointer-events-none')}>
        <div onClick={() => setNavOpen(false)} aria-hidden
          className={cn('absolute inset-0 bg-zinc-950/50 backdrop-blur-[2px] transition-opacity duration-300', navOpen ? 'opacity-100' : 'opacity-0')} />
        <aside role="dialog" aria-modal="true" aria-label="Operations navigation"
          className={cn('absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-zinc-950 shadow-2xl transition-transform duration-300 ease-out',
            navOpen ? 'translate-x-0' : '-translate-x-full')}>
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500"><QrCode className="h-4.5 w-4.5 text-white" /></span>
              <div>
                <div className="text-[13px] font-bold tracking-tight text-white">EasySourcing</div>
                <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">Operations Portal</div>
              </div>
            </div>
            <button onClick={() => setNavOpen(false)} aria-label="Close navigation menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 ring-1 ring-white/10 transition hover:bg-white/5">
              <X className="h-5 w-5" />
            </button>
          </div>
          <OpsNav onNavigate={() => setNavOpen(false)} />
        </aside>
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white/95 px-3 backdrop-blur sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button onClick={() => setNavOpen(true)} aria-label="Open navigation menu"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-600 ring-1 ring-zinc-200 transition active:bg-zinc-100 md:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <button onClick={() => setSurface('landing')} aria-label="Back to all surfaces" className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg transition hover:bg-zinc-100 md:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500"><QrCode className="h-4 w-4 text-white" /></span>
            </button>
            <div className="hidden items-center gap-2 text-[13px] text-zinc-400 md:flex">
              <span>EasySourcing</span><span>/</span>
              <span className="font-medium text-zinc-800">{TITLES[opsView]}</span>
            </div>
            <div className="truncate text-[14px] font-semibold tracking-tight text-zinc-900 md:hidden">{TITLES[opsView]}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden lg:block">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input placeholder="Global search — asset, serial, QR, custodian…" className="h-9 w-72 rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-3 text-[13px] outline-none transition placeholder:text-zinc-400 focus:border-emerald-400 focus:bg-white" />
            </div>
            <div className="hidden items-center gap-2 rounded-full bg-zinc-100 py-1 pl-1 pr-3 sm:flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">MK</span>
              <span className="text-[12px] font-medium text-zinc-600">Meera K. · Ops Manager</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
          {opsView === 'overview' && <OpsOverview />}
          {opsView === 'audits' && <AuditsView />}
          {opsView === 'assets' && <AssetsTable />}
          {opsView === 'locations' && <LocationsView />}
          {opsView === 'exceptions' && <ExceptionsCenter />}
          {opsView === 'evidence' && <EvidenceView />}
          {opsView === 'reports' && <ReportsView />}
          {opsView === 'analytics' && <AnalyticsView />}
          {opsView === 'team' && <TeamView />}
          {opsView === 'logs' && <LogsView />}
          {opsView === 'clients' && <ClientsView />}
        </main>
      </div>
      <Asset360Drawer />
    </div>
  )
}
