'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { QrCode, LayoutDashboard, ScanLine, Building2, ArrowRight, ShieldCheck, FileCheck2, MapPinned, Camera, GitCompareArrows, FolderSearch, Stamp, FileText, ClipboardCheck, Boxes } from 'lucide-react'
import { useES } from './store'

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

      {/* Surfaces */}
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">Three surfaces, one workflow</h2>
          <p className="mx-auto mt-2 max-w-xl text-[13px] leading-relaxed text-zinc-400">
            Live demo data runs end-to-end: verify an asset on the phone and watch the exception, reconciliation and
            dashboards update across both portals.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <SurfaceCard
            icon={<LayoutDashboard className="h-6 w-6" />} accent="emerald"
            title="Operations Portal" tag="For EasySourcing teams"
            desc="Clients, asset register, audits, assignments, exception center, evidence, reports, analytics and the append-only audit trail — desktop-first and data-dense."
            points={['KPI cockpit & live field telemetry', 'Deterministic reconciliation results', 'Exception lifecycle governance']}
            cta="Enter Operations" onClick={() => setSurface('ops')} loading={loading}
          />
          <SurfaceCard
            icon={<ScanLine className="h-6 w-6" />} accent="teal"
            title="Auditor Mobile" tag="For field auditors"
            desc="A dedicated field experience: scan, verify, photograph, capture GPS — fully offline-first with an idempotent sync queue that never duplicates events."
            points={['10–20 second verification loop', 'Works in airplane mode', 'Sheet-to-floor & floor-to-sheet']}
            cta="Enter Field App" onClick={() => setSurface('mobile')} loading={loading}
          />
          <SurfaceCard
            icon={<Building2 className="h-6 w-6" />} accent="amber"
            title="Client Portal" tag="For your customers"
            desc="Customers see only their organization: audit progress, assets, exceptions, evidence and reports — with formal approvals that finalize the audit."
            points={['Evidence-backed transparency', 'Granular, server-side permissions', 'One-click audit sign-off']}
            cta="Enter Client Portal" onClick={() => setSurface('client')} loading={loading}
          />
        </div>

        <div className="mt-10 flex flex-col items-center gap-1 pb-8 text-center">
          <div className="text-[11px] text-zinc-600">Built from the EasySourcing Project Master Summary v1.0 · B2B SaaS + managed audit services · Initial market: India</div>
          <div className="text-[11px] text-zinc-700">Demo data is fictional. Audit results are computed deterministically — AI never decides authoritative outcomes.</div>
        </div>
      </div>
    </div>
  )
}

function SurfaceCard({ icon, title, tag, desc, points, cta, onClick, accent, loading }: {
  icon: React.ReactNode; title: string; tag: string; desc: string; points: string[]; cta: string
  onClick: () => void; accent: 'emerald' | 'teal' | 'amber'; loading: boolean
}) {
  const accents = {
    emerald: { bg: 'bg-emerald-500', soft: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20', hover: 'hover:border-emerald-500/40' },
    teal: { bg: 'bg-teal-500', soft: 'bg-teal-500/10 text-teal-300 ring-teal-500/20', hover: 'hover:border-teal-500/40' },
    amber: { bg: 'bg-amber-500', soft: 'bg-amber-500/10 text-amber-300 ring-amber-500/20', hover: 'hover:border-amber-500/40' },
  }[accent]
  return (
    <button onClick={onClick}
      className={cn('group flex flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-5 text-left transition hover:bg-white/[0.05]', accents.hover)}>
      <div className="flex items-center justify-between">
        <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl ring-1', accents.soft)}>{icon}</span>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{tag}</span>
      </div>
      <h3 className="mt-4 text-lg font-bold tracking-tight text-white">{title}</h3>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-zinc-400">{desc}</p>
      <ul className="mt-3 space-y-1">
        {points.map((p) => (
          <li key={p} className="flex items-center gap-2 text-[12px] text-zinc-300">
            <span className={cn('h-1 w-1 rounded-full', accents.bg)} />{p}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
        <span className="text-[13px] font-semibold text-white">{cta}</span>
        <ArrowRight className="h-4 w-4 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-white" />
      </div>
    </button>
  )
}
