'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { QrCode, ScanLine, Building2, ArrowRight, ShieldCheck, FileCheck2, MapPinned, Camera, GitCompareArrows, FolderSearch, Stamp, FileText, ClipboardCheck, Boxes, Network, Rocket, Globe, Container, TrendingUp, TriangleAlert, CircleCheck } from 'lucide-react'
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

/* deterministic mini bar-chart heights for the hero mock (14 days) */
const MOCK_BARS = [42, 68, 55, 80, 62, 90, 74, 58, 84, 66, 95, 72, 60, 88]
const MOCK_DONUT = 'conic-gradient(#10b981 0deg 241deg, #f59e0b 241deg 283deg, #ef4444 283deg 305deg, #3f3f46 305deg 360deg)'

export function Landing() {
  const { world, setSurface, loading } = useES()

  return (
    <div className="relative min-h-screen overflow-x-clip bg-zinc-950 text-zinc-100">
      {/* ── Ambient graphics: aurora + grid + grain ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="bg-aurora noise absolute inset-0" />
        <div className="bg-grid-fade absolute inset-x-0 top-0 h-[42rem]" />
        <div className="absolute -top-52 left-1/2 h-[30rem] w-[64rem] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-3xl" />
      </div>

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-zinc-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-6">
          <button onClick={() => setSurface('landing')} className="flex items-center gap-2.5">
            <span className="glow-emerald flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600">
              <QrCode className="h-4.5 w-4.5 text-white" />
            </span>
            <div className="text-left">
              <div className="text-[13.5px] font-bold tracking-tight text-white">EasySourcing</div>
              <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80">Platform Hub · v2.1</div>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setSurface('planner')} aria-label="Open deployment planner"
              className="glass flex h-9 items-center gap-2 rounded-xl px-3 text-[12px] font-semibold text-zinc-200 transition hover:border-emerald-400/30 hover:text-white">
              <Rocket className="h-3.5 w-3.5 text-violet-300" />
              <span className="hidden sm:inline">Deploy Planner</span>
            </button>
            <button onClick={() => setSurface('architecture')} aria-label="Open system architecture map"
              className="glass flex h-9 items-center gap-2 rounded-xl px-3 text-[12px] font-semibold text-zinc-200 transition hover:border-violet-400/30 hover:text-white">
              <Network className="h-3.5 w-3.5 text-violet-300" />
              <span className="hidden sm:inline">Architecture</span>
            </button>
            <ModuleSwitcher current="Platform Hub" align="right" />
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative mx-auto max-w-6xl px-4 pt-14 sm:px-6 sm:pt-20">
        <div className="animate-fade-up mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-3.5 py-1.5 text-[12px] font-semibold text-emerald-300 shadow-[0_0_24px_-6px_rgba(16,185,129,0.45)]">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" /></span>
            Enterprise Asset Verification · Audit · Reconciliation
          </div>
          <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.04] tracking-tight sm:text-6xl">
            <span className="text-gradient">Every asset on Earth,</span><br />
            <span className="text-white">accountable in one loop.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
            Not a CRUD inventory app — a controlled digital workflow that replaces spreadsheets, paper checklists
            and disconnected GPS records. From asset-register intake to the client-approved audit report.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-semibold tracking-wide text-zinc-300">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" />Every Asset.</span>
            <span className="inline-flex items-center gap-2"><MapPinned className="h-4 w-4 text-emerald-400" />Verified.</span>
            <span className="inline-flex items-center gap-2"><GitCompareArrows className="h-4 w-4 text-emerald-400" />Reconciled.</span>
            <span className="inline-flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-emerald-400" />Accountable.</span>
          </div>
        </div>

        {/* ── Hero graphics: live glass dashboard mock ── */}
        <div className="animate-fade-up relative mx-auto mt-12 max-w-4xl [animation-delay:150ms]">
          <div className="pointer-events-none absolute -inset-x-8 -top-10 bottom-8 rounded-[2.5rem] bg-emerald-500/[0.08] blur-3xl" aria-hidden />
          <div className="glass edge-gradient-top relative overflow-hidden rounded-2xl shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)]">
            {/* browser chrome */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
              <span className="ml-3 flex h-6 flex-1 items-center gap-1.5 rounded-md bg-white/[0.04] px-2.5 font-mono text-[10px] text-zinc-500 ring-1 ring-white/[0.06]">
                <CircleCheck className="h-3 w-3 text-emerald-400" /> ops.easysourcing.in/overview
              </span>
              <span className="hidden items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/20 sm:flex">
                <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" /> live
              </span>
            </div>
            {/* mock body */}
            <div className="grid gap-3 p-4 sm:grid-cols-5 sm:p-5">
              {/* chart card */}
              <div className="rounded-xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.06] sm:col-span-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-semibold text-zinc-200">Field verification activity</div>
                    <div className="text-[10px] text-zinc-500">synced from auditor devices · last 14 days</div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    <TrendingUp className="h-3 w-3" /> +18%
                  </span>
                </div>
                <div className="mt-3 flex h-28 items-end gap-1.5">
                  {MOCK_BARS.map((h, i) => (
                    <div key={i} className="group relative flex-1">
                      <div
                        className="w-full rounded-t-[4px] bg-gradient-to-t from-emerald-600/70 to-emerald-400 transition-all duration-300 hover:from-emerald-500 hover:to-teal-300"
                        style={{ height: `${h * 0.9}px`, animation: `es-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) ${0.25 + i * 0.045}s both` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {/* donut card */}
              <div className="rounded-xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.06] sm:col-span-2">
                <div className="text-[12px] font-semibold text-zinc-200">Reconciliation</div>
                <div className="text-[10px] text-zinc-500">register vs physical</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative h-20 w-20 shrink-0 rounded-full animate-float" style={{ background: MOCK_DONUT }}>
                    <div className="absolute inset-[7px] flex flex-col items-center justify-center rounded-full bg-zinc-950/95">
                      <span className="text-[15px] font-extrabold tabular-nums text-white">{world ? `${world.stats.matchRate}%` : '77.7%'}</span>
                      <span className="text-[7.5px] uppercase tracking-widest text-zinc-500">match</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {[
                      ['bg-emerald-400', 'Matched', '30'],
                      ['bg-amber-400', 'Exceptions', '7'],
                      ['bg-red-400', 'Missing', '2'],
                    ].map(([dot, label, n]) => (
                      <div key={label} className="flex items-center gap-1.5 text-[10.5px] text-zinc-400">
                        <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />{label}
                        <span className="ml-auto font-semibold tabular-nums text-zinc-200">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* KPI strip */}
              <div className="grid grid-cols-3 gap-3 sm:col-span-5">
                {[
                  ['Clients', world ? String(world.clients.length) : '5', 'text-emerald-300'],
                  ['Field verifications', world ? world.verifications.length.toLocaleString('en-IN') : '103', 'text-teal-300'],
                  ['Open exceptions', world ? String(world.stats.openExceptions) : '18', 'text-amber-300'],
                ].map(([k, v, tone]) => (
                  <div key={k} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
                    <div className="truncate text-[9.5px] font-semibold uppercase tracking-widest text-zinc-500">{k}</div>
                    <div className={cn('mt-1 text-xl font-extrabold tabular-nums', tone)}>{v}</div>
                  </div>
                ))}
                <div className="hidden items-center justify-between rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06] sm:col-span-3 sm:flex">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500"><TriangleAlert className="h-3.5 w-3.5 text-amber-400" />Exception EX-2026-0025 auto-assigned to field lead</span>
                  <span className="font-mono text-[10px] text-zinc-600">just now</span>
                </div>
              </div>
            </div>
          </div>
          {/* floating chips — anchored to panel edges so they never cover data */}
          <div className="glass animate-float absolute -top-5 left-6 z-10 hidden items-center gap-2 rounded-xl px-3 py-2 shadow-xl lg:flex">
            <ScanLine className="h-4 w-4 text-teal-300" />
            <div><div className="text-[11px] font-bold text-white">QR verified</div><div className="text-[9px] text-zinc-500">ES-MRD-00043 · GPS locked</div></div>
          </div>
          <div className="glass animate-float absolute -bottom-5 right-6 z-10 hidden items-center gap-2 rounded-xl px-3 py-2 shadow-xl [animation-delay:1.4s] lg:flex">
            <CircleCheck className="h-4 w-4 text-emerald-300" />
            <div><div className="text-[11px] font-bold text-white">Report approved</div><div className="text-[9px] text-zinc-500">client signed · v3 final</div></div>
          </div>
        </div>
      </section>

      {/* ── The loop ── */}
      <section className="relative mx-auto mt-16 max-w-6xl px-4 sm:px-6">
        <div className="glass relative overflow-hidden rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400/90">The differentiating loop</div>
            <div className="hidden text-[11px] text-zinc-500 sm:block">10 controlled stages · zero paper</div>
          </div>
          <div className="relative mt-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
            <div className="absolute left-0 right-0 top-[26px] mx-6 hidden h-px bg-gradient-to-r from-emerald-500/40 via-teal-400/25 to-transparent lg:block" aria-hidden />
            <div className="relative flex items-center gap-1.5">
              {LOOP.map((s, i) => (
                <React.Fragment key={s.label}>
                  <div className="group flex shrink-0 flex-col items-center gap-1.5 rounded-xl bg-zinc-900/80 px-3 py-2.5 ring-1 ring-white/[0.07] transition hover:-translate-y-0.5 hover:ring-emerald-400/40">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20 transition group-hover:bg-emerald-400/20">{s.icon}</span>
                    <span className="whitespace-nowrap text-[11px] font-medium text-zinc-300">{s.label}</span>
                  </div>
                  {i < LOOP.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-emerald-500/50" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats band ── */}
      <section className="relative mx-auto mt-6 max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Clients on platform', world ? String(world.clients.length) : '—', 'text-emerald-300'],
            ['Assets under audit', world ? world.stats.assetsRegistered.toLocaleString('en-IN') : '—', 'text-teal-300'],
            ['Field verifications', world ? world.verifications.length.toLocaleString('en-IN') : '—', 'text-emerald-300'],
            ['Match rate', world ? `${world.stats.matchRate}%` : '—', 'text-teal-300'],
          ].map(([k, v, tone], i) => (
            <div key={k as string} className="glass animate-fade-up card-hover rounded-2xl p-4" style={{ animationDelay: `${i * 70}ms` }}>
              <div className={cn('text-[1.7rem] font-extrabold tabular-nums leading-none', tone)}>{v}</div>
              <div className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Modules — standalone, connected ── */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="animate-fade-up text-center">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Four standalone modules. <span className="text-gradient">One connected product.</span></h2>
          <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-relaxed text-zinc-400">
            Each module ships with its own version, container image and deploy target — they could live in
            separate repos and separate hosts. They stay one product because every module speaks the same
            Core API contract and shares the versioned <span className="font-mono text-[11.5px] text-emerald-300/90">@es/shared</span> kernel.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {MODULES.filter((m) => m.kind !== 'shell').map((m, i) => (
            <div key={m.id} className="animate-fade-up" style={{ animationDelay: `${i * 90}ms` }}>
              <SurfaceCard m={m} onClick={() => setSurface(MODULE_SURFACE[m.id] ?? 'landing')} loading={loading} />
            </div>
          ))}
        </div>

        {/* Architecture + Planner banners */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <button onClick={() => setSurface('architecture')}
            className="group relative flex flex-col items-start gap-4 overflow-hidden rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-500/[0.12] via-zinc-900/60 to-zinc-950 p-5 text-left transition hover:border-violet-400/45 sm:flex-row sm:items-center">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-500/15 blur-3xl transition group-hover:bg-violet-500/25" aria-hidden />
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-400/30">
              <Network className="h-5 w-5 text-violet-300" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold tracking-tight text-white">See how “deploy separately, stay connected” works</span>
              <span className="mt-0.5 block text-[12.5px] text-zinc-400">
                Live topology map from the discovery endpoint — manifests, REST contracts, container images.
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 rounded-xl bg-violet-500/15 px-3.5 py-2 text-[12px] font-semibold text-violet-200 ring-1 ring-violet-400/30 transition group-hover:bg-violet-500/25">
              Open map <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </button>
          <button onClick={() => setSurface('planner')}
            className="group relative flex flex-col items-start gap-4 overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.12] via-zinc-900/60 to-zinc-950 p-5 text-left transition hover:border-emerald-400/45 sm:flex-row sm:items-center">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl transition group-hover:bg-emerald-500/25" aria-hidden />
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/30">
              <Rocket className="h-5 w-5 text-emerald-300" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold tracking-tight text-white">Start free — plan your deploy by team size</span>
              <span className="mt-0.5 block text-[12.5px] text-zinc-400">
                ₹0 free-tier launch path, then scale to managed cloud. Interactive planner, zero guesswork.
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-500/15 px-3.5 py-2 text-[12px] font-semibold text-emerald-200 ring-1 ring-emerald-400/30 transition group-hover:bg-emerald-500/25">
              Open planner <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>

        <div className="mt-12 flex flex-col items-center gap-1 pb-10 text-center">
          <div className="text-[11px] text-zinc-600">Built from the EasySourcing Project Master Summary v1.0 · B2B SaaS + managed audit services · Initial market: India</div>
          <div className="text-[11px] text-zinc-700">Demo data is fictional. Audit results are computed deterministically — AI never decides authoritative outcomes.</div>
        </div>
      </section>
    </div>
  )
}

function SurfaceCard({ m, onClick, loading }: { m: ModuleManifest; onClick: () => void; loading: boolean }) {
  const a = ACCENT_CLS[m.accent]
  const Icon = MODULE_ICONS[m.iconKey]
  const glow: Record<string, string> = {
    emerald: 'hover:border-emerald-400/40 hover:shadow-[0_16px_48px_-16px_rgba(16,185,129,0.35)]',
    teal: 'hover:border-teal-400/40 hover:shadow-[0_16px_48px_-16px_rgba(20,184,166,0.35)]',
    amber: 'hover:border-amber-400/40 hover:shadow-[0_16px_48px_-16px_rgba(245,158,11,0.35)]',
    violet: 'hover:border-violet-400/40 hover:shadow-[0_16px_48px_-16px_rgba(139,92,246,0.35)]',
  }
  return (
    <button onClick={onClick} disabled={loading}
      className={cn('group glass relative flex h-full w-full flex-col overflow-hidden rounded-2xl p-5 text-left transition-all duration-300 hover:-translate-y-1', glow[m.accent] ?? 'hover:border-white/20')}>
      {/* accent corner glow */}
      <span className={cn('pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-20', a.solid)} aria-hidden />
      <div className="flex items-center justify-between">
        <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl ring-1 transition group-hover:scale-105', a.solid, a.ring)}>
          {<Icon className="h-5.5 w-5.5 text-white" />}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 ring-1 ring-white/[0.06]">{m.kind === 'mobile' ? 'field pwa' : m.kind}</span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 ring-1 ring-white/[0.06]">v{m.version}</span>
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
      <div className="mt-3 space-y-1 border-t border-white/[0.06] pt-3 font-mono text-[10px] text-zinc-500">
        <div className="flex items-center gap-1.5"><Globe className="h-3 w-3 shrink-0" /><span className="truncate">{m.deploy.target}</span></div>
        <div className="flex items-center gap-1.5"><Container className="h-3 w-3 shrink-0" /><span className="truncate">{m.deploy.image}</span></div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <span className="text-[13px] font-semibold text-white">Enter module</span>
        <ArrowRight className={cn('h-4 w-4 transition group-hover:translate-x-1', a.text)} />
      </div>
    </button>
  )
}
