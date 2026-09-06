'use client'

// @es/shared · ModuleSwitcher
// The platform widget every standalone module mounts in its chrome. It renders
// purely from module manifests — a module joining the platform only needs to
// register its manifest and it appears here automatically.

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown, LayoutDashboard, ScanLine, Building2, Boxes, QrCode, Layers } from 'lucide-react'
import { useES } from './store'
import { METHOD_CLS, type IconKey, type ModuleManifest } from './module-contract'

export const MODULE_ICONS: Record<IconKey, React.ComponentType<{ className?: string }>> = {
  'layout-dashboard': LayoutDashboard,
  'scan-line': ScanLine,
  'building-2': Building2,
  'boxes': Boxes,
  'qr-code': QrCode,
}

// Light-theme accent tokens — vivid gradients for icon chips, deep 600-level
// text for contrast on white. Used by every module's chrome.
export const ACCENT_CLS: Record<string, { solid: string; soft: string; ring: string; text: string; dot: string }> = {
  emerald: { solid: 'bg-gradient-to-br from-emerald-400 to-teal-600', soft: 'bg-emerald-100', ring: 'ring-emerald-500/25', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  teal: { solid: 'bg-gradient-to-br from-teal-400 to-cyan-600', soft: 'bg-teal-100', ring: 'ring-teal-500/25', text: 'text-teal-600', dot: 'bg-teal-500' },
  amber: { solid: 'bg-gradient-to-br from-amber-400 to-orange-500', soft: 'bg-amber-100', ring: 'ring-amber-500/30', text: 'text-amber-600', dot: 'bg-amber-500' },
  violet: { solid: 'bg-gradient-to-br from-violet-400 to-fuchsia-600', soft: 'bg-violet-100', ring: 'ring-violet-500/25', text: 'text-violet-600', dot: 'bg-violet-500' },
}

export function ModuleSwitcher({ current, dark = true, align = 'left', direction = 'down', compact = false }: { current: string; dark?: boolean; align?: 'left' | 'right'; direction?: 'down' | 'up'; compact?: boolean }) {
  const { setSurface } = useES()
  const [open, setOpen] = useState(false)

  const items: { id: string; label: string; kind: string; version: string; iconKey: IconKey; accent: string; note: string }[] = [
    { id: 'landing', label: 'Platform Hub', kind: 'shell', version: '2.0.0', iconKey: 'qr-code', accent: 'violet', note: 'Home · discover modules' },
    { id: 'architecture', label: 'System Architecture', kind: 'map', version: '—', iconKey: 'boxes', accent: 'violet', note: 'Live topology & contracts' },
    { id: 'planner', label: 'Deployment Planner', kind: 'plan', version: '—', iconKey: 'boxes', accent: 'violet', note: 'Where modules run, by team size' },
    { id: 'ops', label: 'Operations Portal', kind: 'portal', version: '2.1.0', iconKey: 'layout-dashboard', accent: 'emerald', note: 'For EasySourcing teams' },
    { id: 'mobile', label: 'Auditor Mobile', kind: 'mobile', version: '2.1.1', iconKey: 'scan-line', accent: 'teal', note: 'For field auditors' },
    { id: 'client', label: 'Client Portal', kind: 'portal', version: '2.0.3', iconKey: 'building-2', accent: 'amber', note: 'For your customers' },
  ]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Switch module"
        className={cn(
          'flex h-9 items-center gap-2 rounded-lg bg-white px-2.5 text-[12px] font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50 hover:ring-zinc-300',
        )}
      >
        <Layers className="h-3.5 w-3.5 text-emerald-500" />
        {!compact && <span className="hidden sm:inline">{current}</span>}
        <ChevronsUpDown className="h-3 w-3 text-zinc-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className={cn(
            'absolute z-50 w-80 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl shadow-emerald-900/10',
            align === 'left' ? 'left-0' : 'right-0',
            direction === 'down' ? 'top-11' : 'bottom-11',
          )} role="menu">
            <div className="edge-gradient-top border-b border-zinc-100 bg-gradient-to-b from-emerald-50/80 to-white px-3.5 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Standalone modules</div>
              <div className="mt-0.5 text-[11px] text-zinc-500">Each ships &amp; deploys on its own — connected via the Core API</div>
            </div>
            <div className="p-1.5">
              {items.map((it) => {
                const Icon = MODULE_ICONS[it.iconKey]
                const a = ACCENT_CLS[it.accent]
                const active = it.id === current || (it.id === 'landing' && current === 'Platform Hub')
                return (
                  <button key={it.id} role="menuitem"
                    onClick={() => { setOpen(false); setSurface(it.id as 'landing') }}
                    className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition',
                      active ? 'bg-emerald-50/80 ring-1 ring-emerald-200/80' : 'hover:bg-zinc-50')}>
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1', a.soft, a.ring)}>
                      <Icon className={cn('h-4 w-4', a.text)} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[12.5px] font-semibold text-zinc-900">{it.label}</span>
                        <span className="shrink-0 rounded bg-zinc-100 px-1 py-px font-mono text-[9px] text-zinc-500">v{it.version}</span>
                      </span>
                      <span className="block truncate text-[10.5px] text-zinc-500">{it.note}</span>
                    </span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                  </button>
                )
              })}
            </div>
            <div className="border-t border-zinc-100 bg-zinc-50/60 px-3.5 py-2 text-[10px] text-zinc-500">
              Cross-module calls ride the REST contract — never direct imports.
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Method badge used across the architecture map and module cards */
export function MethodBadge({ method }: { method: 'GET' | 'POST' | 'PATCH' }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded px-1.5 py-px font-mono text-[9.5px] font-bold ring-1', METHOD_CLS[method])}>
      {method}
    </span>
  )
}
