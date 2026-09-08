'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { QrCode, ScanLine, Building2, ArrowRight, ShieldCheck, FileCheck2, MapPinned, Camera, GitCompareArrows, FolderSearch, Stamp, FileText, ClipboardCheck, Boxes, Network, Rocket, Globe, Container, TrendingUp, TriangleAlert, CircleCheck, Sparkles } from 'lucide-react'
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

/* per-stage color rotation for the loop chips — keeps the strip lively */
const LOOP_TONES = [
  'bg-violet-100 text-violet-600 ring-violet-500/20',
  'bg-emerald-100 text-emerald-600 ring-emerald-500/20',
  'bg-teal-100 text-teal-600 ring-teal-500/20',
  'bg-sky-100 text-sky-600 ring-sky-500/20',
  'bg-amber-100 text-amber-600 ring-amber-500/25',
  'bg-orange-100 text-orange-600 ring-orange-500/20',
  'bg-cyan-100 text-cyan-600 ring-cyan-500/20',
  'bg-rose-100 text-rose-600 ring-rose-500/20',
  'bg-fuchsia-100 text-fuchsia-600 ring-fuchsia-500/20',
  'bg-indigo-100 text-indigo-600 ring-indigo-500/20',
]

/* deterministic mini bar-chart heights for the hero mock (14 days) */
const MOCK_BARS = [42, 68, 55, 80, 62, 90, 74, 58, 84, 66, 95, 72, 60, 88]
const MOCK_DONUT = 'conic-gradient(#10b981 0deg 241deg, #f59e0b 241deg 283deg, #ef4444 283deg 305deg, #e4e4e7 305deg 360deg)'

