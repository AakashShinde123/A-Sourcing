'use client'

import React, { useMemo, useState } from 'react'
import { Building2, MapPin, ChevronRight, ChevronDown, Factory, Landmark, Warehouse, DoorOpen, Layers, Grid3X3, Boxes, ImageIcon, FileText, History, Plus, Pause, Play, Trash2, Loader2, Users } from 'lucide-react'
import { useES } from '@/modules/shared/store'
import { Avatar, Pill, EvidenceThumb, EmptyState, MicroLabel, Bar as ProgressBar } from '@/modules/shared/ui-bits'
import { fmtDate, fmtDateTime, auditStatusMeta } from '@/modules/shared/format'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

// ─── Clients ─────────────────────────────────────────────────────
const CLIENT_STATUS_PILL: Record<string, { label: string; cls: string; dot: string }> = {
  active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  onboarding: { label: 'Onboarding', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  paused: { label: 'Paused', cls: 'bg-zinc-100 text-zinc-500 ring-zinc-200', dot: 'bg-zinc-400' },
}

function AddClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addClient } = useES()
  const empty = { name: '', industry: '', city: '', contact: '', email: '', phone: '' }
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const ok = await addClient({
      name: form.name.trim(), industry: form.industry.trim(), city: form.city.trim(),
      contact: form.contact.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined,
    })
    setBusy(false)
    if (ok) {
      toast.success(`${form.name.trim()} onboarded`, { description: `Client code allocated automatically · ${form.contact.trim()} is portal admin` })
      setForm(empty); onOpenChange(false)
    }
  }

  const field = (id: string, label: string, placeholder: string, k: keyof typeof form, type = 'text', required = true) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[12px] font-semibold text-zinc-700">{label}{required ? ' *' : ''}</Label>
      <Input id={id} type={type} required={required} maxLength={80} value={form[k]} onChange={set(k)} placeholder={placeholder} className="h-10 rounded-lg" />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Add client</DialogTitle>
          <DialogDescription>The client code is auto-allocated and your primary contact becomes their portal admin.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3.5">
          {field('cl-name', 'Organization name', 'e.g. Sunrise Fabrics Ltd', 'name')}
          <div className="grid gap-3 sm:grid-cols-2">
            {field('cl-industry', 'Industry', 'e.g. Textiles', 'industry')}
            {field('cl-city', 'City', 'e.g. Jaipur', 'city')}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field('cl-contact', 'Primary contact', 'e.g. Meera Kapoor', 'contact')}
            {field('cl-email', 'Contact email', 'meera@sunrisefab.in', 'email', 'email')}
          </div>
          {field('cl-phone', 'Phone', '+91 98xxx xxxxx (optional)', 'phone', 'text', false)}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-10 rounded-lg">Cancel</Button>
            <Button type="submit" disabled={busy} className="h-10 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_4px_14px_-4px_rgba(16,185,129,0.6)] hover:brightness-105">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{busy ? 'Adding…' : 'Add client'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ClientsView() {
  const { world, setClientIdentityId, setSurface, setClientStatus, removeClient } = useES()
  const [openId, setOpenId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [confirmFor, setConfirmFor] = useState<{ id: string; name: string } | null>(null)
  const [removing, setRemoving] = useState(false)

  async function confirmRemove() {
    if (!confirmFor) return
    setRemoving(true)
    const ok = await removeClient(confirmFor.id)
    setRemoving(false)
    if (ok) toast.success(`${confirmFor.name} removed`)
    setConfirmFor(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Clients</h1>
          <p className="text-[13px] text-zinc-500">{world!.clients.length} organizations under EasySourcing operations</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-3.5 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(16,185,129,0.6)] transition hover:brightness-105 active:scale-[0.98]">
          <Plus className="h-4 w-4" />Add client
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {world!.clients.map((c) => {
          const assets = world!.assets.filter((a) => a.clientId === c.id).length
          const audits = world!.audits.filter((a) => a.clientId === c.id)
          const open = openId === c.id
          const pill = CLIENT_STATUS_PILL[c.status] ?? CLIENT_STATUS_PILL.active
          const hasData = assets > 0 || audits.length > 0 || world!.locations.some((l) => l.clientId === c.id) || world!.exceptions.some((e) => e.clientId === c.id) || world!.reports.some((r) => r.clientId === c.id)
          return (
            <div key={c.id} className="card">
              <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpenId(open ? null : c.id)}>
                <Avatar name={c.name} seed={c.colorSeed} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[15px] font-semibold text-zinc-900">{c.name}</h3>
                    <Pill size="xs" meta={pill} />
                  </div>
                  <p className="truncate text-xs text-zinc-500">{c.industry} · {c.city} · since {fmtDate(c.since)}</p>
                </div>
                <div className="hidden shrink-0 gap-6 text-right sm:flex">
                  <div><div className="text-sm font-semibold tabular-nums text-zinc-900">{assets}</div><div className="text-[10px] uppercase tracking-wide text-zinc-400">assets</div></div>
                  <div><div className="text-sm font-semibold tabular-nums text-zinc-900">{audits.length}</div><div className="text-[10px] uppercase tracking-wide text-zinc-400">audits</div></div>
                </div>
                {open ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
              </button>
              {open && (
                <div className="border-t border-zinc-100 px-4 py-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <MicroLabel>Primary contact</MicroLabel>
                      <div className="mt-1 text-[13px] text-zinc-700">{c.contact}</div>
                      <div className="break-words text-xs text-zinc-400">{c.email} · {c.phone ?? '—'}</div>
                      <MicroLabel className="mt-3">Portal users</MicroLabel>
                      {c.users.map((u) => (
                        <div key={u.id} className="mt-1 flex items-center gap-2 text-[13px]">
                          <Avatar name={u.name} seed={c.colorSeed} size="sm" />
                          <span className="truncate text-zinc-700">{u.name}</span>
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">{u.role}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <MicroLabel>Recent audits</MicroLabel>
                      <div className="mt-1 space-y-1.5">
                        {audits.slice(0, 3).map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-2 text-[13px]">
                            <span className="truncate text-zinc-600">{a.name}</span>
                            <Pill meta={auditStatusMeta[a.status]} size="xs" />
                          </div>
                        ))}
                        {audits.length === 0 && <div className="text-xs text-zinc-400">No audits yet</div>}
                      </div>
                      <button
                        onClick={() => { setClientIdentityId(c.id); setSurface('client') }}
                        className="mt-4 w-full rounded-lg bg-zinc-900 px-3 py-2 text-[13px] font-medium text-white transition hover:bg-zinc-800">
                        Open {c.code} Client Portal →
                      </button>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setClientStatus(c.id, c.status === 'paused' ? 'active' : 'paused')}
                          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-[12px] font-semibold text-zinc-600 transition hover:border-amber-300 hover:text-amber-700">
                          {c.status === 'paused' ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}{c.status === 'paused' ? 'Reactivate' : 'Pause'}
                        </button>
                        <button
                          disabled={hasData}
                          title={hasData ? 'Client has assets/audits — pause instead' : undefined}
                          onClick={() => { if (!hasData) setConfirmFor({ id: c.id, name: c.name }) }}
                          className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition ${hasData ? 'cursor-not-allowed border-zinc-100 text-zinc-300' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>
                          <Trash2 className="h-3.5 w-3.5" />Remove
                        </button>
                      </div>
                      {hasData && <p className="mt-1.5 flex items-start gap-1 text-[10.5px] leading-snug text-zinc-400"><Users className="mt-px h-3 w-3 shrink-0" />{assets} assets · {audits.length} audits on record — delete is locked to protect the audit trail. Pause instead.</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {world!.clients.length === 0 && (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"><Building2 className="h-6 w-6" /></span>
          <div className="text-[14px] font-semibold text-zinc-800">No clients yet</div>
          <p className="max-w-xs text-[13px] text-zinc-500">Onboard your first client organization — import their asset register right after.</p>
          <button onClick={() => setAddOpen(true)} className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 text-[13px] font-bold text-white transition hover:brightness-105"><Plus className="h-4 w-4" />Add client</button>
        </div>
      )}
      <AddClientDialog open={addOpen} onOpenChange={setAddOpen} />
      <AlertDialog open={!!confirmFor} onOpenChange={(v) => !v && setConfirmFor(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmFor?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the organization and its portal users. Only possible because they hold no assets, audits or other records — clients with data are paused instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <AlertDialogCancel className="h-10 rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmRemove() }} disabled={removing}
              className="h-10 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700">
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{removing ? 'Removing…' : 'Remove client'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Location hierarchy ──────────────────────────────────────────
const LEVEL_ICON: Record<string, React.ReactNode> = {
  site: <Factory className="h-4 w-4" />, building: <Landmark className="h-4 w-4" />,
  floor: <Layers className="h-4 w-4" />, zone: <Grid3X3 className="h-4 w-4" />,
  department: <Boxes className="h-4 w-4" />, room: <DoorOpen className="h-4 w-4" />,
}

export function LocationsView({ clientIdScope }: { clientIdScope?: string }) {
  const { world, setOpsView } = useES()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const locs = useMemo(
    () => (clientIdScope ? world!.locations.filter((l) => l.clientId === clientIdScope) : world!.locations),
    [world, clientIdScope],
  )
  const roots = locs.filter((l) => !l.parentId)
  const childrenOf = (id: string) => locs.filter((l) => l.parentId === id)
  const assetsAt = (id: string) => world!.assets.filter((a) => a.locationId === id).length
  const toggle = (id: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const renderNode = (l: (typeof locs)[number], depth: number): React.ReactNode => {
    const kids = childrenOf(l.id)
    const isCollapsed = collapsed.has(l.id)
    return (
      <div key={l.id}>
        <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-zinc-50" style={{ marginLeft: depth * 20 }}>
          {kids.length > 0 ? (
            <button onClick={() => toggle(l.id)} className="text-zinc-400 hover:text-zinc-600">{isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button>
          ) : <span className="w-3.5" />}
          <span className="text-zinc-400">{LEVEL_ICON[l.level]}</span>
          <button onClick={() => setOpsView('assets')} className="min-w-0 flex-1 text-left">
            <span className="text-[13px] font-medium text-zinc-800 group-hover:text-emerald-700">{l.name}</span>
            <span className="ml-2 font-mono text-[10px] text-zinc-400">{l.code}</span>
          </button>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium tabular-nums text-zinc-500">{assetsAt(l.id)} assets</span>
        </div>
        {!isCollapsed && kids.map((k) => renderNode(k, depth + 1))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Location Hierarchy</h1>
        <p className="text-[13px] text-zinc-500">Client → Site → Building → Floor → Zone → Department → Room → Asset</p>
      </div>
      {roots.length === 0 && (
        <div className="card border-dashed p-5">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-amber-500" />
            <div className="text-[13px] leading-relaxed text-zinc-600">
              <div className="font-semibold text-zinc-800">No locations exist yet — field scopes can't be published without them</div>
              <p className="mt-1">
                Assets attach to audit scopes <b>by location</b>, so the tree must exist before the register is imported. Two ways to create it:
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Run <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px]">prisma/neon-locations.sql</code> in your Neon SQL editor (creates the demo Meridian tree)</li>
                <li>Or add your own sites/buildings/rooms, then <b>re-import the same register file</b> — re-import now updates existing assets and links their locations automatically</li>
              </ol>
            </div>
          </div>
        </div>
      )}
      <div className="grid gap-3 xl:grid-cols-3">
        {roots.map((r) => {
          const client = world!.clients.find((c) => c.id === r.clientId)
          return (
            <div key={r.id} className="card p-3">
              <div className="mb-2 flex items-center gap-2 border-b border-zinc-100 pb-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <div>
                  <div className="text-[13px] font-semibold text-zinc-800">{r.name}</div>
                  <div className="text-[11px] text-zinc-400">{client?.name}{r.address ? ` · ${r.address}` : ''}</div>
                </div>
              </div>
              {childrenOf(r.id).map((c) => renderNode(c, 0))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Evidence Center ─────────────────────────────────────────────
export function EvidenceView({ clientIdScope }: { clientIdScope?: string }) {
  const { world } = useES()
  const [auditF, setAuditF] = useState('all')
  const evidence = useMemo(
    () => (clientIdScope ? world!.evidence.filter((e) => e.clientId === clientIdScope) : world!.evidence)
      .filter((e) => auditF === 'all' || e.auditId === auditF),
    [world, clientIdScope, auditF],
  )
  const auditLabel = (id: string | null) => world!.audits.find((a) => a.id === id)?.code ?? '—'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Evidence Center</h1>
          <p className="text-[13px] text-zinc-500">{evidence.length} items · every photo stays linked to its originating verification</p>
        </div>
        <div className="flex min-w-0 gap-2">
          <select value={auditF} onChange={(e) => setAuditF(e.target.value)} className="h-9 max-w-full min-w-0 rounded-md border border-zinc-200 bg-white px-2.5 text-[13px] text-zinc-700">
            <option value="all">All audits</option>
            {world!.audits.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </div>
      </div>
      {evidence.length === 0 ? <EmptyState icon={<ImageIcon className="h-8 w-8" />} title="No evidence" /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {evidence.slice(0, 36).map((e) => (
            <div key={e.id} className="group overflow-hidden card transition hover:shadow-md">
              <EvidenceThumb seed={e.colorSeed} code={e.assetCode} kind={e.kind} className="rounded-none" />
              <div className="p-2">
                <div className="truncate text-[11px] font-medium text-zinc-700">{e.label}</div>
                <div className="truncate text-[10px] text-zinc-400">{auditLabel(e.auditId)} · {e.capturedBy}</div>
                <div className="text-[10px] text-zinc-300">{fmtDateTime(e.capturedAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Reports ─────────────────────────────────────────────────────
export function ReportsView({ clientIdScope }: { clientIdScope?: string }) {
  const { world, generateReport, finalizeReport } = useES()
  const reports = useMemo(
    () => (clientIdScope ? world!.reports.filter((r) => r.clientId === clientIdScope) : world!.reports),
    [world, clientIdScope],
  )
  const versionTone = (v: string) => v === 'Final' ? 'bg-emerald-600 text-white' : v === 'Draft' ? 'bg-zinc-200 text-zinc-600' : 'bg-amber-100 text-amber-800'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Reports</h1>
        <p className="text-[13px] text-zinc-500">Consulting-grade deliverables · Draft → v1 → v2 → Final, then frozen</p>
      </div>
      <div className="space-y-3">
        {reports.map((r) => {
          const audit = world!.audits.find((a) => a.id === r.auditId)
          const client = world!.clients.find((c) => c.id === r.clientId)
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-4 card p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900"><FileText className="h-5 w-5 text-white" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[14px] font-semibold text-zinc-900">{r.name}</h3>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${versionTone(r.versionLabel)}`}>{r.versionLabel}</span>
                </div>
                <p className="truncate text-xs text-zinc-500">{client?.name} · {audit?.code ?? '—'} · {r.type} · {r.sizeLabel}</p>
                <p className="text-[11px] text-zinc-400">Generated by {r.generatedBy} · {fmtDateTime(r.generatedAt)}</p>
              </div>
              {r.status === 'final' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <History className="h-3 w-3" />Frozen · audit locked
                </span>
              ) : audit && (
                <div className="flex gap-2">
                  <button onClick={() => generateReport(audit.id)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700">New version</button>
                  <button onClick={() => finalizeReport(audit.id)} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800">Finalize</button>
                </div>
              )}
            </div>
          )
        })}
        {reports.length === 0 && <EmptyState icon={<FileText className="h-8 w-8" />} title="No reports yet" sub="Generate the first report once an audit reaches review." />}
      </div>
    </div>
  )
}
