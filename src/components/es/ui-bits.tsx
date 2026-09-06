'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Camera, MapPin } from 'lucide-react'
import { seedColor } from '@/lib/es-format'

// ── Status pill with dot ─────────────────────────────────────────
export function Pill({ meta, className, size = 'sm' }: { meta: { label: string; cls: string; dot?: string }; className?: string; size?: 'sm' | 'xs' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[11px]',
      meta.cls, className,
    )}>
      {meta.dot && <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />}
      {meta.label}
    </span>
  )
}

export function SimpleBadge({ label, cls }: { label: string; cls: string }) {
  return <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap', cls)}>{label}</span>
}

// ── Section header ───────────────────────────────────────────────
export function SectionHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-zinc-500">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function MicroLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('text-[11px] font-semibold uppercase tracking-wider text-zinc-400', className)}>{children}</div>
}

// ── KPI card ─────────────────────────────────────────────────────
export function Kpi({ label, value, sub, icon, tone = 'default', onClick }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode
  tone?: 'default' | 'emerald' | 'amber' | 'red' | 'teal'; onClick?: () => void
}) {
  const tones: Record<string, string> = {
    default: 'bg-zinc-900 text-white', emerald: 'bg-emerald-600 text-white', teal: 'bg-teal-600 text-white',
    amber: 'bg-amber-500 text-white', red: 'bg-red-600 text-white',
  }
  return (
    <button
      onClick={onClick} disabled={!onClick}
      className={cn(
        'group flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition',
        onClick && 'cursor-pointer hover:border-zinc-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]',
      )}
    >
      <div className="flex items-center justify-between w-full">
        <MicroLabel>{label}</MicroLabel>
        {icon && <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', tones[tone])}>{icon}</span>}
      </div>
      <div>
        <div className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
      </div>
    </button>
  )
}

// ── Progress bar ─────────────────────────────────────────────────
export function Bar({ value, className, barClass }: { value: number; className?: string; barClass?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-zinc-100', className)}>
      <div className={cn('h-full rounded-full bg-emerald-500 transition-all duration-500', barClass)} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

// ── Fake "photo" evidence thumbnail (deterministic abstract visual) ──
export function EvidenceThumb({ seed, code, kind = 'photo', className }: { seed: string; code?: string | null; kind?: string; className?: string }) {
  const c = seedColor[seed] ?? seedColor.emerald
  return (
    <div className={cn(
      'relative flex items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br aspect-[4/3]',
      c.from, c.to, className,
    )}>
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 30%, white 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
      <div className="relative flex flex-col items-center gap-1 text-white/90">
        {kind === 'gps' ? <MapPin className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
        {code && <span className="max-w-[90%] truncate rounded bg-black/25 px-1.5 py-0.5 font-mono text-[9px] tracking-wide">{code}</span>}
      </div>
    </div>
  )
}

// ── Avatar ───────────────────────────────────────────────────────
export function Avatar({ name, seed = 'emerald', size = 'md', ring = false }: { name: string; seed?: string; size?: 'sm' | 'md' | 'lg'; ring?: boolean }) {
  const c = seedColor[seed] ?? seedColor.emerald
  const sz = size === 'sm' ? 'h-6 w-6 text-[10px]' : size === 'lg' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-xs'
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white', c.from, c.to, sz, ring && 'ring-2 ring-white')}>
      {name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
    </span>
  )
}

// ── Empty state ──────────────────────────────────────────────────
export function EmptyState({ icon, title, sub }: { icon?: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-12 text-center">
      {icon && <div className="text-zinc-300">{icon}</div>}
      <div className="text-sm font-medium text-zinc-600">{title}</div>
      {sub && <div className="max-w-sm text-xs text-zinc-400">{sub}</div>}
    </div>
  )
}

// ── Tiny Sparkline-free stat row ─────────────────────────────────
export function StatRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className={cn('font-medium tabular-nums text-zinc-900', tone)}>{value}</span>
    </div>
  )
}
