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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSurface('landing')} aria-label="Back to hub"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 transition hover:bg-white/10">
              <ArrowLeft className="h-4 w-4 text-zinc-300" />
            </button>
            <div>
              <div className="text-[13px] font-bold tracking-tight">System Architecture</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Standalone modules · connected by contract</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {reg?.service && (
              <span className="hidden items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300 ring-1 ring-white/10 sm:inline-flex">
                <span className={cn('h-1.5 w-1.5 animate-pulse rounded-full', reg.service.status === 'healthy' ? 'bg-emerald-400' : 'bg-red-400')} />
                core {reg.service.status} · {reg.service.latencyMs}ms
              </span>
            )}
            <button onClick={load} disabled={busy} aria-label="Refresh registry"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-50">
              <RefreshCw className={cn('h-3.5 w-3.5 text-zinc-300', busy && 'animate-spin')} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 lg:px-6">
        {/* Explainer strip */}
        <div className="pt-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-[12px] font-semibold text-violet-300">
            <GitBranch className="h-3.5 w-3.5" /> One platform · five deployable units · one REST contract
          </div>
          <h1 className="mx-auto mt-4 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
            Every module deploys separately. Together they are one product.
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-[13px] leading-relaxed text-zinc-400">
            Portals never import each other. They share zero code except the versioned <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[11.5px] text-zinc-300">@es/shared</code> kernel,
            and every write or read rides the Core API contract below — rendered live from the discovery endpoint, not a static picture.
          </p>
        </div>

        {err && (
          <div className="mx-auto mt-6 max-w-xl rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center text-[13px] text-red-300">
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
            <div className="absolute left-[16.66%] top-0 h-4 w-px bg-gradient-to-b from-white/20 to-white/10" />
            <div className="absolute left-1/2 top-0 h-4 w-px bg-gradient-to-b from-white/20 to-white/10" />
            <div className="absolute right-[16.66%] top-0 h-4 w-px bg-gradient-to-b from-white/20 to-white/10" />
            <div className="absolute left-[16.66%] right-[16.66%] top-4 h-px bg-white/10" />
            <div className="absolute left-1/2 top-4 h-8 w-px bg-gradient-to-b from-white/10 to-violet-400/40" />
            <span className="absolute left-1/2 top-[26px] -translate-x-1/2 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-violet-300">REST</span>
          </div>
          {/* Connector (mobile) */}
          <div className="mx-auto h-8 w-px bg-gradient-to-b from-white/20 to-violet-400/40 md:hidden" aria-hidden />

          {/* Core API service */}
          {reg ? (
            <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-b from-violet-500/[0.07] to-white/[0.02] shadow-xl shadow-violet-950/20">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-500/25">
                    <Boxes className="h-5 w-5 text-violet-300" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold tracking-tight">{reg.service.name}</span>
                      <span className="rounded bg-white/5 px-1.5 py-px font-mono text-[10px] text-zinc-400">v{reg.service.version}</span>
                    </div>
                    <div className="text-[11.5px] text-zinc-500">{reg.service.tagline}</div>
                  </div>
                </div>
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1',
                  reg.service.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20' : 'bg-red-500/10 text-red-300 ring-red-500/20')}>
                  <span className={cn('h-1.5 w-1.5 animate-pulse rounded-full', reg.service.status === 'healthy' ? 'bg-emerald-400' : 'bg-red-400')} />
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
                        <span className="truncate font-mono text-zinc-300">{c.path.replace('/api/core', '')}</span>
                        <span className="ml-auto hidden shrink-0 text-zinc-600 lg:inline">{c.purpose}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Runtime */}
                <div>
                  <MicroHead icon={<Database className="h-3 w-3" />} label={`Runtime · ${reg.service.db.engine}`} />
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {Object.entries(reg.service.db.counts).map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-center ring-1 ring-white/5">
                        <div className="text-[13px] font-bold tabular-nums text-zinc-100">{v.toLocaleString('en-IN')}</div>
                        <div className="truncate text-[9px] uppercase tracking-wide text-zinc-600">{k}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2.5 space-y-1 text-[10.5px] text-zinc-500">
                    <div className="flex items-center gap-1.5"><Globe className="h-3 w-3" /> deploys to <span className="font-mono text-zinc-400">{reg.service.deploy.target}</span></div>
                    <div className="flex items-center gap-1.5"><Container className="h-3 w-3" /> <span className="font-mono text-zinc-400">{reg.service.deploy.image}</span></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto h-40 max-w-3xl animate-pulse rounded-2xl bg-white/[0.03] ring-1 ring-white/5" />
          )}
        </div>

        {/* ── Why standalone works ─────────────────────────────── */}
        <div className="mt-12">
          <h2 className="text-center text-lg font-bold tracking-tight">How “deploy separately, stay connected” actually works</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Principle
              icon={<Rocket className="h-4.5 w-4.5 text-violet-300" />} title="Deploy independently"
              body="Each module carries its own manifest (name, semver, screens) and container image. Ops Portal can ship v2.2 on Tuesday while Client Portal stays on v2.0.3 — no lockstep releases, no shared runtime."
              foot="registry.es/<module>:<semver> · own pipeline"
            />
            <Principle
              icon={<GitBranch className="h-4.5 w-4.5 text-emerald-300" />} title="Connected by contract"
              body="Modules read and write only through the Core API. The contract above IS the integration — replace any portal with a rebuilt one and nothing else notices, as long as the calls still fit."
              foot="no cross-imports · REST only · idempotent writes"
            />
            <Principle
              icon={<PackageSearch className="h-4.5 w-4.5 text-amber-300" />} title="Shared kernel, versioned"
              body="Types, design tokens, formatting rules and domain views live in @es/shared and are consumed like any npm package — bumped deliberately, never silently, so modules stay visually and behaviorally one family."
              foot="@es/shared@2.1 · semver-bumped"
            />
          </div>
        </div>

        {/* ── Hub + shared kernel strip ────────────────────────── */}
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {hub && (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-500/25">
                    {React.createElement(MODULE_ICONS[hub.iconKey], { className: 'h-4.5 w-4.5 text-violet-300' })}
                  </span>
                  <div>
                    <div className="text-[14px] font-bold">{hub.name} <span className="ml-1 rounded bg-white/5 px-1.5 py-px font-mono text-[9.5px] text-zinc-500">v{hub.version}</span></div>
                    <div className="text-[11.5px] text-zinc-500">{hub.tagline} · {hub.deploy.target}</div>
                  </div>
                </div>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-zinc-400">shell</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {hub.screens.map((s) => (
                  <span key={s} className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[10.5px] text-zinc-400 ring-1 ring-white/5">{s}</span>
                ))}
              </div>
            </div>
          )}
          {reg && (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-500/25">
                  <ShieldCheck className="h-4.5 w-4.5 text-amber-300" />
                </span>
                <div>
                  <div className="text-[14px] font-bold">{reg.sharedKernel.name} <span className="ml-1 rounded bg-white/5 px-1.5 py-px font-mono text-[9.5px] text-zinc-500">v{reg.sharedKernel.version}</span></div>
                  <div className="text-[11.5px] text-zinc-500">{reg.sharedKernel.description}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                {reg.sharedKernel.exports.map((e) => (
                  <div key={e.name} className="truncate text-[10.5px] text-zinc-500"><span className="font-mono text-zinc-400">{e.name}</span> — {e.what}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-[10.5px] text-zinc-600">
          <Activity className="h-3 w-3" /> Rendered live from <span className="font-mono text-zinc-500">/api/core/registry</span> · {reg ? new Date(reg.generatedAt).toLocaleTimeString() : '—'}
        </div>
      </main>
    </div>
  )
}

function MicroHead({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
      {icon} {label}
    </div>
  )
}

function ModuleNode({ m, onOpen }: { m: ModuleManifest; onOpen: () => void }) {
  const a: (typeof ACCENT_CLS)[AccentKey] = ACCENT_CLS[m.accent]
  const Icon = MODULE_ICONS[m.iconKey as IconKey]
  const kindIcon = m.kind === 'mobile' ? <Smartphone className="h-3 w-3" /> : <MonitorSmartphone className="h-3 w-3" />
  return (
    <button onClick={onOpen}
      className="group flex flex-col rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-left transition hover:bg-white/[0.04] hover:ring-1 hover:ring-white/10">
      <div className="flex items-center justify-between">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl ring-1', a.soft, a.ring)}>
          <Icon className={cn('h-5 w-5', a.text)} />
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-zinc-400">{kindIcon} {m.kind}</span>
          <span className="rounded bg-white/5 px-1.5 py-px font-mono text-[10px] text-zinc-500">v{m.version}</span>
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[15px] font-bold tracking-tight text-white">{m.name}</span>
        <span className={cn('h-1.5 w-1.5 rounded-full', a.dot, 'animate-pulse')} />
      </div>
      <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{m.tagline}</p>

      <div className="mt-3 space-y-1 text-[10.5px] text-zinc-500">
        <div className="flex items-center gap-1.5 truncate"><Globe className="h-3 w-3 shrink-0" /> <span className="truncate font-mono text-zinc-400">{m.deploy.target}</span></div>
        <div className="flex items-center gap-1.5 truncate"><Container className="h-3 w-3 shrink-0" /> <span className="truncate font-mono text-zinc-400">{m.deploy.image}</span></div>
      </div>

      <div className="mt-3 border-t border-white/5 pt-2.5">
        <MicroHead icon={<FileJson className="h-3 w-3" />} label="consumes" />
        <ul className="mt-1.5 space-y-1">
          {m.apiContract.map((c) => (
            <li key={c.path + c.method} className="flex items-center gap-1.5 text-[10px]">
              <MethodBadge method={c.method} />
              <span className="truncate font-mono text-zinc-400">{c.path.replace('/api/core', '')}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5 text-[11px] font-semibold text-zinc-300">
        <span>{m.screens.length} screens · open module</span>
        <span className="text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-white">→</span>
      </div>
    </button>
  )
}

function Principle({ icon, title, body, foot }: { icon: React.ReactNode; title: string; body: string; foot: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">{icon}</span>
      <h3 className="mt-3 text-[15px] font-bold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-400">{body}</p>
      <div className="mt-3 border-t border-white/5 pt-2.5 font-mono text-[10px] text-zinc-600">{foot}</div>
    </div>
  )
}
