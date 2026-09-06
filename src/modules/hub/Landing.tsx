'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { QrCode, ScanLine, Building2, ArrowRight, ShieldCheck, FileCheck2, MapPinned, Camera, GitCompareArrows, FolderSearch, Stamp, FileText, ClipboardCheck, Boxes, Network, Globe, Container } from 'lucide-react'
import { useES } from '../shared/store'
import { ModuleSwitcher, MODULE_ICONS, ACCENT_CLS } from '../shared/ModuleSwitcher'
import { MODULES, MODULE_SURFACE } from './registry'
import type { ModuleManifest } from '../shared/module-contract'

const LOOP = [
  { icon: <Building2 className="h-3.5 w-3.5" />, label: 'Client' },
  { icon: <Boxes className="h-3.5 w-3.5" />, label: 'Asset Register' },
  { icon: <FolderSearch className="h-3.5 w-3.5" />, label: 'Import & Validate' },
  { icon: <ClipboardCheck className="h-3.5 w-3.5" />, label: 'Audit & Assign' },
  { icon: <ScanLine className="h-3.5 w-3.5" />, label: 'Mobile Verify' },
  { icon: <Camera className="h-3.5 w-3.5" />, label: 'Photo + GPS Evidence' },
  { icon: <GitCompareArrows className="h-3.5 w-3.5" />, label: 'Reconciliation' },
  { icon: <FileCheck2 className="h-3.5 w-3.5" />, label: 'Exceptions' },
  { icon: <Stamp className="h-3.5 w-3.5" />, label: 'Client Approval' },
  { icon: <FileText className="h-3.5 w-3.5" />, label: 'Final Report' },
]

