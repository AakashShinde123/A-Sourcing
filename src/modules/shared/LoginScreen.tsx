'use client'

// @es/shared · LoginScreen — the front door of the private team workspace.
// Light theme only. Every element ≥44px touch target; error copy comes straight
// from the Core API (invalid credentials / lockout countdown / deactivation).

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Loader2, QrCode, Eye, EyeOff, ShieldCheck, Lock, Mail, ArrowRight, ChevronDown, Fingerprint, FileCheck2, ScanLine, Globe2, KeyRound } from 'lucide-react'
import { useES } from './store'

const DEMO_ACCOUNTS = [
  { label: 'Admin', name: 'Platform Admin', email: 'admin@easysourcing.in', password: 'Admin@2026', cls: 'violet' },
  { label: 'Ops', name: 'Meera · Operations', email: 'ops@easysourcing.in', password: 'Ops@2026', cls: 'emerald' },
  { label: 'Client', name: 'Kavita · Meridian', email: 'client@easysourcing.in', password: 'Client@2026', cls: 'amber' },
  { label: 'Auditor', name: 'Arjun · Field', email: 'auditor@easysourcing.in', password: 'Field@2026', cls: 'teal' },
]

const CHIP_CLS: Record<string, string> = {
  violet: 'bg-violet-100 text-violet-700 ring-violet-200 hover:bg-violet-150',
  emerald: 'bg-emerald-100 text-emerald-700 ring-emerald-200 hover:bg-emerald-150',
  amber: 'bg-amber-100 text-amber-700 ring-amber-200 hover:bg-amber-150',
  teal: 'bg-teal-100 text-teal-700 ring-teal-200 hover:bg-teal-150',
}

export function LoginScreen() {
  const { login } = useES()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDemo, setShowDemo] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !email.trim() || !password) return
    setBusy(true)
    setError(null)
    const res = await login(email.trim(), password, remember)
    if (!res.ok) setError(res.error ?? 'Sign-in failed')
    setBusy(false)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f6f8f4] lg:flex-row">
      {/* Brand panel */}
      <div className="relative flex shrink-0 items-center gap-3 overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 px-6 py-6 text-white lg:w-[44%] lg:flex-col lg:items-start lg:justify-between lg:px-12 lg:py-14">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-10 top-1/2 hidden h-40 w-40 rounded-full bg-emerald-300/20 blur-2xl lg:block" />
        </div>

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/30 backdrop-blur">
            <QrCode className="h-6 w-6" />
          </span>
          <div>
            <div className="font-display text-lg font-bold tracking-tight">EasySourcing</div>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-emerald-100">Asset verification platform</div>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <h1 className="max-w-md text-4xl font-bold leading-[1.12] tracking-tight">Your assets. Verified. Only your team&apos;s eyes.</h1>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-emerald-50/90">
            This workspace is private — every screen, API call and audit event stays inside your company.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              { icon: Lock, t: 'Role-scoped access', d: 'Admin · Ops · Client · Field — each sees only their world' },
              { icon: Fingerprint, t: 'Hardened sign-in', d: 'Bcrypt passwords, lockouts, signed httpOnly sessions' },
              { icon: FileCheck2, t: 'Everything audited', d: 'Every login, import and decision lands in the trail' },
              { icon: ScanLine, t: 'Field-ready', d: 'Scan tags, capture GPS + photos, sync offline' },
            ].map((f) => (
              <li key={f.t} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                  <f.icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-[14px] font-semibold">{f.t}</span>
                  <span className="block text-[12.5px] text-emerald-50/80">{f.d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative hidden items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/80 lg:flex">
          <Globe2 className="h-3.5 w-3.5" /> Private deployment · team accounts only
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-7 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.6)]">
              <QrCode className="h-4.5 w-4.5 text-white" />
            </span>
            <div className="font-display text-[15px] font-bold tracking-tight text-zinc-900">EasySourcing</div>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 ring-1 ring-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure team access
          </div>
          <h2 className="mt-3 text-[26px] font-bold tracking-tight text-zinc-900">Sign in to your workspace</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-500">Not a public site — accounts are issued by your platform admin.</p>

          {error && (
            <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-xl bg-red-50 px-3.5 py-3 text-[13px] font-medium text-red-700 ring-1 ring-red-200">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">Work email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourcompany.com"
                  className="h-12 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3.5 text-[14px] text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.12)]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">Password</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-12 text-[14px] text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.12)]"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px] font-medium text-zinc-600 select-none">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500/30" />
              Keep me signed in for 30 days
            </label>

            <button type="submit" disabled={busy || !email.trim() || !password}
              className={cn(
                'flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold text-white transition',
                'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-[0_6px_18px_-6px_rgba(16,185,129,0.8)] hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/25',
                (busy || !email.trim() || !password) && 'pointer-events-none opacity-60',
              )}>
              {busy ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <div className="mt-6">
            <button type="button" onClick={() => setShowDemo((v) => !v)}
              className="flex min-h-11 w-full items-center justify-between rounded-xl bg-zinc-100/80 px-3.5 text-[12.5px] font-semibold text-zinc-600 transition hover:bg-zinc-100">
              Starter team accounts (demo passwords)
              <ChevronDown className={cn('h-4 w-4 text-zinc-400 transition', showDemo && 'rotate-180')} />
            </button>
            {showDemo && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((d) => (
                  <button key={d.email} type="button"
                    onClick={() => { setEmail(d.email); setPassword(d.password); setError(null) }}
                    className={cn('flex min-h-11 flex-col items-start rounded-xl px-3 py-2 text-left ring-1 transition', CHIP_CLS[d.cls])}>
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">{d.label}</span>
                    <span className="truncate text-[12px] font-semibold">{d.name}</span>
                    <span className="truncate font-mono text-[10px] opacity-70">{d.email}</span>
                  </button>
                ))}
                <p className="col-span-2 mt-1 text-[11px] leading-relaxed text-zinc-400">
                  Tap a card to fill the form — replace these starter passwords from <span className="font-semibold text-zinc-500">Ops Portal → Access</span> before real use.
                </p>
              </div>
            )}
          </div>

          <p className="mt-8 text-center text-[11px] leading-relaxed text-zinc-400">
            Protected by bcrypt hashing, brute-force lockouts and signed httpOnly sessions.<br />All sign-in activity is recorded in the audit trail.
          </p>
        </div>
      </div>
    </div>
  )
}
