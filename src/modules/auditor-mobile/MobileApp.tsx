'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useES } from '@/modules/shared/store'
import { ModuleSwitcher } from '@/modules/shared/ModuleSwitcher'
import { ScanFlow } from './ScanFlow'
import { Avatar, Bar as ProgressBar, Pill } from '@/modules/shared/ui-bits'
import { resultMeta, fmtDateShort, exceptionTypeMeta } from '@/modules/shared/format'
import type { QueueOp } from '@/modules/shared/types'
import {
  Home, ClipboardList, ScanLine, ShieldAlert, User, Wifi, WifiOff, RefreshCw, Loader2,
  CheckCircle2, Clock, BatteryFull, SignalHigh, ScanFace, LogOut, ChevronRight, MapPin,
} from 'lucide-react'

const QUEUE_KEY = 'es-offline-queue'

export function MobileApp() {
  const { world, setSurface, submitVerifications } = useES()
  const [tab, setTab] = useState<'home' | 'assignments' | 'scan' | 'exceptions' | 'profile'>('home')
  const [online, setOnline] = useState(true)
  const [queue, setQueue] = useState<QueueOp[]>([])
  const [syncing, setSyncing] = useState(false)

  // load queue from "device storage"
  useEffect(() => {
    try { setQueue(JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')) } catch { setQueue([]) }
    const handler = (e: Event) => {
      const op = (e as CustomEvent).detail as QueueOp
      setQueue((q) => {
        const next = [...q, op]
        localStorage.setItem(QUEUE_KEY, JSON.stringify(next))
        return next
      })
    }
    window.addEventListener('es-queue-add', handler)
    return () => window.removeEventListener('es-queue-add', handler)
  }, [])

  async function syncQueue() {
    if (!queue.length || syncing || !online) return
    setSyncing(true)
    try {
      const r = await submitVerifications(queue)
      setQueue([])
      localStorage.setItem(QUEUE_KEY, '[]')
      toast.success(`${r.applied} operation${r.applied === 1 ? '' : 's'} synced`, {
        description: r.skipped ? `${r.skipped} duplicate(s) skipped — idempotent sync engine.` : 'Server validated, persisted transactionally.',
      })
    } finally {
      setSyncing(false)
    }
  }

  const me = world?.auditors.find((a) => a.id === 'adr_1')
  const assignment = useMemo(() => world?.assignments.find((a) => a.id === 'asg_1'), [world])
  const myAssets = useMemo(() => (world ? world.assets.filter((a) => a.assignmentId === 'asg_1') : []), [world])
  const myVerifs = useMemo(() => (world?.verifications ?? []).filter((v) => v.assignmentId === 'asg_1'), [world])
  const verifiedCount = new Set(myVerifs.map((v) => v.assetId)).size
  const exceptionCount = myVerifs.filter((v) => v.result !== 'matched' && v.result !== 'deferred').length
  const pendingCount = Math.max(0, myAssets.length - verifiedCount)
  const progress = myAssets.length ? Math.round((verifiedCount / myAssets.length) * 100) : 0
  const myExceptions = useMemo(() => (world?.exceptions ?? []).filter((e) => ['exc', 'EX'].some(() => true) && (e.detectedBy === me?.name || myVerifs.some((v) => v.assetId === e.assetId))), [world, me, myVerifs])

  return (
    <div className="flex min-h-dvh flex-col items-stretch justify-center bg-zinc-950 sm:min-h-screen sm:flex-row sm:items-center sm:gap-8 sm:bg-zinc-100 sm:px-4 sm:py-6">
      {/* Explainer panel (desktop only) */}
      <div className="hidden max-w-sm flex-col justify-center lg:flex">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600">Surface 3 · Auditor Mobile</div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">A dedicated field experience — not a shrunken portal.</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
          Arjun Mehta is verifying <strong className="text-zinc-700">Chakan Plant — Production Block A</strong> for Meridian&rsquo;s annual audit.
          The app is offline-first: the assignment scope was downloaded before entering the shop floor.
        </p>
        <div className="mt-4 space-y-2.5">
          {[
            ['1', 'Tap SCAN ASSET and let the viewfinder lock on a QR tag'],
            ['2', 'Compare expected vs found, pick a result, add photos — GPS stamps automatically'],
            ['3', 'Toggle airplane mode (top-right of phone) and keep verifying — ops queue locally'],
            ['4', 'Reconnect and sync — the idempotent engine never duplicates events'],
            ['5', 'Watch the Ops Portal & Client Portal update instantly after sync'],
          ].map(([n, t]) => (
            <div key={n} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">{n}</span>
              <span className="text-[13px] leading-snug text-zinc-600">{t}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2">
          <ModuleSwitcher current="Auditor Mobile" dark={false} direction="up" />
          <button onClick={() => setSurface('landing')} className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-[13px] font-medium text-zinc-700 transition hover:border-zinc-400">
            ← Hub
          </button>
        </div>
      </div>

      {/* Phone — full-bleed app on real phones, decorative frame on tablets/desktop */}
      <div className="relative flex w-full flex-1 flex-col sm:h-[780px] sm:w-[380px] sm:max-w-full sm:flex-none sm:rounded-[2.6rem] sm:border-[10px] sm:border-zinc-900 sm:shadow-2xl">
        {/* notch (decorative devices only) */}
        <div className="absolute left-1/2 top-0 z-40 hidden h-6 w-36 -translate-x-1/2 rounded-b-2xl bg-zinc-900 sm:block" />
        {/* status bar */}
        <div className="relative z-30 flex items-center justify-between bg-zinc-950 px-5 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))] text-[10px] font-medium text-zinc-300 sm:px-6">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => { const next = !online; setOnline(next); toast.info(next ? 'Back online' : 'Airplane mode ON', { description: next ? 'Queued operations can now sync.' : 'Verifications will queue on device.' }) }}
                className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 transition', online ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' : 'bg-amber-500/15 text-amber-300 ring-amber-500/30')}>
                {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {online ? 'ONLINE' : 'OFFLINE'}
              </button>
              <SignalHigh className="h-3 w-3" />
              <BatteryFull className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* content */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {tab === 'scan' ? (
              <ScanFlow onExit={() => setTab('home')} online={online} />
            ) : (
              <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
                <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
                  {tab === 'home' && me && assignment && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[11px] text-zinc-500">Good morning,</div>
                          <div className="text-[16px] font-bold text-white">{me.name.split(' ')[0]} 👋</div>
                        </div>
                        <Avatar name={me.name} seed={me.colorSeed} />
                      </div>

                      {/* assignment card */}
                      <div className="relative mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/[0.14] via-zinc-900 to-zinc-950 p-4 ring-1 ring-emerald-400/20">
                        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-500/20 blur-3xl" aria-hidden />
                        <div className="relative flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">Current assignment</span>
                          <span className="font-mono text-[10px] text-zinc-500">AUD-2025-014</span>
                        </div>
                        <div className="relative mt-1 text-[14px] font-semibold text-white">{assignment.scope}</div>
                        <div className="relative mt-0.5 flex items-center gap-1 text-[11px] text-zinc-500"><MapPin className="h-3 w-3" />Meridian Manufacturing · FY 2025–26</div>
                        <div className="relative mt-3 flex items-center gap-3">
                          <div className="relative h-16 w-16 shrink-0">
                            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
                              <circle cx="32" cy="32" r="27" fill="none" stroke="#27272a" strokeWidth="7" />
                              <circle cx="32" cy="32" r="27" fill="none" stroke="#10b981" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(progress / 100) * 169.6} 169.6`} />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-white">{progress}%</span>
                          </div>
                          <div className="grid flex-1 grid-cols-3 gap-1.5 text-center">
                            <div className="rounded-lg bg-white/[0.06] py-1.5 ring-1 ring-white/[0.06]"><div className="text-[15px] font-bold tabular-nums text-emerald-400">{verifiedCount}</div><div className="text-[9px] text-zinc-500">verified</div></div>
                            <div className="rounded-lg bg-white/[0.06] py-1.5 ring-1 ring-white/[0.06]"><div className="text-[15px] font-bold tabular-nums text-amber-400">{exceptionCount}</div><div className="text-[9px] text-zinc-500">exceptions</div></div>
                            <div className="rounded-lg bg-white/[0.06] py-1.5 ring-1 ring-white/[0.06]"><div className="text-[15px] font-bold tabular-nums text-zinc-300">{pendingCount}</div><div className="text-[9px] text-zinc-500">pending</div></div>
                          </div>
                        </div>
                      </div>

                      {/* sync card */}
                      <div className={cn('mt-3 rounded-2xl p-3.5 ring-1', queue.length ? 'bg-amber-500/10 ring-amber-500/30' : 'bg-zinc-900 ring-zinc-800')}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {queue.length ? <Clock className="h-4 w-4 text-amber-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                            <div>
                              <div className="text-[12px] font-semibold text-zinc-100">{queue.length ? `${queue.length} operation${queue.length > 1 ? 's' : ''} queued offline` : 'All data synced'}</div>
                              <div className="text-[10px] text-zinc-500">{online ? `Last sync ${me.lastSyncAt ? fmtDateShort(me.lastSyncAt) : '—'} · device ready` : 'Operations stored locally, encrypted'}</div>
                            </div>
                          </div>
                          {queue.length > 0 && (
                            <button onClick={syncQueue} disabled={!online || syncing}
                              className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition active:scale-95',
                                online ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-500')}>
                              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                              Sync now
                            </button>
                          )}
                        </div>
                        {queue.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {queue.slice(0, 3).map((q) => (
                              <div key={q.operationId} className="flex items-center justify-between rounded-lg bg-zinc-900/80 px-2.5 py-1.5 text-[11px] text-zinc-300">
                                <span className="truncate">{q.label}</span>
                                <span className="ml-2 shrink-0 font-mono text-[9px] text-zinc-500">{q.operationId.slice(0, 11)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* big scan button */}
                      <button onClick={() => setTab('scan')}
                        className="animate-pulse-ring mt-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-4 text-zinc-950 shadow-[0_10px_30px_-6px_rgba(16,185,129,0.55)] transition active:scale-[0.98]">
                        <ScanLine className="h-6 w-6" />
                        <span className="text-[16px] font-extrabold tracking-tight">SCAN ASSET</span>
                      </button>
                      <div className="mt-1.5 text-center text-[10px] text-zinc-500">Target: a straightforward asset verifies in 10–20 seconds</div>

                      {/* recent verifications */}
                      <div className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Recent verifications</div>
                      <div className="mt-1.5 space-y-1.5">
                        {myVerifs.slice(0, 4).map((v) => (
                          <div key={v.id} className="flex items-center justify-between rounded-xl bg-zinc-900/80 px-3 py-2.5 ring-1 ring-white/[0.06] transition hover:ring-emerald-400/25">
                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-medium text-zinc-200">{v.assetCode}</div>
                              <div className="truncate text-[10px] text-zinc-500">{fmtDateShort(v.verifiedAt)} · {v.method}{v.createdOffline ? ' · offline' : ''}</div>
                            </div>
                            <Pill size="xs" meta={resultMeta[v.result] ?? resultMeta.deferred} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {tab === 'assignments' && (
                    <>
                      <div className="text-[16px] font-bold text-white">Assignments</div>
                      <div className="mt-3 space-y-2.5">
                        {world?.assignments.filter((a) => a.auditorId === 'adr_1').map((a) => {
                          const assets = world.assets.filter((x) => x.assignmentId === a.id)
                          const vs = world.verifications.filter((v) => v.assignmentId === a.id)
                          const done = new Set(vs.map((v) => v.assetId)).size
                          const pct = assets.length ? Math.round((done / assets.length) * 100) : 0
                          return (
                            <div key={a.id} className="rounded-2xl bg-zinc-900 p-3.5 ring-1 ring-zinc-800">
                              <div className="flex items-center justify-between">
                                <span className="text-[13px] font-semibold text-white">{a.scope}</span>
                                <Pill size="xs" meta={a.status === 'field_complete' ? { label: 'Complete', cls: 'bg-teal-500/15 text-teal-300 ring-teal-500/30', dot: 'bg-teal-400' } : a.status === 'in_progress' ? { label: 'Active', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', dot: 'bg-emerald-400' } : { label: 'Assigned', cls: 'bg-zinc-800 text-zinc-400 ring-zinc-700', dot: 'bg-zinc-500' }} />
                              </div>
                              <div className="mt-1 text-[10px] text-zinc-500">{world.audits.find((x) => x.id === a.auditId)?.name}</div>
                              <div className="mt-2.5 flex justify-between text-[10px] text-zinc-400"><span>{done}/{assets.length} verified</span><span>{pct}%</span></div>
                              <ProgressBar value={pct} className="mt-1" barClass={pct === 100 ? 'bg-teal-400' : 'bg-emerald-500'} />
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {tab === 'exceptions' && (
                    <>
                      <div className="text-[16px] font-bold text-white">Exceptions</div>
                      <div className="text-[11px] text-zinc-500">Raised from your scopes — resolution happens with the ops team</div>
                      <div className="mt-3 space-y-2">
                        {myExceptions.slice(0, 10).map((e) => (
                          <div key={e.id} className="rounded-xl bg-zinc-900 p-3 ring-1 ring-zinc-800">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[9px] text-zinc-500">{e.code}</span>
                              <Pill size="xs" meta={e.status === 'open' ? { label: 'Open', cls: 'bg-red-500/15 text-red-300 ring-red-500/30', dot: 'bg-red-400' } : e.status === 'closed' || e.status === 'approved' ? { label: 'Closed', cls: 'bg-zinc-800 text-zinc-400 ring-zinc-700', dot: 'bg-zinc-500' } : { label: 'In progress', cls: 'bg-amber-500/15 text-amber-300 ring-amber-500/30', dot: 'bg-amber-400' }} />
                            </div>
                            <div className="mt-1 text-[12px] font-medium leading-snug text-zinc-200">{e.title}</div>
                            <div className="mt-0.5 text-[10px] text-zinc-500">{exceptionTypeMeta[e.type]?.label} · {fmtDateShort(e.detectedAt)}</div>
                          </div>
                        ))}
                        {myExceptions.length === 0 && <div className="mt-8 text-center text-[12px] text-zinc-500">No exceptions from your scopes yet</div>}
                      </div>
                    </>
                  )}

                  {tab === 'profile' && me && (
                    <>
                      <div className="flex flex-col items-center pt-4">
                        <Avatar name={me.name} seed={me.colorSeed} size="lg" />
                        <div className="mt-2 text-[16px] font-bold text-white">{me.name}</div>
                        <div className="text-[11px] text-zinc-500">{me.email}</div>
                        <span className="mt-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">{me.employeeCode} · Field Auditor</span>
                      </div>
                      <div className="mt-5 space-y-2">
                        {[
                          [<ScanFace key="1" className="h-4 w-4" />, 'Device', 'Samsung A34 · ES Field App 2.4.1'],
                          [<Wifi key="2" className="h-4 w-4" />, 'Sync status', online ? 'Online · real-time' : 'Offline · queue active'],
                          [<ClipboardList key="3" className="h-4 w-4" />, 'Lifetime verifications', `${world?.verifications.filter((v) => v.auditorId === me.id).length ?? 0} recorded`],
                          [<CheckCircle2 key="4" className="h-4 w-4" />, 'Cached scope', `${assignment?.scope ?? ''} · ${myAssets.length} assets`],
                        ].map(([icon, k, v], i) => (
                          <div key={i} className="flex items-center gap-3 rounded-xl bg-zinc-900 px-3 py-2.5 ring-1 ring-zinc-800">
                            <span className="text-zinc-500">{icon}</span>
                            <div className="min-w-0"><div className="text-[10px] uppercase tracking-wide text-zinc-500">{k as string}</div><div className="truncate text-[12px] text-zinc-200">{v as string}</div></div>
                          </div>
                        ))}
                        <button onClick={() => setSurface('landing')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-[12px] font-medium text-red-400 ring-1 ring-zinc-800">
                          <LogOut className="h-3.5 w-3.5" /> Sign out of field device
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* bottom tab bar */}
                <div className="flex shrink-0 items-stretch border-t border-white/[0.06] bg-zinc-950/90 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
                  {([
                    ['home', Home, 'Home'], ['assignments', ClipboardList, 'Jobs'],
                    ['scan', ScanLine, 'Scan'], ['exceptions', ShieldAlert, 'Flags'], ['profile', User, 'Profile'],
                  ] as const).map(([id, Icon, label]) => {
                    const active = tab === id
                    if (id === 'scan') {
                      return (
                        <button key={id} onClick={() => setTab('scan')} className="flex flex-1 flex-col items-center justify-center pt-1">
                          <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl shadow-[0_4px_14px_-4px_rgba(16,185,129,0.8)] transition', active ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : 'bg-emerald-500/15')}>
                            <Icon className={cn('h-5 w-5', active ? 'text-zinc-950' : 'text-emerald-400')} />
                          </span>
                          <span className="mt-0.5 text-[9px] font-semibold text-emerald-400">{label}</span>
                        </button>
                      )
                    }
                    return (
                      <button key={id} onClick={() => setTab(id)} className="flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5">
                        <Icon className={cn('h-5 w-5', active ? 'text-emerald-400' : 'text-zinc-600')} />
                        <span className={cn('text-[9px] font-medium', active ? 'text-emerald-400' : 'text-zinc-600')}>{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
      </div>
      {/* phone caption — only on tablet/desktop below lg (where no explainer shows) */}
      <div className="mt-3 hidden text-center text-[11px] text-zinc-400 sm:block lg:hidden">EasySourcing Field App · toggle ONLINE/OFFLINE to test offline queue</div>
    </div>
  )
}
