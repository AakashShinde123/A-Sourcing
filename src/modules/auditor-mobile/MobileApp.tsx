'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useES } from '@/modules/shared/store'
import { ModuleSwitcher } from '@/modules/shared/ModuleSwitcher'
import { ScanFlow } from './ScanFlow'
import { Avatar, Bar as ProgressBar, Pill } from '@/modules/shared/ui-bits'
import { resultMeta, fmtDateShort, exceptionTypeMeta } from '@/modules/shared/format'
import type { Assignment, QueueOp } from '@/modules/shared/types'
import {
  Home, ClipboardList, ScanLine, ShieldAlert, User, Wifi, WifiOff, RefreshCw, Loader2,
  CheckCircle2, Clock, BatteryFull, SignalHigh, ScanFace, LogOut, ChevronRight, MapPin,
} from 'lucide-react'

const QUEUE_KEY = 'es-offline-queue'

export function MobileApp() {
  const { world, setSurface, submitVerifications, user, logout } = useES()
  const [tab, setTab] = useState<'home' | 'assignments' | 'scan' | 'exceptions' | 'profile'>('home')
  const [activeAsgId, setActiveAsgId] = useState<string | null>(null)
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

  // Field identity: the signed-in AUDITOR's linked record; ADMIN/OPS preview as the demo auditor.
  const isFieldUser = user?.role === 'AUDITOR' && !!user.auditorId
  const me = world?.auditors.find((a) => a.id === (isFieldUser ? user!.auditorId! : 'adr_1')) ?? (isFieldUser ? undefined : world?.auditors[0])
  // Every scope published to this field user (demo fallback is ADMIN/OPS preview only).
  const myAssignments = useMemo((): Assignment[] => {
    if (!world) return []
    const mine = world.assignments.filter((a) => a.auditorId === (isFieldUser ? user!.auditorId! : 'adr_1'))
    if (!isFieldUser && mine.length === 0) {
      const demo = world.assignments.find((a) => a.id === 'asg_1')
      return demo ? [demo] : []
    }
    return mine
  }, [world, user, isFieldUser])
  // Active scope = what the user picked; defaults to their first assignment.
  const assignment = useMemo(
    () => myAssignments.find((a) => a.id === activeAsgId) ?? myAssignments[0] ?? null,
    [myAssignments, activeAsgId],
  )
  const asgId = assignment?.id ?? 'asg_1'
  const myAssets = useMemo(() => (world ? world.assets.filter((a) => a.assignmentId === asgId) : []), [world, asgId])
  const myVerifs = useMemo(() => (world?.verifications ?? []).filter((v) => v.assignmentId === asgId), [world, asgId])
  const verifiedCount = new Set(myVerifs.map((v) => v.assetId)).size
  const exceptionCount = myVerifs.filter((v) => v.result !== 'matched' && v.result !== 'deferred').length
  const pendingCount = Math.max(0, myAssets.length - verifiedCount)
  const progress = myAssets.length ? Math.round((verifiedCount / myAssets.length) * 100) : 0
  const myExceptions = useMemo(() => (world?.exceptions ?? []).filter((e) => ['exc', 'EX'].some(() => true) && (e.detectedBy === me?.name || myVerifs.some((v) => v.assetId === e.assetId))), [world, me, myVerifs])

  return (
    <div className="relative flex min-h-dvh flex-col items-stretch justify-center overflow-x-clip bg-gradient-to-br from-emerald-50 via-teal-50/60 to-cyan-50 sm:min-h-screen sm:flex-row sm:items-center sm:gap-10 sm:px-4 sm:py-6">
      {/* daylight mesh behind everything */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="bg-aurora absolute inset-0" />
        <div className="bg-grid-fade absolute inset-x-0 top-0 h-80" />
      </div>

      {/* Explainer panel (desktop only) */}
      <div className="relative hidden max-w-sm flex-col justify-center lg:flex">
        <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">Surface 3 · Auditor Mobile</div>
        <h1 className="font-display mt-2 text-[1.7rem] font-bold leading-tight tracking-tight text-zinc-900">A dedicated field experience — <span className="text-gradient">not a shrunken portal.</span></h1>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
          Arjun Mehta is verifying <strong className="text-zinc-800">Chakan Plant — Production Block A</strong> for Meridian&rsquo;s annual audit.
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
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-bold text-white shadow-sm">{n}</span>
              <span className="text-[13px] leading-snug text-zinc-600">{t}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2">
          <ModuleSwitcher current="Auditor Mobile" direction="up" />
          {user?.role !== 'AUDITOR' && (
            <button onClick={() => setSurface('landing')} className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-[13px] font-medium text-zinc-700 shadow-sm transition hover:border-emerald-400 hover:text-emerald-700">
              ← Hub
            </button>
          )}
        </div>
      </div>

      {/* Phone — full-bleed app on real phones, decorative frame on tablets/desktop */}
      <div className="relative flex w-full flex-1 flex-col sm:h-[780px] sm:w-[380px] sm:max-w-full sm:flex-none sm:rounded-[2.6rem] sm:border-[10px] sm:border-zinc-900 sm:shadow-[0_40px_90px_-30px_rgba(6,78,59,0.5)]">
        {/* notch (decorative devices only) */}
        <div className="absolute left-1/2 top-0 z-40 hidden h-6 w-36 -translate-x-1/2 rounded-b-2xl bg-zinc-900 sm:block" />
        {/* status bar — light like the app */}
        <div className="relative z-30 flex items-center justify-between border-b border-zinc-900/[0.05] bg-white px-5 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))] text-[10px] font-semibold text-zinc-700 sm:px-6">
            <span className="tabular-nums">9:41</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => { const next = !online; setOnline(next); toast.info(next ? 'Back online' : 'Airplane mode ON', { description: next ? 'Queued operations can now sync.' : 'Verifications will queue on device.' }) }}
                className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 transition', online ? 'bg-emerald-100 text-emerald-700 ring-emerald-500/25' : 'bg-amber-100 text-amber-700 ring-amber-500/30')}>
                {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {online ? 'ONLINE' : 'OFFLINE'}
              </button>
              <SignalHigh className="h-3 w-3" />
              <BatteryFull className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* content */}
          <div className="min-h-0 flex-1 overflow-hidden bg-[#f4f7f3]">
            {tab === 'scan' ? (
              isFieldUser && !assignment ? (
                <div className="flex h-full flex-col bg-[#f4f7f3] text-zinc-900">
                  <div className="flex items-center justify-between px-4 pb-2 pt-3">
                    <button onClick={() => setTab('home')} className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-700">
                      <ChevronRight className="h-4 w-4 rotate-180" /> Home
                    </button>
                    <div className="text-[12px] font-bold uppercase tracking-widest text-emerald-700">Scan Asset</div>
                    <div className="w-10" />
                  </div>
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 pb-10 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-200"><ClipboardList className="h-7 w-7 text-amber-600" /></span>
                    <div className="font-display text-[15px] font-bold text-zinc-900">No active scope</div>
                    <p className="max-w-[250px] text-[12px] leading-relaxed text-zinc-500">Your ops team has not published a field scope to your account yet. Scanning unlocks as soon as a project is assigned to you.</p>
                  </div>
                </div>
              ) : (
                <ScanFlow onExit={() => setTab('home')} online={online} scope={assignment} />
              )
            ) : (
              <div className="flex h-full flex-col bg-[#f4f7f3] text-zinc-900">
                <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
                  {tab === 'home' && me && !assignment && (
                    <div className="mt-2 rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-zinc-900/[0.06]">
                      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-200"><ClipboardList className="h-6 w-6 text-amber-600" /></span>
                      <div className="font-display mt-3 text-[15px] font-bold text-zinc-900">No assignment yet</div>
                      <p className="mx-auto mt-1 max-w-[240px] text-[12px] leading-relaxed text-zinc-500">
                        Your ops team has not published a field scope to you. Once they assign a project it appears here automatically.
                      </p>
                    </div>
                  )}
                  {tab === 'home' && !me && (
                    <div className="mt-2 rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-zinc-900/[0.06]">
                      <div className="font-display text-[15px] font-bold text-zinc-900">Account not linked to a field record</div>
                      <p className="mx-auto mt-1 max-w-[240px] text-[12px] leading-relaxed text-zinc-500">Ask your operations team to link your login to a field team member.</p>
                    </div>
                  )}

                  {tab === 'home' && me && assignment && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[11px] text-zinc-500">Good morning,</div>
                          <div className="font-display text-[17px] font-bold text-zinc-900">{me.name.split(' ')[0]} 👋</div>
                        </div>
                        <Avatar name={me.name} seed={me.colorSeed} />
                      </div>

                      {/* assignment card — the vivid hero of the app */}
                      <div className="relative mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-4 shadow-[0_16px_40px_-14px_rgba(13,148,136,0.65)]">
                        <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-white/20 blur-2xl" aria-hidden />
                        <div className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-cyan-300/30 blur-2xl" aria-hidden />
                        <div className="relative flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/85">Current assignment</span>
                          <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-white ring-1 ring-white/25">{world?.audits.find((x) => x.id === assignment.auditId)?.code ?? '—'}</span>
                        </div>
                        {myAssignments.length > 1 ? (
                          <select
                            value={assignment.id}
                            onChange={(e) => setActiveAsgId(e.target.value)}
                            className="relative mt-1 w-full appearance-none rounded-lg bg-white/15 px-2 py-1.5 text-[13.5px] font-bold leading-snug text-white ring-1 ring-white/25 outline-none [&>option]:text-zinc-900"
                            aria-label="Switch field scope"
                          >
                            {myAssignments.map((a) => <option key={a.id} value={a.id}>{a.scope}</option>)}
                          </select>
                        ) : (
                          <div className="relative mt-1 text-[14.5px] font-bold leading-snug text-white">{assignment.scope}</div>
                        )}
                        <div className="relative mt-0.5 flex items-center gap-1 text-[11px] font-medium text-white/75"><MapPin className="h-3 w-3" />{world?.clients.find((c) => c.id === world?.audits.find((x) => x.id === assignment.auditId)?.clientId)?.name ?? '—'} · {world?.audits.find((x) => x.id === assignment.auditId)?.financialYear ?? ''}</div>
                        <div className="relative mt-3 flex items-center gap-3">
                          <div className="relative h-16 w-16 shrink-0">
                            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
                              <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="7" />
                              <circle cx="32" cy="32" r="27" fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(progress / 100) * 169.6} 169.6`} />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-white">{progress}%</span>
                          </div>
                          <div className="grid flex-1 grid-cols-3 gap-1.5 text-center">
                            <div className="rounded-lg bg-white/15 py-1.5 ring-1 ring-white/25 backdrop-blur-sm"><div className="text-[15px] font-bold tabular-nums text-white">{verifiedCount}</div><div className="text-[9px] font-medium text-white/75">verified</div></div>
                            <div className="rounded-lg bg-white/15 py-1.5 ring-1 ring-white/25 backdrop-blur-sm"><div className="text-[15px] font-bold tabular-nums text-amber-200">{exceptionCount}</div><div className="text-[9px] font-medium text-white/75">exceptions</div></div>
                            <div className="rounded-lg bg-white/15 py-1.5 ring-1 ring-white/25 backdrop-blur-sm"><div className="text-[15px] font-bold tabular-nums text-white">{pendingCount}</div><div className="text-[9px] font-medium text-white/75">pending</div></div>
                          </div>
                        </div>
                      </div>

                      {/* sync card */}
                      <div className={cn('mt-3 rounded-2xl p-3.5 shadow-sm ring-1', queue.length ? 'bg-amber-50 ring-amber-300/60' : 'bg-white ring-zinc-900/[0.06]')}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {queue.length ? <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100"><Clock className="h-4 w-4 text-amber-600" /></span> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></span>}
                            <div>
                              <div className="text-[12px] font-bold text-zinc-900">{queue.length ? `${queue.length} operation${queue.length > 1 ? 's' : ''} queued offline` : 'All data synced'}</div>
                              <div className="text-[10px] text-zinc-500">{online ? `Last sync ${me.lastSyncAt ? fmtDateShort(me.lastSyncAt) : '—'} · device ready` : 'Operations stored locally, encrypted'}</div>
                            </div>
                          </div>
                          {queue.length > 0 && (
                            <button onClick={syncQueue} disabled={!online || syncing}
                              className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition active:scale-95',
                                online ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_4px_14px_-4px_rgba(16,185,129,0.7)]' : 'bg-zinc-200 text-zinc-500')}>
                              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                              Sync now
                            </button>
                          )}
                        </div>
                        {queue.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {queue.slice(0, 3).map((q) => (
                              <div key={q.operationId} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-[11px] text-zinc-700 ring-1 ring-amber-200/70">
                                <span className="truncate">{q.label}</span>
                                <span className="ml-2 shrink-0 font-mono text-[9px] text-zinc-400">{q.operationId.slice(0, 11)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* big scan button */}
                      <button onClick={() => setTab('scan')}
                        className="animate-pulse-ring mt-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 py-4 text-white shadow-[0_12px_32px_-8px_rgba(13,148,136,0.7)] transition active:scale-[0.98]">
                        <ScanLine className="h-6 w-6" />
                        <span className="font-display text-[16px] font-bold tracking-wide">SCAN ASSET</span>
                      </button>
                      <div className="mt-1.5 text-center text-[10px] text-zinc-500">Target: a straightforward asset verifies in 10–20 seconds</div>

                      {/* recent verifications */}
                      <div className="mt-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Recent verifications</div>
                      <div className="mt-1.5 space-y-1.5">
                        {myVerifs.slice(0, 4).map((v) => (
                          <div key={v.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-zinc-900/[0.05] transition hover:ring-emerald-500/40">
                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-semibold text-zinc-800">{v.assetCode}</div>
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
                      <div className="font-display text-[16px] font-bold text-zinc-900">Assignments</div>
                      <div className="mt-3 space-y-2.5">
                        {myAssignments.map((a) => {
                          const assets = world.assets.filter((x) => x.assignmentId === a.id)
                          const vs = world.verifications.filter((v) => v.assignmentId === a.id)
                          const done = new Set(vs.map((v) => v.assetId)).size
                          const pct = assets.length ? Math.round((done / assets.length) * 100) : 0
                          return (
                            <div key={a.id} className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-zinc-900/[0.06]">
                              <div className="flex items-center justify-between">
                                <span className="text-[13px] font-bold text-zinc-900">{a.scope}</span>
                                <Pill size="xs" meta={a.status === 'field_complete' ? { label: 'Complete', cls: 'bg-teal-50 text-teal-700 ring-teal-500/30', dot: 'bg-teal-500' } : a.status === 'in_progress' ? { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-500/30', dot: 'bg-emerald-500' } : { label: 'Assigned', cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200', dot: 'bg-zinc-400' }} />
                              </div>
                              <div className="mt-1 text-[10px] text-zinc-500">{world.audits.find((x) => x.id === a.auditId)?.name}</div>
                              <div className="mt-2.5 flex justify-between text-[10px] font-medium text-zinc-500"><span>{done}/{assets.length} verified</span><span>{pct}%</span></div>
                              <ProgressBar value={pct} className="mt-1" barClass={pct === 100 ? 'bg-teal-500' : 'bg-emerald-500'} />
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {tab === 'exceptions' && (
                    <>
                      <div className="font-display text-[16px] font-bold text-zinc-900">Exceptions</div>
                      <div className="text-[11px] text-zinc-500">Raised from your scopes — resolution happens with the ops team</div>
                      <div className="mt-3 space-y-2">
                        {myExceptions.slice(0, 10).map((e) => (
                          <div key={e.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-zinc-900/[0.06]">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[9px] text-zinc-400">{e.code}</span>
                              <Pill size="xs" meta={e.status === 'open' ? { label: 'Open', cls: 'bg-red-50 text-red-700 ring-red-500/25', dot: 'bg-red-500' } : e.status === 'closed' || e.status === 'approved' ? { label: 'Closed', cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200', dot: 'bg-zinc-400' } : { label: 'In progress', cls: 'bg-amber-50 text-amber-700 ring-amber-500/30', dot: 'bg-amber-500' }} />
                            </div>
                            <div className="mt-1 text-[12px] font-semibold leading-snug text-zinc-800">{e.title}</div>
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
                        <span className="rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 p-1 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.7)]">
                          <Avatar name={me.name} seed={me.colorSeed} size="lg" ring />
                        </span>
                        <div className="font-display mt-2 text-[16px] font-bold text-zinc-900">{me.name}</div>
                        <div className="text-[11px] text-zinc-500">{me.email}</div>
                        <span className="mt-1.5 rounded-full bg-gradient-to-r from-emerald-100 to-teal-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-500/25">{me.employeeCode} · Field Auditor</span>
                      </div>
                      <div className="mt-5 space-y-2">
                        {[
                          [<ScanFace key="1" className="h-4 w-4" />, 'Device', 'Samsung A34 · ES Field App 2.4.1'],
                          [<Wifi key="2" className="h-4 w-4" />, 'Sync status', online ? 'Online · real-time' : 'Offline · queue active'],
                          [<ClipboardList key="3" className="h-4 w-4" />, 'Lifetime verifications', `${world?.verifications.filter((v) => v.auditorId === me.id).length ?? 0} recorded`],
                          [<CheckCircle2 key="4" className="h-4 w-4" />, 'Cached scope', `${assignment?.scope ?? ''} · ${myAssets.length} assets`],
                        ].map(([icon, k, v], i) => (
                          <div key={i} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-zinc-900/[0.06]">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">{icon}</span>
                            <div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{k as string}</div><div className="truncate text-[12px] font-medium text-zinc-700">{v as string}</div></div>
                          </div>
                        ))}
                        <button onClick={() => void logout()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-[12px] font-semibold text-red-600 shadow-sm ring-1 ring-zinc-900/[0.06] transition hover:bg-red-50">
                          <LogOut className="h-3.5 w-3.5" /> Sign out of field device
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* bottom tab bar — light glass */}
                <div className="flex shrink-0 items-stretch border-t border-zinc-900/[0.06] bg-white/92 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
                  {([
                    ['home', Home, 'Home'], ['assignments', ClipboardList, 'Jobs'],
                    ['scan', ScanLine, 'Scan'], ['exceptions', ShieldAlert, 'Flags'], ['profile', User, 'Profile'],
                  ] as const).map(([id, Icon, label]) => {
                    const active = tab === id
                    if (id === 'scan') {
                      return (
                        <button key={id} onClick={() => setTab('scan')} className="flex flex-1 flex-col items-center justify-center pt-1">
                          <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl shadow-[0_4px_16px_-4px_rgba(13,148,136,0.8)] transition', active ? 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500' : 'bg-gradient-to-br from-emerald-400 to-teal-500')}>
                            <Icon className="h-5 w-5 text-white" />
                          </span>
                          <span className="mt-0.5 text-[9px] font-bold text-teal-600">{label}</span>
                        </button>
                      )
                    }
                    return (
                      <button key={id} onClick={() => setTab(id)} className="flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5">
                        <Icon className={cn('h-5 w-5 transition', active ? 'text-emerald-600' : 'text-zinc-400')} />
                        <span className={cn('text-[9px] font-semibold', active ? 'text-emerald-600' : 'text-zinc-400')}>{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
      </div>
      {/* phone caption — only on tablet/desktop below lg (where no explainer shows) */}
      <div className="relative mt-3 hidden text-center text-[11px] font-medium text-zinc-500 sm:block lg:hidden">EasySourcing Field App · toggle ONLINE/OFFLINE to test offline queue</div>
    </div>
  )
}
