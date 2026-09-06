'use client'

// @es/ops · AccessView — platform account management (ADMIN only).
// Issue accounts for the team, scope CLIENT/AUDITOR accounts to their data,
// deactivate leavers, reset lost passwords. Every action is mirrored into the
// immutable audit trail by the Core API.

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useES } from '@/modules/shared/store'
import { fmtDateTime } from '@/modules/shared/format'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { UserPlus, ShieldCheck, ShieldOff, KeyRound, Loader2, CopyX, Users, Building2, ScanLine, Lock, Power } from 'lucide-react'

interface AccessUser {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'OPS' | 'CLIENT' | 'AUDITOR'
  active: boolean
  lastLoginAt: string | null
  createdAt: string
  clientId: string | null
  clientName: string | null
  auditorId: string | null
  auditorName: string | null
}

const ROLE_STYLE: Record<string, string> = {
  ADMIN: 'bg-violet-100 text-violet-700 ring-violet-200',
  OPS: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  CLIENT: 'bg-amber-100 text-amber-700 ring-amber-200',
  AUDITOR: 'bg-teal-100 text-teal-700 ring-teal-200',
}

const ROLE_DESC: Record<string, string> = {
  ADMIN: 'Full platform control + account management',
  OPS: 'Run audits, imports, exceptions — no account admin',
  CLIENT: 'Read-only client portal, scoped to one client',
  AUDITOR: 'Mobile app only, scoped to assigned work',
}

const GENERATE_HINT = 'Leave empty to auto-generate a strong password'

