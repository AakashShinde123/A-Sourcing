'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Camera, MapPin } from 'lucide-react'
import { seedColor } from '@/modules/shared/format'

// ── Status pill with dot ─────────────────────────────────────────
export function Pill({ meta, className, size = 'sm' }: { meta: { label: string; cls: string; dot?: string }; className?: string; size?: 'sm' | 'xs' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset whitespace-nowrap',
      size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-2 py-0.5 text-[11px]',
      meta.cls, className,
    )}>
      {meta.dot && <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot, 'shadow-sm')} />}
      {meta.label}
    </span>
  )
}

export function SimpleBadge({ label, cls }: { label: string; cls: string }) {
  return <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap', cls)}>{label}</span>
}

// ── Section header ───────────────────────────────────────────────
export function SectionHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-[5px] h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-emerald-400 to-teal-500" aria-hidden />
        <div>
          <h2 className="text-[15px] font-bold tracking-tight text-zinc-900">{title}</h2>
          {sub && <p className="mt-0.5 text-[12.5px] text-zinc-500">{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

export function MicroLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400', className)}>{children}</div>
}

// ── KPI card ─────────────────────────────────────────────────────
const KPI_TONES: Record<string, { chip: string; glow: string }> = {
  default: { chip: 'bg-gradient-to-br from-zinc-700 to-zinc-900 text-white', glow: '' },
  emerald: { chip: 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white', glow: 'shadow-[0_6px_16px_-6px_rgba(16,185,129,0.6)]' },
  teal: { chip: 'bg-gradient-to-br from-teal-400 to-cyan-600 text-white', glow: 'shadow-[0_6px_16px_-6px_rgba(20,184,166,0.6)]' },
  amber: { chip: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white', glow: 'shadow-[0_6px_16px_-6px_rgba(245,158,11,0.6)]' },
  red: { chip: 'bg-gradient-to-br from-red-400 to-rose-600 text-white', glow: 'shadow-[0_6px_16px_-6px_rgba(239,68,68,0.6)]' },
}

export function Kpi({ label, value, sub, icon, tone = 'default', onClick }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode
  tone?: 'default' | 'emerald' | 'amber' | 'red' | 'teal'; onClick?: () => void
}) {
  const t = KPI_TONES[tone] ?? KPI_TONES.default
  return (
    <button
      onClick={onClick} disabled={!onClick}
      className={cn(
        'card group relative flex w-full flex-col gap-3 overflow-hidden p-4 text-left',
        onClick && 'card-hover cursor-pointer',
      )}
    >
      {/* soft accent wash in the corner */}
      {tone !== 'default' && (
        <span className={cn('pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-[0.07]', t.chip)} aria-hidden />
      )}
      <div className="flex w-full items-center justify-between">
        <MicroLabel>{label}</MicroLabel>
        {icon && <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl ring-1 ring-black/5 transition group-hover:scale-105', t.chip, t.glow)}>{icon}</span>}
      </div>
      <div>
        <div className="text-[1.65rem] font-extrabold leading-none tracking-tight text-zinc-900 tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
      </div>
    </button>
  )
}

// ── Progress bar ─────────────────────────────────────────────────
export function Bar({ value, className, barClass }: { value: number; className?: string; barClass?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 ring-1 ring-inset ring-zinc-200/60', className)}>
      <div
        className={cn('h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500', barClass)}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  )
}

// ── Fake "photo" evidence thumbnail (deterministic abstract visual) ──
export function EvidenceThumb({ seed, code, kind = 'photo', className }: { seed: string; code?: string | null; kind?: string; className?: string }) {
  const c = seedColor[seed] ?? seedColor.emerald
  return (
    <div className={cn(
      'relative flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br shadow-sm ring-1 ring-black/5 aspect-[4/3]',
      c.from, c.to, className,
    )}>
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 30%, white 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
      <div className="absolute -right-3 -top-3 h-12 w-12 rounded-full bg-white/15 blur-xl" aria-hidden />
      <div className="relative flex flex-col items-center gap-1 text-white/90 drop-shadow-sm">
        {kind === 'gps' ? <MapPin className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
        {code && <span className="max-w-[90%] truncate rounded bg-black/25 px-1.5 py-0.5 font-mono text-[9px] tracking-wide backdrop-blur-sm">{code}</span>}
      </div>
    </div>
  )
}

// ── Avatar ───────────────────────────────────────────────────────
export function Avatar({ name, seed = 'emerald', size = 'md', ring = false }: { name: string; seed?: string; size?: 'sm' | 'md' | 'lg'; ring?: boolean }) {
  const c = seedColor[seed] ?? seedColor.emerald
  const sz = size === 'sm' ? 'h-6 w-6 text-[10px]' : size === 'lg' ? 'h-11 w-11 text-sm' : 'h-8 w-8 text-xs'
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white shadow-sm ring-1 ring-black/5', c.from, c.to, sz, ring && 'ring-2 ring-white')}>
      {name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
    </span>
  )
}

// ── Empty state ──────────────────────────────────────────────────
export function EmptyState({ icon, title, sub }: { icon?: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-zinc-300/80 bg-gradient-to-b from-zinc-50/80 to-white px-6 py-12 text-center">
      {icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-zinc-300 shadow-sm ring-1 ring-zinc-200">
          {icon}
        </span>
      )}
      <div className="text-sm font-semibold text-zinc-600">{title}</div>
      {sub && <div className="max-w-sm text-xs text-zinc-400">{sub}</div>}
    </div>
  )
}

// ── Tiny Sparkline-free stat row ─────────────────────────────────
export function StatRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className={cn('font-semibold tabular-nums text-zinc-900', tone)}>{value}</span>
    </div>
  )
}
