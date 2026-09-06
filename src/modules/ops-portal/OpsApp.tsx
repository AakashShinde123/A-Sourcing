'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ClipboardCheck, Boxes, MapPin, ShieldAlert, ImageIcon, FileText, ChartColumnBig, Users, Building2, History, ArrowLeft, QrCode, Search } from 'lucide-react'
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

export function OpsApp() {
  const { world, opsView, setOpsView, setSurface } = useES()

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-zinc-950 md:flex">
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500"><QrCode className="h-4.5 w-4.5 text-white" /></span>
          <div>
            <div className="text-[13px] font-bold tracking-tight text-white">EasySourcing</div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">Operations Portal</div>
          </div>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {NAV.map((g) => (
            <div key={g.section}>
              <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{g.section}</div>
              <div className="space-y-0.5">
                {g.items.map((it) => {
                  const active = opsView === it.id
                  const badgeCount = it.badge === 'exceptions' ? (world?.stats.openExceptions ?? 0) : 0
                  return (
                    <button key={it.id} onClick={() => setOpsView(it.id)}
                      className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition',
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
          <button onClick={() => setSurface('landing')} className="flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300">
            <ArrowLeft className="h-3.5 w-3.5" /> Hub
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSurface('landing')} aria-label="Back to all surfaces" className="flex items-center gap-2 md:hidden">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500"><QrCode className="h-4 w-4 text-white" /></span>
            </button>
            <div className="hidden items-center gap-2 text-[13px] text-zinc-400 md:flex">
              <span>EasySourcing</span><span>/</span>
              <span className="font-medium text-zinc-800">{TITLES[opsView]}</span>
            </div>
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

        {/* Mobile nav pills */}
        <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 bg-white px-3 py-2 md:hidden">
          {NAV.flatMap((g) => g.items).map((it) => (
            <button key={it.id} onClick={() => setOpsView(it.id)}
              className={cn('whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium', opsView === it.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600')}>
              {it.label}
            </button>
          ))}
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
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