export function AccessView() {
  const { user, world } = useES()
  const isAdmin = user?.role === 'ADMIN'

  const [users, setUsers] = useState<AccessUser[] | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/users', { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json() as { users: AccessUser[] }
      setUsers(data.users)
    } catch {
      toast.error('Could not load accounts')
      setUsers([])
    }
  }, [])

  useEffect(() => { if (isAdmin) void load() }, [isAdmin, load])

  const stats = useMemo(() => {
    const list = users ?? []
    return {
      total: list.length,
      active: list.filter((u) => u.active).length,
      admins: list.filter((u) => u.role === 'ADMIN' && u.active).length,
      scoped: list.filter((u) => u.role === 'CLIENT' || u.role === 'AUDITOR').length,
    }
  }, [users])

  // ── add dialog state ──
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'OPS', clientId: '', auditorId: '' })
  const formIssue = useMemo(() => {
    if (form.name.trim().length < 2) return 'Name must be at least 2 characters'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid email address'
    if (form.password && (form.password.length < 8 || !/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password))) return 'Password: 8+ chars with at least one letter and one number'
    if (form.role === 'CLIENT' && !form.clientId) return 'Pick the client this account belongs to'
    if (form.role === 'AUDITOR' && !form.auditorId) return 'Pick the field team member'
    return null
  }, [form])

  // ── lifecycle state ──
  const [confirmOff, setConfirmOff] = useState<AccessUser | null>(null)
  const [resetTarget, setResetTarget] = useState<AccessUser | null>(null)
  const [resetPw, setResetPw] = useState('')
  const [issuedPw, setIssuedPw] = useState<string | null>(null)

  const addUser = async () => {
    if (formIssue || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password, role: form.role,
          clientId: form.role === 'CLIENT' ? form.clientId : undefined,
          auditorId: form.role === 'AUDITOR' ? form.auditorId : undefined,
        }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { toast.error('Could not create account', { description: data.error }); return }
      toast.success(`Account created for ${form.name.trim()}`, { description: `${form.role} · share the password securely` })
      setAddOpen(false)
      setForm({ name: '', email: '', password: '', role: 'OPS', clientId: '', auditorId: '' })
      await load()
    } finally {
      setBusy(false)
    }
  }

  const setActive = async (u: AccessUser, active: boolean) => {
    const res = await fetch('/api/auth/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, action: active ? 'activate' : 'deactivate' }),
    })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) { toast.error('Not allowed', { description: data.error }); return }
    toast.success(active ? `${u.name} reactivated` : `${u.name} deactivated`, { description: active ? 'They can sign in again' : 'Sign-in is now blocked' })
    setConfirmOff(null)
    await load()
  }

  const doReset = async () => {
    if (!resetTarget || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/auth/users', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: resetTarget.id, action: 'reset-password', password: resetPw || undefined }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string; password?: string; generated?: boolean }
      if (!res.ok) { toast.error('Reset failed', { description: data.error }); return }
      setIssuedPw(data.password ?? resetPw)
      setResetPw('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const copyPw = async () => {
    if (!issuedPw) return
    try { await navigator.clipboard.writeText(issuedPw); toast.success('Password copied to clipboard') } catch { toast.error('Copy failed — select it manually') }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Access &amp; Accounts</h1>
          <p className="text-[13px] text-zinc-500">Who can open this platform — issue, scope, deactivate. All changes are audit-logged.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)} disabled={!users}
            className="min-h-11 gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_4px_14px_-4px_rgba(16,185,129,0.7)] hover:from-emerald-600 hover:to-teal-700">
            <UserPlus className="h-4 w-4" /> Add account
          </Button>
        )}
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Accounts', value: stats.total, icon: Users, cls: 'text-zinc-600 bg-zinc-100' },
          { label: 'Active', value: stats.active, icon: ShieldCheck, cls: 'text-emerald-600 bg-emerald-100' },
          { label: 'Admins', value: stats.admins, icon: Lock, cls: 'text-violet-600 bg-violet-100' },
          { label: 'Client + Field', value: stats.scoped, icon: Building2, cls: 'text-amber-600 bg-amber-100' },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-3 p-4">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', s.cls)}><s.icon className="h-5 w-5" /></span>
            <span>
              <span className="block text-xl font-bold tabular-nums text-zinc-900">{users ? s.value : '—'}</span>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{s.label}</span>
            </span>
          </div>
        ))}
      </div>

      {/* list */}
      <div className="card overflow-hidden">
        {!users ? (
          <div className="flex items-center justify-center gap-2 py-14 text-[13px] text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading accounts…</div>
        ) : users.length === 0 ? (
          <div className="py-14 text-center text-[13px] text-zinc-400">No accounts yet — add your first team member</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {users.map((u) => (
              <div key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white',
                  u.active ? 'bg-gradient-to-br from-emerald-400 to-teal-600' : 'bg-zinc-300')}>
                  {u.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[14px] font-semibold text-zinc-900">{u.name}</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ring-1', ROLE_STYLE[u.role])}>{u.role}</span>
                    {!u.active && <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-zinc-500">Deactivated</span>}
                    {u.id === user?.id && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-emerald-600 ring-1 ring-emerald-200">You</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-zinc-500">
                    <span className="truncate">{u.email}</span>
                    {u.clientName && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {u.clientName}</span>}
                    {u.auditorName && <span className="inline-flex items-center gap-1"><ScanLine className="h-3 w-3" /> {u.auditorName}</span>}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">
                    {u.lastLoginAt ? `Last sign-in ${fmtDateTime(u.lastLoginAt)}` : 'Never signed in'}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setResetTarget(u); setResetPw(''); setIssuedPw(null) }}
                      className="min-h-9 gap-1.5 text-[12px]">
                      <KeyRound className="h-3.5 w-3.5" /> Reset password
                    </Button>
                    {u.active ? (
                      u.id === user?.id ? (
                        <Button variant="outline" size="sm" disabled title="You cannot deactivate your own account"
                          className="min-h-9 gap-1.5 text-[12px] text-zinc-400"><ShieldOff className="h-3.5 w-3.5" /> Deactivate</Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setConfirmOff(u)}
                          className="min-h-9 gap-1.5 text-[12px] text-red-600 hover:bg-red-50 hover:text-red-700">
                          <ShieldOff className="h-3.5 w-3.5" /> Deactivate
                        </Button>
                      )
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => void setActive(u, true)}
                        className="min-h-9 gap-1.5 text-[12px] text-emerald-700 hover:bg-emerald-50">
                        <Power className="h-3.5 w-3.5" /> Reactivate
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-left">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.6)]">
                <UserPlus className="h-4 w-4 text-white" />
              </span>
              Add platform account
            </DialogTitle>
            <DialogDescription className="text-left">
              The new person signs in with these credentials and can change nothing outside their role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">Full name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Priya Nair" className="mt-1 h-10" />
            </div>
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">Work email (used to sign in)</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="priya@yourcompany.com" className="mt-1 h-10" />
            </div>
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v, clientId: '', auditorId: '' })}>
                <SelectTrigger className="mt-1 h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['ADMIN', 'OPS', 'CLIENT', 'AUDITOR'].map((r) => (
                    <SelectItem key={r} value={r}>{r} — {ROLE_DESC[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.role === 'CLIENT' && (
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">Client they can see</Label>
                <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                  <SelectTrigger className="mt-1 h-10 w-full"><SelectValue placeholder="Pick the client" /></SelectTrigger>
                  <SelectContent>{world?.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.role === 'AUDITOR' && (
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">Field team member</Label>
                <Select value={form.auditorId} onValueChange={(v) => setForm({ ...form, auditorId: v })}>
                  <SelectTrigger className="mt-1 h-10 w-full"><SelectValue placeholder="Pick the team member" /></SelectTrigger>
                  <SelectContent>{world?.auditors.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} · {a.email}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">Password</Label>
              <div className="mt-1 flex gap-2">
                <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={GENERATE_HINT} autoComplete="off" className="h-10 font-mono text-[12.5px]" />
                <Button type="button" variant="outline" onClick={() => {
                  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
                  const buf = new Uint8Array(12); crypto.getRandomValues(buf)
                  let pw = ''; for (let i = 0; i < 12; i++) pw += chars[buf[i] % chars.length]
                  setForm({ ...form, password: pw })
                }} className="min-h-10 shrink-0 gap-1 text-[12px]"><CopyX className="h-3.5 w-3.5" /> Generate</Button>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">8+ characters with at least one letter and one number. Share it privately — it is never shown again.</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
              <Button variant="outline" size="sm" onClick={() => setAddOpen(false)} disabled={busy} className="min-h-10">Cancel</Button>
              <Button onClick={addUser} disabled={busy || !!formIssue}
                className="min-h-10 gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_4px_14px_-4px_rgba(16,185,129,0.7)] hover:from-emerald-600 hover:to-teal-700">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Create account
              </Button>
            </div>
            {formIssue && <p className="text-right text-[11.5px] font-medium text-amber-600">{formIssue}</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* deactivate confirm */}
      <AlertDialog open={!!confirmOff} onOpenChange={(v) => !v && setConfirmOff(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {confirmOff?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Sign-in is blocked immediately and any open session stops working. Nothing is deleted — reactivate any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmOff && void setActive(confirmOff, false)}
              className="min-h-10 bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700">
              <ShieldOff className="mr-1.5 h-4 w-4" /> Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* reset password dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        <DialogContent className="bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-left">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_4px_12px_-4px_rgba(245,158,11,0.6)]">
                <KeyRound className="h-4 w-4 text-white" />
              </span>
              Reset password · {resetTarget?.name}
            </DialogTitle>
            <DialogDescription className="text-left">
              Set a new password yourself or let EasySourcing generate one. The old password stops working immediately.
            </DialogDescription>
          </DialogHeader>
          {issuedPw ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">New password — shown once</div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-[14px] font-semibold text-zinc-900 ring-1 ring-emerald-200">{issuedPw}</code>
                  <Button onClick={copyPw} size="sm" className="min-h-10 shrink-0 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"><CopyX className="h-3.5 w-3.5" /> Copy</Button>
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-emerald-800/80">Hand it over privately (chat, call). Ask them to keep it safe — admins can always reset it again.</p>
              </div>
              <div className="flex justify-end"><Button onClick={() => setResetTarget(null)} className="min-h-10">Done</Button></div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">New password</Label>
                <Input type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder={GENERATE_HINT} autoComplete="off" className="mt-1 h-10 font-mono text-[12.5px]" />
                {resetPw && (resetPw.length < 8 || !/[a-zA-Z]/.test(resetPw) || !/[0-9]/.test(resetPw)) && (
                  <p className="mt-1 text-[11.5px] font-medium text-amber-600">8+ characters with at least one letter and one number</p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
                <Button variant="outline" onClick={() => setResetTarget(null)} disabled={busy} className="min-h-10">Cancel</Button>
                <Button onClick={doReset} disabled={busy || (resetPw.length > 0 && (resetPw.length < 8 || !/[a-zA-Z]/.test(resetPw) || !/[0-9]/.test(resetPw)))}
                  className="min-h-10 gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Reset password
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
