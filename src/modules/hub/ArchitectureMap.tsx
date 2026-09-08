'use client'

// Hub · System Architecture — renders the standalone-but-connected topology
// LIVE from GET /api/core/registry. The map is not a diagram image: it is the
// same manifest payload the deployment pipelines consume.

import React, { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, RefreshCw, Globe, Container, Smartphone, MonitorSmartphone, Boxes, Database,
  GitBranch, Rocket, PackageSearch, ShieldCheck, Activity, FileJson,
} from 'lucide-react'
import { useES } from '../shared/store'
import { MODULE_SURFACE } from './registry'
import { MODULE_ICONS, ACCENT_CLS, MethodBadge } from '../shared/ModuleSwitcher'
import type { AccentKey, IconKey, ModuleManifest } from '../shared/module-contract'

interface RegistryPayload {
  platform: { name: string; tagline: string; platformVersion: string }
  service: ModuleManifest & {
    status: string; uptimeSeconds: number; latencyMs: number
    db: { ok: boolean; engine: string; counts: Record<string, number> }
  }
  modules: ModuleManifest[]
  sharedKernel: { name: string; version: string; description: string; exports: { name: string; what: string }[] }
  generatedAt: string
}

export function ArchitectureMap() {
  const { setSurface } = useES()
  const [reg, setReg] = useState<RegistryPayload | null>(null)
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(true)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/core/registry', { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      setReg(await res.json())
      setErr(false)
    } catch {
      setErr(true)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const portals = reg?.modules.filter((m) => m.kind !== 'shell' && m.kind !== 'service') ?? []
  const hub = reg?.modules.find((m) => m.kind === 'shell')

  return (
    <div className="relative isolate min-h-screen overflow-x-clip bg-[#f7f6fb] text-zinc-900">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="bg-aurora-violet noise absolute inset-0" />
        <div className="absolute -top-32 right-[10%] h-64 w-64 rounded-full bg-fuchsia-300/20 blur-3xl" />
      </div>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-violet-100/80 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSurface('landing')} aria-label="Back to hub"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50 hover:ring-violet-300">
              <ArrowLeft className="h-4 w-4 text-zinc-600" />
            </button>
            <div>
              <div className="font-display text-[13px] font-bold tracking-tight">System Architecture</div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-violet-500">Standalone modules · connected by contract</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {reg?.service && (
              <span className="hidden items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200 sm:inline-flex">
                <span className={cn('h-1.5 w-1.5 animate-pulse rounded-full', reg.service.status === 'healthy' ? 'bg-emerald-500' : 'bg-red-500')} />
                core {reg.service.status} · {reg.service.latencyMs}ms
              </span>
            )}
            <button onClick={load} disabled={busy} aria-label="Refresh registry"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50 hover:ring-violet-300 disabled:opacity-50">
              <RefreshCw className={cn('h-3.5 w-3.5 text-zinc-600', busy && 'animate-spin')} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 lg:px-6">
        {/* Explainer strip */}
        <div className="pt-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-violet-700 shadow-[0_8px_28px_-10px_rgba(139,92,246,0.5)] ring-1 ring-violet-200">
            <GitBranch className="h-3.5 w-3.5" /> One platform · five deployable units · one REST contract
          </div>
          <h1 className="font-display mx-auto mt-4 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
            Every module deploys separately. <span className="text-gradient-violet">Together they are one product.</span>
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
            Portals never import each other. They share zero code except the versioned <code className="rounded bg-violet-100 px-1 py-0.5 font-mono text-[11.5px] text-violet-700">@es/shared</code> kernel,
            and every write or read rides the Core API contract below — rendered live from the discovery endpoint, not a static picture.
          </p>
        </div>

        {err && (
          <div className="mx-auto mt-6 max-w-xl rounded-xl border border-red-200 bg-red-50 p-4 text-center text-[13px] text-red-700">
            Registry unreachable — the map renders from manifests only when the Core API answers. <button onClick={load} className="underline underline-offset-2">Retry</button>
          </div>
        )}

        {/* ── Topology ─────────────────────────────────────────── */}
        <div className="mt-10">
          {/* Portal modules */}
          <div className="grid gap-4 md:grid-cols-3">
            {portals.map((m) => <ModuleNode key={m.id} m={m} onOpen={() => setSurface(MODULE_SURFACE[m.id] ?? 'landing')} />)}
          </div>

          {/* Connectors (desktop) */}
          <div className="relative mx-auto hidden h-12 max-w-5xl md:block" aria-hidden>
            <div className="absolute left-[16.66%] top-0 h-4 w-px bg-gradient-to-b from-violet-300 to-zinc-300" />
            <div className="absolute left-1/2 top-0 h-4 w-px bg-gradient-to-b from-violet-300 to-zinc-300" />
            <div className="absolute right-[16.66%] top-0 h-4 w-px bg-gradient-to-b from-violet-300 to-zinc-300" />
            <div className="absolute left-[16.66%] right-[16.66%] top-4 h-px bg-zinc-300" />
            <div className="absolute left-1/2 top-4 h-8 w-px bg-gradient-to-b from-zinc-300 to-violet-500" />
            <span className="absolute left-1/2 top-[26px] -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white shadow-[0_4px_14px_-4px_rgba(147,51,234,0.6)]">REST</span>
          </div>
          {/* Connector (mobile) */}
          <div className="mx-auto h-8 w-px bg-gradient-to-b from-zinc-300 to-violet-500 md:hidden" aria-hidden />

          {/* Core API service */}
          {reg ? (
            <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_-24px_rgba(139,92,246,0.4)] ring-2 ring-violet-500/25">
              <div className="edge-gradient-top flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50/80 via-fuchsia-50/50 to-transparent px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-600 shadow-[0_6px_16px_-6px_rgba(147,51,234,0.6)]">
                    <Boxes className="h-5 w-5 text-white" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-[15px] font-bold tracking-tight">{reg.service.name}</span>
                      <span className="rounded bg-violet-100 px-1.5 py-px font-mono text-[10px] text-violet-700">v{reg.service.version}</span>
                    </div>
                    <div className="text-[11.5px] text-zinc-500">{reg.service.tagline}</div>
                  </div>
                </div>
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1',
                  reg.service.status === 'healthy' ? 'bg-emerald-50 text-emerald-700 ring-emerald-500/25' : 'bg-red-50 text-red-700 ring-red-500/25')}>
                  <span className={cn('h-1.5 w-1.5 animate-pulse rounded-full', reg.service.status === 'healthy' ? 'bg-emerald-500' : 'bg-red-500')} />
                  {reg.service.status} · up {Math.floor(reg.service.uptimeSeconds / 60)}m
                </span>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                {/* Endpoints */}
                <div>
                  <MicroHead icon={<FileJson className="h-3 w-3" />} label="API contract" />
                  <ul className="mt-2 space-y-1.5">
                    {reg.service.apiContract.map((c) => (
                      <li key={c.path} className="flex items-center gap-2 text-[11px]">
                        <MethodBadge method={c.method} />
                        <span className="truncate font-mono font-medium text-zinc-700">{c.path.replace('/api/core', '')}</span>
                        <span className="ml-auto hidden shrink-0 text-zinc-400 lg:inline">{c.purpose}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Runtime */}
                <div>
                  <MicroHead icon={<Database className="h-3 w-3" />} label={`Runtime · ${reg.service.db.engine}`} />
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {Object.entries(reg.service.db.counts).map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-gradient-to-b from-slate-50 to-white px-2 py-1.5 text-center ring-1 ring-zinc-200/80">
                        <div className="text-[13px] font-bold tabular-nums text-zinc-900">{v.toLocaleString('en-IN')}</div>
                        <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-zinc-400">{k}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2.5 space-y-1 text-[10.5px] text-zinc-500">
                    <div className="flex items-center gap-1.5"><Globe className="h-3 w-3" /> deploys to <span className="font-mono text-zinc-600">{reg.service.deploy.target}</span></div>
                    <div className="flex items-center gap-1.5"><Container className="h-3 w-3" /> <span className="font-mono text-zinc-600">{reg.service.deploy.image}</span></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto h-40 max-w-3xl animate-pulse rounded-2xl bg-white ring-1 ring-zinc-200" />
          )}
        </div>

        {/* ── Why standalone works ─────────────────────────────── */}
        <div className="mt-12">
          <h2 className="font-display text-center text-lg font-bold tracking-tight">How “deploy separately, stay connected” actually works</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Principle
              tone="violet"
              icon={<Rocket className="h-4.5 w-4.5" />} title="Deploy independently"
              body="Each module carries its own manifest (name, semver, screens) and container image. Ops Portal can ship v2.2 on Tuesday while Client Portal stays on v2.0.3 — no lockstep releases, no shared runtime."
              foot="registry.es/<module>:<semver> · own pipeline"
            />
            <Principle
              tone="emerald"
              icon={<GitBranch className="h-4.5 w-4.5" />} title="Connected by contract"
              body="Modules read and write only through the Core API. The contract above IS the integration — replace any portal with a rebuilt one and nothing else notices, as long as the calls still fit."
              foot="no cross-imports · REST only · idempotent writes"
            />
            <Principle
              tone="amber"
              icon={<PackageSearch className="h-4.5 w-4.5" />} title="Shared kernel, versioned"
              body="Types, design tokens, formatting rules and domain views live in @es/shared and are consumed like any npm package — bumped deliberately, never silently, so modules stay visually and behaviorally one family."
              foot="@es/shared@2.1 · semver-bumped"
            />
          </div>
        </div>

        {/* ── Hub + shared kernel strip ────────────────────────── */}
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {hub && (
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-900/[0.06]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-600 shadow-[0_6px_16px_-6px_rgba(147,51,234,0.5)]">
                    {React.createElement(MODULE_ICONS[hub.iconKey], { className: 'h-4.5 w-4.5 text-white' })}
                  </span>
                  <div>
                    <div className="text-[14px] font-bold">{hub.name} <span className="ml-1 rounded bg-violet-100 px-1.5 py-px font-mono text-[9.5px] text-violet-700">v{hub.version}</span></div>
                    <div className="text-[11.5px] text-zinc-500">{hub.tagline} · {hub.deploy.target}</div>
                  </div>
                </div>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-violet-700">shell</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {hub.screens.map((s) => (
                  <span key={s} className="rounded-full bg-gradient-to-b from-violet-50 to-white px-2.5 py-1 text-[10.5px] font-medium text-violet-700 ring-1 ring-violet-200/70">{s}</span>
                ))}
              </div>
            </div>
          )}
          {reg && (
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-900/[0.06]">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_6px_16px_-6px_rgba(234,88,12,0.5)]">
                  <ShieldCheck className="h-4.5 w-4.5 text-white" />
                </span>
                <div>
                  <div className="text-[14px] font-bold">{reg.sharedKernel.name} <span className="ml-1 rounded bg-amber-100 px-1.5 py-px font-mono text-[9.5px] text-amber-700">v{reg.sharedKernel.version}</span></div>
                  <div className="text-[11.5px] text-zinc-500">{reg.sharedKernel.description}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                {reg.sharedKernel.exports.map((e) => (
                  <div key={e.name} className="truncate text-[10.5px] text-zinc-500"><span className="font-mono text-zinc-700">{e.name}</span> — {e.what}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-[10.5px] text-zinc-500">
          <Activity className="h-3 w-3" /> Rendered live from <span className="font-mono text-zinc-600">/api/core/registry</span> · {reg ? new Date(reg.generatedAt).toLocaleTimeString() : '—'}
        </div>
      </main>
    </div>
  )
}

function MicroHead({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
      {icon} {label}
    </div>
  )
}

const NODE_TONE: Record<string, { chip: string; glow: string; ring: string }> = {
  emerald: { chip: 'bg-emerald-100 text-emerald-600 ring-emerald-500/25', glow: 'hover:shadow-[0_24px_56px_-20px_rgba(5,150,105,0.4)]', ring: 'hover:ring-emerald-300' },
  teal: { chip: 'bg-teal-100 text-teal-600 ring-teal-500/25', glow: 'hover:shadow-[0_24px_56px_-20px_rgba(13,148,136,0.4)]', ring: 'hover:ring-teal-300' },
  amber: { chip: 'bg-amber-100 text-amber-600 ring-amber-500/30', glow: 'hover:shadow-[0_24px_56px_-20px_rgba(234,88,12,0.4)]', ring: 'hover:ring-amber-300' },
  violet: { chip: 'bg-violet-100 text-violet-600 ring-violet-500/25', glow: 'hover:shadow-[0_24px_56px_-20px_rgba(139,92,246,0.4)]', ring: 'hover:ring-violet-300' },
}

function ModuleNode({ m, onOpen }: { m: ModuleManifest; onOpen: () => void }) {
  const a: (typeof ACCENT_CLS)[AccentKey] = ACCENT_CLS[m.accent]
  const t = NODE_TONE[m.accent] ?? NODE_TONE.emerald
  const Icon = MODULE_ICONS[m.iconKey as IconKey]
  const kindIcon = m.kind === 'mobile' ? <Smartphone className="h-3 w-3" /> : <MonitorSmartphone className="h-3 w-3" />
  return (
    <button onClick={onOpen}
      className={cn('group flex flex-col rounded-2xl bg-white p-4 text-left shadow-[0_10px_36px_-16px_rgba(6,78,59,0.18)] ring-1 ring-zinc-900/[0.06] transition-all duration-300 hover:-translate-y-1.5 hover:ring-2', t.glow, t.ring)}>
      <div className="flex items-center justify-between">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition group-hover:scale-105 group-hover:rotate-3', a.solid, 'shadow-md')}>
          <Icon className="h-5 w-5 text-white" />
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ring-1', a.soft, a.text, a.ring)}>{kindIcon} {m.kind}</span>
          <span className="rounded bg-zinc-100 px-1.5 py-px font-mono text-[10px] text-zinc-500 ring-1 ring-zinc-200">v{m.version}</span>
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="font-display text-[15px] font-bold tracking-tight text-zinc-900">{m.name}</span>
        <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse', a.dot)} />
      </div>
      <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{m.tagline}</p>

      <div className="mt-3 space-y-1 text-[10.5px] text-zinc-500">
        <div className="flex items-center gap-1.5 truncate"><Globe className="h-3 w-3 shrink-0" /> <span className="truncate font-mono text-zinc-600">{m.deploy.target}</span></div>
        <div className="flex items-center gap-1.5 truncate"><Container className="h-3 w-3 shrink-0" /> <span className="truncate font-mono text-zinc-600">{m.deploy.image}</span></div>
      </div>

      <div className="mt-3 border-t border-zinc-100 pt-2.5">
        <MicroHead icon={<FileJson className="h-3 w-3" />} label="consumes" />
        <ul className="mt-1.5 space-y-1">
          {m.apiContract.map((c) => (
            <li key={c.path + c.method} className="flex items-center gap-1.5 text-[10px]">
              <MethodBadge method={c.method} />
              <span className="truncate font-mono text-zinc-600">{c.path.replace('/api/core', '')}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5 text-[11px] font-bold text-zinc-700">
        <span>{m.screens.length} screens · open module</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:bg-zinc-900 group-hover:text-white">→</span>
      </div>
    </button>
  )
}

const PRINCIPLE_TONE: Record<string, { chip: string; ring: string }> = {
  violet: { chip: 'bg-gradient-to-br from-violet-400 to-fuchsia-600 text-white', ring: 'shadow-[0_6px_16px_-6px_rgba(147,51,234,0.5)]' },
  emerald: { chip: 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white', ring: 'shadow-[0_6px_16px_-6px_rgba(5,150,105,0.5)]' },
  amber: { chip: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white', ring: 'shadow-[0_6px_16px_-6px_rgba(234,88,12,0.5)]' },
}

function Principle({ icon, title, body, foot, tone }: { icon: React.ReactNode; title: string; body: string; foot: string; tone: 'violet' | 'emerald' | 'amber' }) {
  const t = PRINCIPLE_TONE[tone]
  return (
    <div className="card-hover rounded-2xl bg-white p-5 shadow-[0_10px_36px_-16px_rgba(6,78,59,0.18)] ring-1 ring-zinc-900/[0.06]">
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl shadow-md', t.chip, t.ring)}>{icon}</span>
      <h3 className="font-display mt-3 text-[15px] font-bold tracking-tight text-zinc-900">{title}</h3>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">{body}</p>
      <div className="mt-3 border-t border-zinc-100 pt-2.5 font-mono text-[10px] text-zinc-400">{foot}</div>
    </div>
  )
}
