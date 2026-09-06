'use client'

import React, { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, MapPin, CalendarDays, ShieldCheck, ShieldAlert, ArrowRight, FileText } from 'lucide-react'
import { useES } from '../store'
import { Pill, Bar as ProgressBar, Avatar, MicroLabel, EmptyState } from '../ui-bits'
import { auditStatusMeta, resultMeta, AUDIT_STAGES, auditStageIndex, fmtDate } from '@/lib/es-format'
import type { Audit } from '@/lib/es-types'

export function AuditsView({ clientIdScope }: { clientIdScope?: string }) {
  const { world, selectedAuditId, openAudit } = useES()
  const audits = useMemo(
    () => (clientIdScope ? world!.audits.filter((a) => a.clientId === clientIdScope) : world!.audits),
    [world, clientIdScope],
  )
  const current = audits.find((a) => a.id === selectedAuditId) ?? null
  if (current) return <AuditDetail audit={current} onBack={() => openAudit('')} />
  return <AuditList audits={audits} onOpen={openAudit} />
}

function AuditList({ audits, onOpen }: { audits: Audit[]; onOpen: (id: string) => void }) {
  const { world } = useES()
  const clientById = useMemo(() => new Map((world?.clients ?? []).map((c) => [c.id, c])), [world])
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Audit Projects</h1>
        <p className="text-[13px] text-zinc-500">{audits.length} projects · Draft → Planning → Field → Review → Client Approval → Archived</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {audits.map((a) => {
          const client = clientById.get(a.clientId)
          const stage = auditStageIndex(a.status)
          return (
            <button key={a.id} onClick={() => onOpen(a.id)}
              className="group rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-emerald-300 hover:shadow-[0_4px_14px_rgba(16,185,129,0.08)]">
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

function AuditDetail({ audit, onBack }: { audit: Audit; onBack: () => void }) {
  const { world, generateReport } = useES()
  const client = useMemo(() => world?.clients.find((c) => c.id === audit.clientId), [world, audit.clientId])
  const assignments = useMemo(() => world!.assignments.filter((a) => a.auditId === audit.id), [world, audit])
  const verifs = useMemo(() => world!.verifications.filter((v) => v.auditId === audit.id).slice(0, 8), [world, audit])
  const exs = useMemo(() => world!.exceptions.filter((e) => e.auditId === audit.id), [world, audit])
  const reports = useMemo(() => world!.reports.filter((r) => r.auditId === audit.id), [world, audit])
  const approvals = useMemo(() => world!.approvals.filter((r) => r.auditId === audit.id), [world, audit])
  const stage = auditStageIndex(audit.status)
  const resultRows = Object.entries(audit.byResult).sort((a, b) => b[1] - a[1])

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
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => generateReport(audit.id)}><FileText className="h-3.5 w-3.5" />Generate report</Button>
          </div>
        </div>
      </div>

      {/* Lifecycle */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <MicroLabel>Lifecycle</MicroLabel>
        <div className="mt-3 flex items-center">
          {AUDIT_STAGES.slice(0, 8).map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-1.5">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${i < stage ? 'bg-emerald-500 text-white' : i === stage ? 'bg-zinc-900 text-white ring-4 ring-zinc-900/10' : 'bg-zinc-100 text-zinc-400'}`}>
                  {i < stage ? '✓' : i + 1}
                </span>
                <span className={`whitespace-nowrap text-[10px] font-medium ${i <= stage ? 'text-zinc-700' : 'text-zinc-300'}`}>{auditStatusMeta[s].label}</span>
              </div>
              {i < 7 && <div className={`mx-1 mb-4 h-px flex-1 ${i < stage ? 'bg-emerald-400' : 'bg-zinc-100'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Reconciliation */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] xl:col-span-2">
          <MicroLabel>Field assignments</MicroLabel>
          {assignments.length === 0 ? <div className="mt-3"><EmptyState title="No assignments yet" sub="This audit is still in planning — auditors will appear here once scopes are published." /></div> : (
            <div className="mt-2 divide-y divide-zinc-100">
              {assignments.map((asg) => {
                const inScope = world!.assets.filter((a) => a.assignmentId === asg.id).length
                const done = new Set(world!.verifications.filter((v) => v.assignmentId === asg.id).map((v) => v.assetId)).size
                const pct = inScope ? Math.round((done / inScope) * 100) : 0
                return (
                  <div key={asg.id} className="flex items-center gap-3 py-3">
                    <Avatar name={asg.auditor.name} seed={asg.auditor.colorSeed} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-zinc-800">{asg.auditor.name}</div>
                      <div className="truncate text-xs text-zinc-400">{asg.scope}</div>
                    </div>
                    <div className="w-36">
                      <div className="mb-1 flex justify-between text-[11px] tabular-nums text-zinc-500"><span>{done}/{inScope}</span><span>{pct}%</span></div>
                      <ProgressBar value={pct} />
                    </div>
                    <Pill size="xs" meta={asg.status === 'field_complete' ? { label: 'Field Complete', cls: 'bg-teal-50 text-teal-700 ring-teal-200', dot: 'bg-teal-500' } : asg.status === 'in_progress' ? { label: 'In Progress', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' } : { label: 'Assigned', cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200', dot: 'bg-zinc-400' }} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Recent verifications */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] xl:col-span-2">
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
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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
    </div>
  )
}