export function Landing() {
  const { world, setSurface, loading } = useES()

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#f6f8f4] text-zinc-900">
      {/* ── Ambient graphics: daylight mesh + dot grid + grain ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="bg-aurora noise absolute inset-0" />
        <div className="bg-grid-fade absolute inset-x-0 top-0 h-[40rem]" />
        <div className="absolute -top-40 left-[8%] h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl" />
        <div className="absolute top-24 right-[4%] h-64 w-64 rounded-full bg-violet-300/25 blur-3xl" />
      </div>

      {/* ── Top bar ── */}
      <header className="glass sticky top-0 z-30 border-x-0 border-t-0">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-6">
          <button onClick={() => setSurface('landing')} className="flex items-center gap-2.5">
            <span className="glow-emerald flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600">
              <QrCode className="h-4.5 w-4.5 text-white" />
            </span>
            <div className="text-left">
              <div className="font-display text-[14px] font-bold tracking-tight text-zinc-900">EasySourcing</div>
              <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-emerald-600">Platform Hub · v2.1</div>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setSurface('planner')} aria-label="Open deployment planner"
              className="flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-[12px] font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition hover:-translate-y-px hover:text-emerald-700 hover:ring-emerald-300">
              <Rocket className="h-3.5 w-3.5 text-violet-500" />
              <span className="hidden sm:inline">Deploy Planner</span>
            </button>
            <button onClick={() => setSurface('architecture')} aria-label="Open system architecture map"
              className="flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-[12px] font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition hover:-translate-y-px hover:text-violet-700 hover:ring-violet-300">
              <Network className="h-3.5 w-3.5 text-violet-500" />
              <span className="hidden sm:inline">Architecture</span>
            </button>
            <ModuleSwitcher current="Platform Hub" align="right" />
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative mx-auto max-w-6xl px-4 pt-14 sm:px-6 sm:pt-20">
        <div className="animate-fade-up mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-emerald-700 shadow-[0_8px_28px_-8px_rgba(16,185,129,0.4)] ring-1 ring-emerald-200">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
            Enterprise Asset Verification · Audit · Reconciliation
          </div>
          <h1 className="font-display mt-6 text-[2.7rem] font-bold leading-[1.03] tracking-tight text-zinc-900 sm:text-6xl">
            <span className="text-gradient">Every asset on Earth,</span><br />
            accountable in one loop.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-zinc-600">
            Not a CRUD inventory app — a controlled digital workflow that replaces spreadsheets, paper checklists
            and disconnected GPS records. From asset-register intake to the client-approved audit report.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-semibold tracking-wide text-zinc-700">
            <span className="inline-flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 ring-1 ring-emerald-500/20"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /></span>Every Asset.</span>
            <span className="inline-flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-100 ring-1 ring-teal-500/20"><MapPinned className="h-3.5 w-3.5 text-teal-600" /></span>Verified.</span>
            <span className="inline-flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-100 ring-1 ring-violet-500/20"><GitCompareArrows className="h-3.5 w-3.5 text-violet-600" /></span>Reconciled.</span>
            <span className="inline-flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 ring-1 ring-amber-500/25"><FileCheck2 className="h-3.5 w-3.5 text-amber-600" /></span>Accountable.</span>
          </div>
        </div>

        {/* ── Hero graphics: live white dashboard mock with vivid charts ── */}
        <div className="animate-fade-up relative mx-auto mt-12 max-w-4xl [animation-delay:150ms]">
          <div className="pointer-events-none absolute -inset-x-8 -top-10 bottom-8 rounded-[2.5rem] bg-gradient-to-br from-emerald-300/40 via-teal-200/30 to-violet-300/30 blur-3xl" aria-hidden />
          <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_32px_90px_-24px_rgba(6,78,59,0.35)] ring-1 ring-zinc-900/[0.06]">
            {/* browser chrome */}
            <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-3 flex h-6 flex-1 items-center gap-1.5 rounded-md bg-white px-2.5 font-mono text-[10px] text-zinc-500 ring-1 ring-zinc-200">
                <CircleCheck className="h-3 w-3 text-emerald-500" /> ops.easysourcing.in/overview
              </span>
              <span className="hidden items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-emerald-600 ring-1 ring-emerald-500/20 sm:flex">
                <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-500" /> live
              </span>
            </div>
            {/* mock body */}
            <div className="grid gap-3 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/40 p-4 sm:grid-cols-5 sm:p-5">
              {/* chart card */}
              <div className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-zinc-900/[0.05] sm:col-span-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-semibold text-zinc-800">Field verification activity</div>
                    <div className="text-[10px] text-zinc-500">synced from auditor devices · last 14 days</div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 ring-1 ring-emerald-500/20">
                    <TrendingUp className="h-3 w-3" /> +18%
                  </span>
                </div>
                <div className="mt-3 flex h-28 items-end gap-1.5">
                  {MOCK_BARS.map((h, i) => (
                    <div key={i} className="group relative flex-1">
                      <div
                        className={cn('w-full rounded-t-[4px] transition-all duration-300 group-hover:brightness-110', i % 3 === 1 ? 'bg-gradient-to-t from-teal-500/80 to-cyan-400' : 'bg-gradient-to-t from-emerald-600/80 to-emerald-400')}
                        style={{ height: `${h * 0.9}px`, animation: `es-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) ${0.25 + i * 0.045}s both` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {/* donut card */}
              <div className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-zinc-900/[0.05] sm:col-span-2">
                <div className="text-[12px] font-semibold text-zinc-800">Reconciliation</div>
                <div className="text-[10px] text-zinc-500">register vs physical</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative h-20 w-20 shrink-0 rounded-full shadow-[0_6px_18px_-6px_rgba(16,185,129,0.5)] animate-float" style={{ background: MOCK_DONUT }}>
                    <div className="absolute inset-[7px] flex flex-col items-center justify-center rounded-full bg-white">
                      <span className="text-[15px] font-extrabold tabular-nums text-zinc-900">{world ? `${world.stats.matchRate}%` : '77.7%'}</span>
                      <span className="text-[7.5px] font-semibold uppercase tracking-widest text-zinc-400">match</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {[
                      ['bg-emerald-500', 'Matched', '30'],
                      ['bg-amber-500', 'Exceptions', '7'],
                      ['bg-red-500', 'Missing', '2'],
                    ].map(([dot, label, n]) => (
                      <div key={label} className="flex items-center gap-1.5 text-[10.5px] text-zinc-600">
                        <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />{label}
                        <span className="ml-auto font-semibold tabular-nums text-zinc-900">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* KPI strip */}
              <div className="grid grid-cols-3 gap-3 sm:col-span-5">
                {[
                  ['Clients', world ? String(world.clients.length) : '5', 'from-violet-500/10 to-violet-500/[0.03] text-violet-700 ring-violet-500/15'],
                  ['Field verifications', world ? world.verifications.length.toLocaleString('en-IN') : '103', 'from-teal-500/10 to-teal-500/[0.03] text-teal-700 ring-teal-500/15'],
                  ['Open exceptions', world ? String(world.stats.openExceptions) : '18', 'from-amber-500/10 to-amber-500/[0.03] text-amber-700 ring-amber-500/20'],
                ].map(([k, v, tone]) => (
                  <div key={k} className={cn('rounded-xl bg-gradient-to-br p-3 ring-1', tone)}>
                    <div className="truncate text-[9.5px] font-bold uppercase tracking-widest text-zinc-500">{k}</div>
                    <div className="mt-1 text-xl font-extrabold tabular-nums">{v}</div>
                  </div>
                ))}
                <div className="hidden items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-zinc-900/[0.05] sm:col-span-3 sm:flex">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100"><TriangleAlert className="h-3 w-3 text-amber-600" /></span>Exception EX-2026-0025 auto-assigned to field lead</span>
                  <span className="font-mono text-[10px] text-zinc-400">just now</span>
                </div>
              </div>
            </div>
          </div>
          {/* floating chips — hover fully outside the panel so they never cover the chrome or data */}
          <div className="glass animate-float absolute -top-12 left-6 z-10 hidden items-center gap-2 rounded-xl px-3 py-2 shadow-[0_12px_32px_-12px_rgba(13,84,60,0.35)] lg:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-600"><ScanLine className="h-3.5 w-3.5 text-white" /></span>
            <div><div className="text-[11px] font-bold text-zinc-900">QR verified</div><div className="text-[9px] text-zinc-500">ES-MRD-00043 · GPS locked</div></div>
          </div>
          <div className="glass animate-float absolute -bottom-11 right-6 z-10 hidden items-center gap-2 rounded-xl px-3 py-2 shadow-[0_12px_32px_-12px_rgba(13,84,60,0.35)] [animation-delay:1.4s] lg:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600"><CircleCheck className="h-3.5 w-3.5 text-white" /></span>
            <div><div className="text-[11px] font-bold text-zinc-900">Report approved</div><div className="text-[9px] text-zinc-500">client signed · v3 final</div></div>
          </div>
        </div>
      </section>

      {/* ── The loop ── */}
      <section className="relative mx-auto mt-16 max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-[0_20px_50px_-24px_rgba(6,78,59,0.25)] ring-1 ring-zinc-900/[0.06]">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-200/60 to-teal-100/40 blur-3xl" aria-hidden />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> The differentiating loop
            </div>
            <div className="hidden text-[11px] font-medium text-zinc-500 sm:block">10 controlled stages · zero paper</div>
          </div>
          <div className="relative mt-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
            <div className="absolute left-0 right-0 top-[26px] mx-6 hidden h-0.5 bg-gradient-to-r from-emerald-300 via-violet-300 to-amber-300 lg:block" aria-hidden />
            <div className="relative flex items-center gap-1.5">
              {LOOP.map((s, i) => (
                <React.Fragment key={s.label}>
                  <div className="group flex shrink-0 flex-col items-center gap-1.5 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-zinc-900/[0.06] transition hover:-translate-y-1 hover:shadow-[0_10px_24px_-8px_rgba(6,78,59,0.25)]">
                    <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg ring-1 transition group-hover:scale-110', LOOP_TONES[i])}>{s.icon}</span>
                    <span className="whitespace-nowrap text-[11px] font-medium text-zinc-700">{s.label}</span>
                  </div>
                  {i < LOOP.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats band — vivid tinted tiles ── */}
      <section className="relative mx-auto mt-6 max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Clients on platform', world ? String(world.clients.length) : '—', 'from-emerald-500/[0.12] to-emerald-50 text-emerald-700 ring-emerald-500/20'],
            ['Assets under audit', world ? world.stats.assetsRegistered.toLocaleString('en-IN') : '—', 'from-violet-500/[0.12] to-violet-50 text-violet-700 ring-violet-500/20'],
            ['Field verifications', world ? world.verifications.length.toLocaleString('en-IN') : '—', 'from-teal-500/[0.12] to-teal-50 text-teal-700 ring-teal-500/20'],
            ['Match rate', world ? `${world.stats.matchRate}%` : '—', 'from-amber-500/[0.14] to-amber-50 text-amber-700 ring-amber-500/25'],
          ].map(([k, v, tone], i) => (
            <div key={k as string} className={cn('animate-fade-up card-hover rounded-2xl bg-gradient-to-br p-4 ring-1', tone)} style={{ animationDelay: `${i * 70}ms` }}>
              <div className="font-display text-[1.8rem] font-bold tabular-nums leading-none text-zinc-900">{v}</div>
              <div className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500">{k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Modules — standalone, connected ── */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="animate-fade-up text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Four standalone modules. <span className="text-gradient">One connected product.</span></h2>
          <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
            Each module ships with its own version, container image and deploy target — they could live in
            separate repos and separate hosts. They stay one product because every module speaks the same
            Core API contract and shares the versioned <span className="font-mono text-[11.5px] text-emerald-700">@es/shared</span> kernel.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {MODULES.filter((m) => m.kind !== 'shell').map((m, i) => (
            <div key={m.id} className="animate-fade-up" style={{ animationDelay: `${i * 90}ms` }}>
              <SurfaceCard m={m} onClick={() => setSurface(MODULE_SURFACE[m.id] ?? 'landing')} loading={loading} />
            </div>
          ))}
        </div>

        {/* Architecture + Planner banners — solid vivid gradient blocks */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <button onClick={() => setSurface('architecture')}
            className="group relative flex flex-col items-start gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-5 text-left text-white shadow-[0_20px_50px_-16px_rgba(147,51,234,0.55)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_64px_-16px_rgba(147,51,234,0.65)] sm:flex-row sm:items-center">
            <div className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full bg-white/15 blur-2xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-fuchsia-300/25 blur-2xl" aria-hidden />
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
              <Network className="h-5 w-5" />
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="block text-[15px] font-bold tracking-tight">See how “deploy separately, stay connected” works</span>
              <span className="mt-0.5 block text-[12.5px] text-white/80">
                Live topology map from the discovery endpoint — manifests, REST contracts, container images.
              </span>
            </span>
            <span className="relative flex shrink-0 items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-[12px] font-bold text-violet-700 shadow-sm transition group-hover:bg-violet-50">
              Open map <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </button>
          <button onClick={() => setSurface('planner')}
            className="group relative flex flex-col items-start gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-5 text-left text-white shadow-[0_20px_50px_-16px_rgba(13,148,136,0.55)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_64px_-16px_rgba(13,148,136,0.65)] sm:flex-row sm:items-center">
            <div className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full bg-white/15 blur-2xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-cyan-300/25 blur-2xl" aria-hidden />
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
              <Rocket className="h-5 w-5" />
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="block text-[15px] font-bold tracking-tight">Start free — plan your deploy by team size</span>
              <span className="mt-0.5 block text-[12.5px] text-white/80">
                ₹0 free-tier launch path, then scale to managed cloud. Interactive planner, zero guesswork.
              </span>
            </span>
            <span className="relative flex shrink-0 items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-[12px] font-bold text-teal-700 shadow-sm transition group-hover:bg-teal-50">
              Open planner <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>

        <div className="mt-12 flex flex-col items-center gap-1 pb-10 text-center">
          <div className="text-[11px] text-zinc-500">Built from the EasySourcing Project Master Summary v1.0 · B2B SaaS + managed audit services · Initial market: India</div>
          <div className="text-[11px] text-zinc-400">Demo data is fictional. Audit results are computed deterministically — AI never decides authoritative outcomes.</div>
        </div>
      </section>
    </div>
  )
}

function SurfaceCard({ m, onClick, loading }: { m: ModuleManifest; onClick: () => void; loading: boolean }) {
  const a = ACCENT_CLS[m.accent]
  const Icon = MODULE_ICONS[m.iconKey]
  const hoverShadow: Record<string, string> = {
    emerald: 'hover:shadow-[0_24px_56px_-20px_rgba(5,150,105,0.4)] hover:ring-emerald-300',
    teal: 'hover:shadow-[0_24px_56px_-20px_rgba(13,148,136,0.4)] hover:ring-teal-300',
    amber: 'hover:shadow-[0_24px_56px_-20px_rgba(234,88,12,0.4)] hover:ring-amber-300',
    violet: 'hover:shadow-[0_24px_56px_-20px_rgba(139,92,246,0.4)] hover:ring-violet-300',
  }
  return (
    <button onClick={onClick} disabled={loading}
      className={cn('group relative flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white p-5 text-left shadow-[0_10px_36px_-16px_rgba(6,78,59,0.18)] ring-1 ring-zinc-900/[0.06] transition-all duration-300 hover:-translate-y-1.5 hover:ring-2', hoverShadow[m.accent] ?? '')}>
      {/* accent corner wash */}
      <span className={cn('pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full opacity-[0.14] blur-2xl transition-opacity duration-300 group-hover:opacity-30', a.solid)} aria-hidden />
      <div className="relative flex items-center justify-between">
        <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl shadow-lg transition group-hover:scale-105 group-hover:rotate-3', a.solid)}>
          {<Icon className="h-5.5 w-5.5 text-white" />}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1', a.soft, a.text, a.ring)}>{m.kind === 'mobile' ? 'field pwa' : m.kind}</span>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 ring-1 ring-zinc-200">v{m.version}</span>
        </span>
      </div>
      <h3 className="font-display relative mt-4 text-lg font-bold tracking-tight text-zinc-900">{m.name}</h3>
      <p className="relative mt-1.5 flex-1 text-[13px] leading-relaxed text-zinc-600">{m.description}</p>
      <ul className="relative mt-3 space-y-1">
        {m.screens.slice(0, 3).map((p) => (
          <li key={p} className="flex items-center gap-2 text-[12px] font-medium text-zinc-700">
            <span className={cn('h-1.5 w-1.5 rounded-full', a.dot)} />{p}
          </li>
        ))}
        {m.screens.length > 3 && <li className="pl-3.5 text-[11px] text-zinc-400">+{m.screens.length - 3} more</li>}
      </ul>
      <div className="relative mt-3 space-y-1 border-t border-zinc-100 pt-3 font-mono text-[10px] text-zinc-500">
        <div className="flex items-center gap-1.5"><Globe className="h-3 w-3 shrink-0" /><span className="truncate">{m.deploy.target}</span></div>
        <div className="flex items-center gap-1.5"><Container className="h-3 w-3 shrink-0" /><span className="truncate">{m.deploy.image}</span></div>
      </div>
      <div className="relative mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
        <span className="text-[13px] font-bold text-zinc-900">Enter module</span>
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition group-hover:translate-x-1', a.solid)}>
          <ArrowRight className="h-3.5 w-3.5 text-white" />
        </span>
      </div>
    </button>
  )
}