export function Landing() {
  const { world, setSurface, loading } = useES()

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500"><QrCode className="h-4.5 w-4.5 text-white" /></span>
            <div>
              <div className="text-[13px] font-bold tracking-tight">EasySourcing</div>
              <div className="text-[9.5px] font-medium uppercase tracking-widest text-zinc-500">Platform Hub · v2.1</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSurface('architecture')}
              className="flex h-9 items-center gap-2 rounded-lg bg-white/5 px-3 text-[12px] font-semibold text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10">
              <Network className="h-3.5 w-3.5 text-violet-300" />
              <span className="hidden sm:inline">System Architecture</span>
            </button>
            <ModuleSwitcher current="Platform Hub" align="right" />
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 pb-10 pt-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-[12px] font-semibold text-emerald-300">
            <QrCode className="h-3.5 w-3.5" /> Enterprise Asset Physical Verification · Audit · Reconciliation
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            EasySourcing
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
            Not a CRUD inventory app — a controlled digital workflow that replaces spreadsheets, paper checklists
            and disconnected GPS records. One platform from asset-register intake to the client-approved audit report.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] font-semibold tracking-wide text-zinc-300">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" />Every Asset.</span>
            <span className="inline-flex items-center gap-2"><MapPinned className="h-4 w-4 text-emerald-400" />Verified.</span>
            <span className="inline-flex items-center gap-2"><GitCompareArrows className="h-4 w-4 text-emerald-400" />Reconciled.</span>
            <span className="inline-flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-emerald-400" />Accountable.</span>
          </div>

          {/* live stats */}
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Clients', world ? world.clients.length : '—'],
              ['Assets under audit', world ? world.stats.assetsRegistered.toLocaleString('en-IN') : '—'],
              ['Field verifications', world ? world.verifications.length.toLocaleString('en-IN') : '—'],
              ['Match rate', world ? `${world.stats.matchRate}%` : '—'],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                <div className="text-2xl font-bold tabular-nums text-white">{v}</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-500">{k}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The loop */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">The differentiating loop</div>
          <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
            {LOOP.map((s, i) => (
              <React.Fragment key={s.label}>
                <div className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2.5 ring-1 ring-white/5">
                  <span className="text-emerald-400">{s.icon}</span>
                  <span className="whitespace-nowrap text-[11px] font-medium text-zinc-300">{s.label}</span>
                </div>
                {i < LOOP.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Modules — standalone, connected */}
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">Four standalone modules. One connected product.</h2>
          <p className="mx-auto mt-2 max-w-2xl text-[13px] leading-relaxed text-zinc-400">
            Each module below ships with its own version, container image and deploy target — they could live in
            separate repos and separate hosts. They stay one product because every module speaks the same
            Core API contract and shares the versioned <span className="font-mono text-[11.5px] text-zinc-300">@es/shared</span> kernel.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {MODULES.filter((m) => m.kind !== 'shell').map((m) => (
            <SurfaceCard key={m.id} m={m} onClick={() => setSurface(MODULE_SURFACE[m.id] ?? 'landing')} loading={loading} />
          ))}
        </div>

        {/* Architecture banner */}
        <button onClick={() => setSurface('architecture')}
          className="group mt-6 flex w-full flex-col items-start gap-4 rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/[0.08] to-white/[0.02] p-5 text-left transition hover:border-violet-500/40 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-500/25">
            <Network className="h-5 w-5 text-violet-300" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold tracking-tight text-white">See how “deploy separately, stay connected” works</span>
            <span className="mt-0.5 block text-[12.5px] text-zinc-400">
              Live topology map from the discovery endpoint — module manifests, REST contracts, container images and the Core API runtime, all in one view.
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 rounded-lg bg-violet-500/15 px-3.5 py-2 text-[12px] font-semibold text-violet-200 ring-1 ring-violet-500/25">
            Open architecture map <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </span>
        </button>

        <div className="mt-10 flex flex-col items-center gap-1 pb-8 text-center">
          <div className="text-[11px] text-zinc-600">Built from the EasySourcing Project Master Summary v1.0 · B2B SaaS + managed audit services · Initial market: India</div>
          <div className="text-[11px] text-zinc-700">Demo data is fictional. Audit results are computed deterministically — AI never decides authoritative outcomes.</div>
        </div>
      </div>
    </div>
  )
}

function SurfaceCard({ m, onClick, loading }: { m: ModuleManifest; onClick: () => void; loading: boolean }) {
  const a = ACCENT_CLS[m.accent]
  const Icon = MODULE_ICONS[m.iconKey]
  return (
    <button onClick={onClick} disabled={loading}
      className={cn('group flex flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-5 text-left transition hover:bg-white/[0.05]', 'hover:ring-1 hover:ring-white/10')}>
      <div className="flex items-center justify-between">
        <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl ring-1', a.soft, a.ring)}>{<Icon className="h-5.5 w-5.5" />}</span>
        <span className="flex items-center gap-1.5">
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{m.kind === 'mobile' ? 'field pwa' : m.kind}</span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">v{m.version}</span>
        </span>
      </div>
      <h3 className="mt-4 text-lg font-bold tracking-tight text-white">{m.name}</h3>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-zinc-400">{m.description}</p>
      <ul className="mt-3 space-y-1">
        {m.screens.slice(0, 3).map((p) => (
          <li key={p} className="flex items-center gap-2 text-[12px] text-zinc-300">
            <span className={cn('h-1 w-1 rounded-full', a.dot)} />{p}
          </li>
        ))}
        {m.screens.length > 3 && <li className="pl-3.5 text-[11px] text-zinc-600">+{m.screens.length - 3} more</li>}
      </ul>
      <div className="mt-3 space-y-1 border-t border-white/5 pt-3 font-mono text-[10px] text-zinc-500">
        <div className="flex items-center gap-1.5"><Globe className="h-3 w-3 shrink-0" /><span className="truncate">{m.deploy.target}</span></div>
        <div className="flex items-center gap-1.5"><Container className="h-3 w-3 shrink-0" /><span className="truncate">{m.deploy.image}</span></div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
        <span className="text-[13px] font-semibold text-white">Enter module</span>
        <ArrowRight className="h-4 w-4 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-white" />
      </div>
    </button>
  )
}
