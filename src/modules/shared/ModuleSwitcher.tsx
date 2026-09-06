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

export const ACCENT_CLS: Record<string, { solid: string; soft: string; ring: string; text: string; dot: string }> = {
  emerald: { solid: 'bg-emerald-500', soft: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  teal: { solid: 'bg-teal-500', soft: 'bg-teal-500/10', ring: 'ring-teal-500/20', text: 'text-teal-300', dot: 'bg-teal-400' },
  amber: { solid: 'bg-amber-500', soft: 'bg-amber-500/10', ring: 'ring-amber-500/20', text: 'text-amber-300', dot: 'bg-amber-400' },
  violet: { solid: 'bg-violet-500', soft: 'bg-violet-500/10', ring: 'ring-violet-500/20', text: 'text-violet-300', dot: 'bg-violet-400' },
}

export function ModuleSwitcher({ current, dark = true, align = 'left', direction = 'down', compact = false }: { current: string; dark?: boolean; align?: 'left' | 'right'; direction?: 'down' | 'up'; compact?: boolean }) {
  const { setSurface } = useES()
  const [open, setOpen] = useState(false)

  const items: { id: string; label: string; kind: string; version: string; iconKey: IconKey; accent: string; note: string }[] = [
    { id: 'landing', label: 'Platform Hub', kind: 'shell', version: '2.0.0', iconKey: 'qr-code', accent: 'violet', note: 'Home · discover modules' },
    { id: 'architecture', label: 'System Architecture', kind: 'map', version: '—', iconKey: 'boxes', accent: 'violet', note: 'Live topology & contracts' },
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
          'flex h-9 items-center gap-2 rounded-lg px-2.5 text-[12px] font-semibold transition',
          dark ? 'bg-white/5 text-zinc-200 ring-1 ring-white/10 hover:bg-white/10' : 'bg-zinc-900 text-white ring-1 ring-black/5 hover:bg-zinc-800',
        )}
      >
        <Layers className="h-3.5 w-3.5 text-zinc-400" />
        {!compact && <span className="hidden sm:inline">{current}</span>}
        <ChevronsUpDown className="h-3 w-3 text-zinc-500" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className={cn(
            'absolute z-50 w-80 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/50',
            align === 'left' ? 'left-0' : 'right-0',
            direction === 'down' ? 'top-11' : 'bottom-11',
          )} role="menu">
            <div className="border-b border-white/5 px-3.5 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Standalone modules</div>
              <div className="mt-0.5 text-[11px] text-zinc-500">Each ships & deploys on its own — connected via the Core API</div>
            </div>
            <div className="p-1.5">
              {items.map((it) => {
                const Icon = MODULE_ICONS[it.iconKey]
                const a = ACCENT_CLS[it.accent]
                const active = it.id === current || (it.id === 'landing' && current === 'Platform Hub')
                return (
                  <button key={it.id} role="menuitem"
                    onClick={() => { setOpen(false); setSurface(it.id as 'landing') }}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/5">
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1', a.soft, a.ring)}>
                      <Icon className={cn('h-4 w-4', a.text)} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[12.5px] font-semibold text-zinc-100">{it.label}</span>
                        <span className="shrink-0 rounded bg-white/5 px-1 py-px font-mono text-[9px] text-zinc-500">v{it.version}</span>
                      </span>
                      <span className="block truncate text-[10.5px] text-zinc-500">{it.note}</span>
                    </span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
                  </button>
                )
              })}
            </div>
            <div className="border-t border-white/5 px-3.5 py-2 text-[10px] text-zinc-600">
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
