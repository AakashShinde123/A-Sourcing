'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ChevronLeft, MapPin, CalendarDays, ShieldCheck, ShieldAlert, ArrowRight, FileText, Plus, Users, Trash2, Loader2 } from 'lucide-react'
import { useES } from '@/modules/shared/store'
import { Pill, Bar as ProgressBar, Avatar, MicroLabel, EmptyState } from '@/modules/shared/ui-bits'
import { auditStatusMeta, resultMeta, AUDIT_STAGES, auditStageIndex, fmtDate } from '@/modules/shared/format'
import type { Audit } from '@/modules/shared/types'

const AUDIT_TYPES = [
  'Annual Physical Verification',
  'Fixed Asset Verification',
  'Asset Tagging',
  'Location Verification',
  'Custodian Verification',
  'Special Audit',
]

/** Indian fiscal year label — mirrors the Core API (April → March). */
function defaultFY(d = new Date()): string {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  return `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`
}
const todayISO = () => new Date().toISOString().slice(0, 10)

export function AuditsView({ clientIdScope }: { clientIdScope?: string }) {
  const { world, selectedAuditId, openAudit } = useES()
  const isOps = !clientIdScope
  const audits = useMemo(
    () => (clientIdScope ? world!.audits.filter((a) => a.clientId === clientIdScope) : world!.audits),
    [world, clientIdScope],
  )
  const current = audits.find((a) => a.id === selectedAuditId) ?? null
  if (current) return <AuditDetail audit={current} onBack={() => openAudit('')} isOps={isOps} />
  return <AuditList audits={audits} onOpen={openAudit} isOps={isOps} />
}

