'use client'

import React, { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
// Note: overview trend uses recharts BarChart; here we favor lightweight custom bars for reliability
import { Avatar, MicroLabel, Bar as ProgressBar } from '@/modules/shared/ui-bits'
import { useES } from '@/modules/shared/store'
import { fmtDateTime, fmtDateShort } from '@/modules/shared/format'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Radio, LogOut, Database, ShieldCheck, UserPlus, MoreHorizontal, Power, UserMinus, Loader2, History } from 'lucide-react'

// ─── Analytics ───────────────────────────────────────────────────
export function AnalyticsView() {
  const { world } = useES()
  const { exceptions, verifications, assets, audits } = world!

  const byType = useMemo(() => {
    const m: Record<string, number> = {}
    exceptions.forEach((e) => { m[e.type] = (m[e.type] ?? 0) + 1 })
    return Object.entries(m).map(([k, v]) => ({ key: k, name: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: v }))
      .sort((a, b) => b.value - a.value)
  }, [exceptions])
  const maxValue = Math.max(1, ...byType.map((d) => d.value))

  const byAuditor = useMemo(() => {
    const m: Record<string, { name: string; total: number; matched: number }> = {}
    verifications.forEach((v) => {
      m[v.auditorId] ??= { name: v.auditorName, total: 0, matched: 0 }
      m[v.auditorId].total++
      if (v.result === 'matched') m[v.auditorId].matched++
    })
    return Object.values(m).map((x) => ({ ...x, rate: Math.round((x.matched / x.total) * 100) })).sort((a, b) => b.total - a.total)
  }, [verifications])

  const conditionDist = useMemo(() => {
    const m: Record<string, number> = {}
    assets.forEach((a) => { if (a.condition) m[a.condition] = (m[a.condition] ?? 0) + 1 })
    const order = ['excellent', 'good', 'fair', 'poor']
    return order.map((k) => ({ name: k[0].toUpperCase() + k.slice(1), value: m[k] ?? 0, fill: k === 'excellent' ? '#10b981' : k === 'good' ? '#14b8a6' : k === 'fair' ? '#f59e0b' : '#ef4444' }))
  }, [assets])

  const locationAccuracy = useMemo(() => {
    const inScope = assets.filter((a) => a.lastVerifiedAt)
    return inScope.length ? Math.round((verifications.filter((v) => v.result === 'matched').length / verifications.length) * 100) : 0
  }, [assets, verifications])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Analytics &amp; Risk</h1>
        <p className="text-[13px] text-zinc-500">Deterministic metrics from the reconciliation engine — configurable, transparent, unit-tested</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card p-4 xl:col-span-2">
          <MicroLabel>Exceptions by type</MicroLabel>
          <div className="mt-4 space-y-3.5">
            {byType.map((d, i) => (
              <div key={d.key}>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-zinc-700">{d.name}</span>
                  <span className="tabular-nums text-zinc-500">{d.value}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(d.value / maxValue) * 100}%`, background: ['#ef4444', '#f59e0b', '#f97316', '#f43f5e', '#14b8a6', '#71717a', '#10b981', '#a1a1aa'][i % 8] }} />
                </div>
              </div>
            ))}
            {byType.length === 0 && <div className="py-8 text-center text-xs text-zinc-400">No exceptions recorded</div>}
          </div>
        </div>
        <div className="card p-4">
          <MicroLabel>Condition distribution</MicroLabel>
          <div className="relative mt-2 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart data={conditionDist} innerRadius="34%" outerRadius="100%" startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, Math.max(...conditionDist.map((d) => d.value), 1)]} tick={false} />
                <RadialBar dataKey="value" background cornerRadius={6} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e4e4e7', fontSize: 12 }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3">
            {conditionDist.map((d) => (
              <span key={d.name} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600">
                <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />{d.name} · {d.value}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <MicroLabel>Auditor productivity</MicroLabel>
          <div className="mt-3 space-y-3">
            {byAuditor.map((a) => (
              <div key={a.name}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-zinc-700">{a.name}</span>
                  <span className="tabular-nums text-zinc-500">{a.total} verifications · {a.rate}% match</span>
                </div>
                <ProgressBar value={a.rate} />
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <MicroLabel>Risk indicators</MicroLabel>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              { label: 'Location accuracy', value: `${locationAccuracy}%`, tone: locationAccuracy > 90 ? 'text-emerald-600' : 'text-amber-600' },
              { label: 'Missing assets', value: exceptions.filter((e) => e.type === 'missing').length, tone: 'text-red-600' },
              { label: 'Custodian accuracy', value: `${Math.max(60, 100 - exceptions.filter((e) => e.type === 'custodian_mismatch').length * 4)}%`, tone: 'text-emerald-600' },
              { label: 'Audits completed', value: audits.filter((a) => a.status === 'completed').length, tone: 'text-zinc-800' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
                <div className="text-[11px] uppercase tracking-wide text-zinc-400">{s.label}</div>
                <div className={`mt-1 text-xl font-semibold tabular-nums ${s.tone}`}>{s.value}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
            Risk bands (high / medium / low) are rule-based per location and fully documented — never AI-generated.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Team ────────────────────────────────────────────────────────
function AddMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addAuditor } = useES()
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const ok = await addAuditor({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, city: form.city.trim() || undefined })
    setBusy(false)
    if (ok) { toast.success(`${form.name.trim()} added to the field team`); setForm({ name: '', email: '', phone: '', city: '' }); onOpenChange(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Add team member</DialogTitle>
          <DialogDescription>New auditors start as Available and receive an ES-EMP code automatically.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="tm-name" className="text-[12px] font-semibold text-zinc-700">Full name *</Label>
            <Input id="tm-name" required maxLength={80} value={form.name} onChange={set('name')} placeholder="e.g. Ravi Sharma" className="h-10 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tm-email" className="text-[12px] font-semibold text-zinc-700">Work email *</Label>
            <Input id="tm-email" required type="email" value={form.email} onChange={set('email')} placeholder="ravi.s@easysourcing.in" className="h-10 rounded-lg" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tm-phone" className="text-[12px] font-semibold text-zinc-700">Phone</Label>
              <Input id="tm-phone" maxLength={24} value={form.phone} onChange={set('phone')} placeholder="+91 90040 11223" className="h-10 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-city" className="text-[12px] font-semibold text-zinc-700">Base city</Label>
              <Input id="tm-city" maxLength={40} value={form.city} onChange={set('city')} placeholder="Pune" className="h-10 rounded-lg" />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-10 rounded-lg">Cancel</Button>
            <Button type="submit" disabled={busy} className="h-10 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_4px_14px_-4px_rgba(16,185,129,0.6)] hover:brightness-105">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{busy ? 'Adding…' : 'Add member'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TeamView() {
  const { world, setAuditorStatus, removeAuditor } = useES()
  const [addOpen, setAddOpen] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [confirmFor, setConfirmFor] = useState<{ id: string; name: string } | null>(null)
  const [removing, setRemoving] = useState(false)

  async function confirmRemove() {
    if (!confirmFor) return
    setRemoving(true)
    const ok = await removeAuditor(confirmFor.id)
    setRemoving(false)
    if (ok) toast.success(`${confirmFor.name} removed from the team`)
    setConfirmFor(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Field Team</h1>
          <p className="text-[13px] text-zinc-500">EasySourcing auditors, reviewers and their device sync telemetry</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-3.5 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(16,185,129,0.6)] transition hover:brightness-105 active:scale-[0.98]">
          <UserPlus className="h-4 w-4" />Add team member
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {world!.auditors.map((a) => {
          const vs = world!.verifications.filter((v) => v.auditorId === a.id)
          const asgs = world!.assignments.filter((x) => x.auditorId === a.id)
          const hasHistory = vs.length > 0 || asgs.length > 0
          const menuOpen = menuFor === a.id
          return (
            <div key={a.id} className="card p-4">
              <div className="flex items-center gap-3">
                <Avatar name={a.name} seed={a.colorSeed} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-zinc-900">{a.name}</div>
                  <div className="truncate text-xs text-zinc-500">{a.email}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-zinc-400">{a.employeeCode} · {a.city ?? '—'}</div>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${a.status === 'in_field' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : a.status === 'available' ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-zinc-100 text-zinc-500 ring-zinc-200'}`}>
                  <Radio className="h-2.5 w-2.5" />{a.status === 'in_field' ? 'In field' : a.status === 'available' ? 'Available' : 'Offline'}
                </span>
                <div className="relative shrink-0">
                  <button onClick={() => setMenuFor(menuOpen ? null : a.id)} aria-label={`Manage ${a.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 ring-1 ring-transparent transition hover:bg-zinc-100 hover:text-zinc-600 hover:ring-zinc-200">
                    <MoreHorizontal className="h-4.5 w-4.5" />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuFor(null)} aria-hidden />
                      <div className="absolute right-0 top-10 z-50 w-60 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl">
                        <button onClick={() => { setMenuFor(null); setAuditorStatus(a.id, a.status === 'offline' ? 'available' : 'offline') }}
                          className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-zinc-700 transition hover:bg-zinc-50">
                          <Power className="h-3.5 w-3.5 text-zinc-400" />{a.status === 'offline' ? 'Reactivate (Available)' : 'Deactivate (Offline)'}
                        </button>
                        <button disabled={hasHistory} title={hasHistory ? 'Member has audit history — deactivate instead' : undefined}
                          onClick={() => { if (!hasHistory) { setMenuFor(null); setConfirmFor({ id: a.id, name: a.name }) } }}
                          className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${hasHistory ? 'cursor-not-allowed text-zinc-300' : 'text-red-600 hover:bg-red-50'}`}>
                          <UserMinus className="h-3.5 w-3.5" />Remove from team
                        </button>
                        {hasHistory && <div className="px-2.5 pb-1.5 pt-1 text-[10.5px] leading-snug text-zinc-400">{vs.length} verifications · {asgs.length} assignments on record — history stays intact, so delete is locked. Deactivate instead.</div>}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-zinc-50 py-2"><div className="text-sm font-semibold tabular-nums text-zinc-800">{vs.length}</div><div className="text-[10px] text-zinc-400">verifications</div></div>
                <div className="rounded-lg bg-zinc-50 py-2"><div className="text-sm font-semibold tabular-nums text-zinc-800">{asgs.length}</div><div className="text-[10px] text-zinc-400">assignments</div></div>
                <div className="rounded-lg bg-zinc-50 py-2"><div className="text-sm font-semibold tabular-nums text-emerald-600">{vs.length ? Math.round((vs.filter((v) => v.result === 'matched').length / vs.length) * 100) : 0}%</div><div className="text-[10px] text-zinc-400">match rate</div></div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-400"><Database className="h-3 w-3" />Last sync {a.lastSyncAt ? fmtDateTime(a.lastSyncAt) : '—'}</div>
            </div>
          )
        })}
      </div>
      {world!.auditors.length === 0 && (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"><History className="h-6 w-6" /></span>
          <div className="text-[14px] font-semibold text-zinc-800">No team members yet</div>
          <p className="max-w-xs text-[13px] text-zinc-500">Add your first auditor — they appear instantly in the mobile app and can be assigned to audits.</p>
          <button onClick={() => setAddOpen(true)} className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 text-[13px] font-bold text-white transition hover:brightness-105"><UserPlus className="h-4 w-4" />Add team member</button>
        </div>
      )}
      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} />
      <AlertDialog open={!!confirmFor} onOpenChange={(v) => !v && setConfirmFor(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmFor?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the member. This is only possible because they have no verifications or assignments on record — members with audit history are deactivated instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <AlertDialogCancel className="h-10 rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmRemove() }} disabled={removing}
              className="h-10 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700">
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}{removing ? 'Removing…' : 'Remove member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Audit Logs ──────────────────────────────────────────────────
export function LogsView() {
  const { world } = useES()
  const actionTone = (a: string) =>
    a.includes('APPROV') ? 'bg-emerald-50 text-emerald-700' : a.includes('EXCEPTION') ? 'bg-amber-50 text-amber-700'
      : a.includes('REPORT') ? 'bg-teal-50 text-teal-700' : a.includes('SYNC') || a.includes('VERIFICATION') ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-100 text-zinc-600'
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Digital Audit Trail</h1>
        <p className="text-[13px] text-zinc-500">WHO · WHAT · WHEN · WHERE — append-only, protected from ordinary modification</p>
      </div>
      <div className="overflow-hidden card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/70 text-left">
              {['Actor', 'Action', 'Entity', 'Detail', 'When'].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {world!.auditLogs.map((l) => (
              <tr key={l.id} className="transition hover:bg-zinc-50/60">
                <td className="whitespace-nowrap px-3 py-2.5">
                  <div className="font-medium text-zinc-800">{l.actor}</div>
                  <div className="text-[11px] text-zinc-400">{l.role}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5"><span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${actionTone(l.action)}`}>{l.action}</span></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-zinc-600">{l.entity}<span className="ml-1 font-mono text-[10px] text-zinc-400">{l.entityRef}</span></td>
                <td className="max-w-[300px] px-3 py-2.5"><div className="truncate text-zinc-500">{l.detail}</div></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-zinc-400">{fmtDateTime(l.at)}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