function AuditList({ audits, onOpen, isOps }: { audits: Audit[]; onOpen: (id: string) => void; isOps: boolean }) {
  const { world } = useES()
  const clientById = useMemo(() => new Map((world?.clients ?? []).map((c) => [c.id, c])), [world])
  const [newOpen, setNewOpen] = useState(false)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Audit Projects</h1>
          <p className="text-[13px] text-zinc-500">{audits.length} projects · Draft → Planning → Field → Review → Client Approval → Archived</p>
        </div>
        {isOps && (
          <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> New audit project
          </Button>
        )}
      </div>
      <NewAuditDialog open={newOpen} onOpenChange={setNewOpen} onCreated={onOpen} />
      <div className="grid gap-3 lg:grid-cols-2">
        {audits.map((a) => {
          const client = clientById.get(a.clientId)
          const stage = auditStageIndex(a.status)
          return (
            <button key={a.id} onClick={() => onOpen(a.id)}
              className="group card card-hover p-4 text-left transition hover:border-emerald-300 hover:shadow-[0_4px_14px_rgba(16,185,129,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-zinc-400">{a.code}</span>
                    <Pill meta={auditStatusMeta[a.status]} size="xs" />
                  </div>
                  <h3 className="mt-1 truncate text-[15px] font-semibold tracking-tight text-zinc-900">{a.name}</h3>
                  <p className="mt-0.5 text-xs text-zinc-500">{client?.name} · {a.type} · {a.financialYear}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
              </div>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-zinc-400">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{a.locationsLabel}</span>
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{fmtDate(a.startDate)}{a.endDate ? ` → ${fmtDate(a.endDate)}` : ''}</span>
              </div>
              {/* lifecycle mini-stepper */}
              <div className="mt-3 flex items-center gap-1" aria-hidden>
                {AUDIT_STAGES.slice(0, 8).map((s, i) => (
                  <div key={s} className={`h-1 flex-1 rounded-full ${i <= stage ? (s === 'client_review' ? 'bg-orange-400' : 'bg-emerald-500') : 'bg-zinc-100'}`} />
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-zinc-500 tabular-nums">{a.verifiedAssets}/{a.totalInScope} assets verified</span>
                <span className={`font-medium tabular-nums ${a.openExceptions ? 'text-red-600' : 'text-emerald-600'}`}>{a.openExceptions} open exceptions</span>
              </div>
              <ProgressBar value={a.progress} className="mt-2" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// small helper to read a client from store inside list items
function useESWorldClient(clientId: string) {
  const { world } = useES()
  return world?.clients.find((c) => c.id === clientId)
}

function AuditDetail({ audit, onBack, isOps }: { audit: Audit; onBack: () => void; isOps: boolean }) {
  const { world, generateReport, advanceAudit, unassignAssignment } = useES()
  const client = useMemo(() => world?.clients.find((c) => c.id === audit.clientId), [world, audit.clientId])
  const assignments = useMemo(() => world!.assignments.filter((a) => a.auditId === audit.id), [world, audit])
  const verifs = useMemo(() => world!.verifications.filter((v) => v.auditId === audit.id).slice(0, 8), [world, audit])
  const exs = useMemo(() => world!.exceptions.filter((e) => e.auditId === audit.id), [world, audit])
  const reports = useMemo(() => world!.reports.filter((r) => r.auditId === audit.id), [world, audit])
  const approvals = useMemo(() => world!.approvals.filter((r) => r.auditId === audit.id), [world, audit])
  const stage = auditStageIndex(audit.status)
  const nextStage = AUDIT_STAGES[stage + 1]
  const resultRows = Object.entries(audit.byResult).sort((a, b) => b[1] - a[1])
  const [assignOpen, setAssignOpen] = useState(false)
  const [unassignTarget, setUnassignTarget] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState(false)

  const doAdvance = async () => {
    setAdvancing(true)
    try { await advanceAudit(audit.id) } finally { setAdvancing(false) }
  }

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 gap-1 text-zinc-500" onClick={onBack}><ChevronLeft className="h-4 w-4" />All audits</Button>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-zinc-400">{audit.code}</span>
              <Pill meta={auditStatusMeta[audit.status]} size="xs" />
            </div>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-zinc-900">{audit.name}</h1>
            <p className="text-[13px] text-zinc-500">{client?.name} · {audit.type} · {audit.financialYear}</p>
          </div>
          <div className="flex gap-2">
            {isOps && nextStage && (
              <Button size="sm" variant="outline" className="gap-1.5" disabled={advancing} onClick={doAdvance}>
                {advancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}
                Move to {auditStatusMeta[nextStage].label}
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => generateReport(audit.id)}><FileText className="h-3.5 w-3.5" />Generate report</Button>
          </div>
        </div>
      </div>

      {/* Lifecycle */}
      <div className="card p-4">
        <MicroLabel>Lifecycle</MicroLabel>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="mt-3 flex min-w-[620px] items-center">
          {AUDIT_STAGES.slice(0, 8).map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-1.5">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${i < stage ? 'bg-emerald-500 text-white' : i === stage ? 'bg-zinc-900 text-white ring-4 ring-zinc-900/10' : 'bg-zinc-100 text-zinc-400'}`}>
                  {i < stage ? '✓' : i + 1}
                </span>
                <span className={`whitespace-nowrap text-[10px] font-medium ${i <= stage ? 'text-zinc-700' : 'text-zinc-300'}`}>{auditStatusMeta[s].label}</span>
              </div>
              {i < 7 && <div className={`mx-1 mb-4 h-px flex-1 ${i < stage ? 'bg-emerald-400' : 'bg-zinc-100'}`} />}
            </React.Fragment>
          ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Reconciliation */}
        <div className="card p-4">
          <MicroLabel>Reconciliation</MicroLabel>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-semibold tabular-nums text-zinc-900">{audit.progress}%</span>
            <span className="pb-1 text-xs text-zinc-400">{audit.verifiedAssets} of {audit.totalInScope} in scope</span>
          </div>
          <ProgressBar value={audit.progress} className="mt-2" />
          <div className="mt-4 space-y-0">
            {resultRows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-1.5 text-[13px]">
                <span className="inline-flex items-center gap-2 text-zinc-600">
                  <span className="h-2 w-2 rounded-full" style={{ background: k === 'matched' ? '#10b981' : k === 'missing' ? '#ef4444' : k === 'location_mismatch' ? '#f59e0b' : k === 'custodian_mismatch' ? '#f97316' : k === 'serial_mismatch' ? '#f43f5e' : '#71717a' }} />
                  {resultMeta[k]?.label ?? k}
                </span>
                <span className="font-medium tabular-nums text-zinc-800">{v}</span>
              </div>
            ))}
            <div className="mt-2 border-t border-zinc-100 pt-2 text-[11px] leading-relaxed text-zinc-400">
              Results are computed by the deterministic reconciliation engine — register data vs field evidence. AI never decides audit results.
            </div>
          </div>
        </div>

        {/* Assignments */}
        <div className="card p-4 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <MicroLabel>Field assignments</MicroLabel>
            {isOps && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => setAssignOpen(true)}>
                <Users className="h-3.5 w-3.5" /> Assign field team
              </Button>
            )}
          </div>
          {assignments.length === 0 ? <div className="mt-3"><EmptyState title="No assignments yet" sub={isOps ? 'Publish a scope to a field team member — they will see it in the mobile app and can start verifying.' : 'This audit is still in planning — auditors will appear here once scopes are published.'} /></div> : (
            <div className="mt-2 divide-y divide-zinc-100">
              {assignments.map((asg) => {
                const inScope = world!.assets.filter((a) => a.assignmentId === asg.id).length
                const done = new Set(world!.verifications.filter((v) => v.assignmentId === asg.id).map((v) => v.assetId)).size
                const pct = inScope ? Math.round((done / inScope) * 100) : 0
                return (
                  <div key={asg.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                    <Avatar name={asg.auditor.name} seed={asg.auditor.colorSeed} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-zinc-800">{asg.auditor.name}</div>
                      <div className="truncate text-xs text-zinc-400">{asg.scope}</div>
                    </div>
                    <div className="order-last w-full sm:order-none sm:w-36">
                      <div className="mb-1 flex justify-between text-[11px] tabular-nums text-zinc-500"><span>{done}/{inScope}</span><span>{pct}%</span></div>
                      <ProgressBar value={pct} />
                    </div>
                    <span className="hidden sm:block">
                      <Pill size="xs" meta={asg.status === 'field_complete' ? { label: 'Field Complete', cls: 'bg-teal-50 text-teal-700 ring-teal-200', dot: 'bg-teal-500' } : asg.status === 'in_progress' ? { label: 'In Progress', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' } : { label: 'Assigned', cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200', dot: 'bg-zinc-400' }} />
                    </span>
                    {isOps && (
                      <button
                        onClick={() => setUnassignTarget(asg.id)}
                        title="Withdraw this scope"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Recent verifications */}
        <div className="card p-4 xl:col-span-2">
          <MicroLabel>Recent field verifications</MicroLabel>
          <div className="mt-2 divide-y divide-zinc-50">
            {verifs.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  {v.gpsStatus === 'captured' ? <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" /> : <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />}
                  <div className="min-w-0">
                    <div className="truncate text-[13px] text-zinc-800"><span className="font-mono text-[11px] text-zinc-400">{v.assetCode}</span> {v.assetDescription}</div>
                    <div className="text-[11px] text-zinc-400">{v.auditorName} · {fmtDate(v.verifiedAt)} · {v.method}{v.createdOffline ? ' · offline' : ''}</div>
                  </div>
                </div>
                <Pill meta={resultMeta[v.result] ?? resultMeta.deferred} size="xs" />
              </div>
            ))}
            {verifs.length === 0 && <EmptyState title="No field verifications yet" />}
          </div>
        </div>

        {/* Exceptions + reports + approvals */}
        <div className="space-y-4">
          <div className="card p-4">
            <MicroLabel>Exceptions · {audit.totalExceptions}</MicroLabel>
            <div className="mt-2 space-y-1.5">
              {exs.slice(0, 4).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-2">
                  <span className="truncate text-xs text-zinc-700">{e.title}</span>
                  <Pill meta={auditStatusMeta[audit.status] && { label: e.status.replace('_', ' '), cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200', dot: 'bg-zinc-400' }} size="xs" />
                </div>
              ))}
              {exs.length === 0 && <div className="py-3 text-center text-xs text-zinc-400">No exceptions in this audit</div>}
            </div>
          </div>
          <div className="card p-4">
            <MicroLabel>Reports &amp; approvals</MicroLabel>
            <div className="mt-2 space-y-1.5">
              {reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-2.5 py-2 text-xs">
                  <span className="truncate text-zinc-700">{r.name}</span>
                  <span className="ml-2 shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-500 ring-1 ring-zinc-200">{r.versionLabel}</span>
                </div>
              ))}
              {approvals.map((ap, i) => (
                <div key={i} className="rounded-lg bg-zinc-50 px-2.5 py-2 text-xs">
                  <span className={ap.decision === 'approved' ? 'font-medium text-emerald-700' : 'font-medium text-amber-700'}>{ap.decision === 'approved' ? 'Approved' : 'Changes requested'}</span>
                  <span className="text-zinc-400"> · {ap.byName} ({ap.byRole})</span>
                  {ap.comment && <p className="mt-0.5 text-[11px] text-zinc-500">&ldquo;{ap.comment}&rdquo;</p>}
                </div>
              ))}
              {reports.length === 0 && approvals.length === 0 && <div className="py-3 text-center text-xs text-zinc-400">Reports appear after field completion</div>}
            </div>
          </div>
        </div>
      </div>

      <AssignDialog audit={audit} open={assignOpen} onOpenChange={setAssignOpen} />
      <AlertDialog open={!!unassignTarget} onOpenChange={(o) => !o && setUnassignTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this field scope?</AlertDialogTitle>
            <AlertDialogDescription>
              The team member loses access to this scope on their device. Assets are released back to the unassigned pool; verifications already recorded are kept as history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep scope</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => { const id = unassignTarget; setUnassignTarget(null); if (id) void unassignAssignment(audit.id, id) }}
            >
              Withdraw scope
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── New audit project dialog (ops only) ───────────────────────────

function NewAuditDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const { world, createAudit } = useES()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ clientId: '', name: '', type: AUDIT_TYPES[0], financialYear: defaultFY(), startDate: todayISO(), endDate: '', locationsLabel: '' })

  const issue = useMemo(() => {
    if (!form.clientId) return 'Pick the client this audit is for'
    if (form.name.trim().length < 3) return 'Give the project a name (3+ characters)'
    if (form.startDate && form.endDate && form.endDate < form.startDate) return 'End date cannot be before the start date'
    return null
  }, [form])

  const submit = async () => {
    if (issue || busy) return
    setBusy(true)
    try {
      const id = await createAudit({
        clientId: form.clientId,
        name: form.name.trim(),
        type: form.type,
        financialYear: form.financialYear.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        locationsLabel: form.locationsLabel.trim() || undefined,
      })
      if (id) {
        onOpenChange(false)
        setForm({ clientId: '', name: '', type: AUDIT_TYPES[0], financialYear: defaultFY(), startDate: todayISO(), endDate: '', locationsLabel: '' })
        onCreated(id)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New audit project</DialogTitle>
          <DialogDescription>
            Creates a draft project. Next step after this: publish a field scope so your team sees it in the mobile app.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3.5">
          <div className="grid gap-1.5">
            <Label>Client *</Label>
            <Select value={form.clientId} onValueChange={(v) => setForm((f) => ({ ...f, clientId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {(world?.clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Project name *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Chakan Plant Annual Verification" />
          </div>
          <div className="grid gap-1.5">
            <Label>Engagement type *</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUDIT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Financial year</Label>
              <Input value={form.financialYear} onChange={(e) => setForm((f) => ({ ...f, financialYear: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Start date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>End date (optional)</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Locations label</Label>
              <Input value={form.locationsLabel} onChange={(e) => setForm((f) => ({ ...f, locationsLabel: e.target.value }))} placeholder="e.g. Chakan Plant" />
            </div>
          </div>
          {issue && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-amber-200">{issue}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!!issue || busy} onClick={submit}>
            {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Assign field team dialog (ops only) ───────────────────────────

function AssignDialog({ audit, open, onOpenChange }: { audit: Audit; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { world, assignAuditor } = useES()
  const [auditorId, setAuditorId] = useState('')
  const [locationId, setLocationId] = useState('none')
  const [scope, setScope] = useState('')
  const [scopeTouched, setScopeTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  const locations = useMemo(() => (world?.locations ?? []).filter((l) => l.clientId === audit.clientId), [world, audit.clientId])
  const auditor = world?.auditors.find((a) => a.id === auditorId)
  const location = locations.find((l) => l.id === locationId)
  const willAttach = useMemo(
    () => (locationId !== 'none' ? (world?.assets ?? []).filter((a) => a.clientId === audit.clientId && a.locationId === locationId && a.assignmentId === null).length : 0),
    [world, audit.clientId, locationId],
  )

  // keep the suggested scope in sync until the user edits it by hand
  useEffect(() => {
    if (scopeTouched) return
    setScope(location ? `${location.name} — ${audit.name}` : `General scope — ${audit.name}`)
  }, [location, audit.name, scopeTouched])

  const submit = async () => {
    if (!auditorId || busy) return
    setBusy(true)
    try {
      const attached = await assignAuditor(audit.id, auditorId, locationId === 'none' ? null : locationId, scope.trim() || `General scope — ${audit.name}`)
      if (attached !== null) {
        onOpenChange(false)
        setAuditorId(''); setLocationId('none'); setScopeTouched(false)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setScopeTouched(false) } onOpenChange(o) }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign field team</DialogTitle>
          <DialogDescription>
            Publish a scope to a team member. Assets parked at the chosen location are linked automatically and appear in their mobile app.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3.5">
          <div className="grid gap-1.5">
            <Label>Team member *</Label>
            <Select value={auditorId} onValueChange={setAuditorId}>
              <SelectTrigger><SelectValue placeholder="Select field team member" /></SelectTrigger>
              <SelectContent>
                {(world?.auditors ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name} · {a.employeeCode}{a.city ? ` · ${a.city}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Location scope</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific location (manual scans only)</SelectItem>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {locationId !== 'none' && (
              <p className="text-xs text-zinc-500">
                <span className="font-semibold text-emerald-700">{willAttach}</span> unassigned asset{willAttach === 1 ? '' : 's'} at this location will be linked to this scope.
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>Scope label</Label>
            <Input value={scope} onChange={(e) => { setScopeTouched(true); setScope(e.target.value) }} placeholder="What the auditor sees on their device" />
          </div>
          {auditor && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-200">
              <strong>{auditor.name}</strong> will see this assignment in the field app after their next sync.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!auditorId || busy} onClick={submit}>
            {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Publish scope
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
