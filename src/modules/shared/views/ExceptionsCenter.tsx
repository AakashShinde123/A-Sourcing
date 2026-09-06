'use client'

import React, { useMemo, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { ShieldAlert, UserPlus, SearchCheck, CheckCircle2, ClipboardCheck, Lock, ArrowRight } from 'lucide-react'
import { useES } from '@/modules/shared/store'
import { Pill, SimpleBadge, EmptyState, MicroLabel } from '@/modules/shared/ui-bits'
import { exceptionTypeMeta, exceptionStatusMeta, severityMeta, fmtDateTime } from '@/modules/shared/format'
import type { ExceptionItem } from '@/modules/shared/types'

const NEXT_ACTION: Record<string, { action: string; label: string; icon: React.ReactNode }[]> = {
  open: [{ action: 'assign', label: 'Assign', icon: <UserPlus className="h-3.5 w-3.5" /> }],
  assigned: [{ action: 'investigate', label: 'Start investigation', icon: <SearchCheck className="h-3.5 w-3.5" /> }],
  investigating: [{ action: 'resolve', label: 'Mark resolved', icon: <CheckCircle2 className="h-3.5 w-3.5" /> }],
  resolved: [{ action: 'review', label: 'Send to reviewer', icon: <ClipboardCheck className="h-3.5 w-3.5" /> }],
  reviewer_review: [{ action: 'approve', label: 'Approve', icon: <CheckCircle2 className="h-3.5 w-3.5" /> }],
  approved: [{ action: 'close', label: 'Close', icon: <Lock className="h-3.5 w-3.5" /> }],
  closed: [],
}

export function ExceptionsCenter({ clientIdScope, readOnly = false }: { clientIdScope?: string; readOnly?: boolean }) {
  const { world, patchException, openAsset360 } = useES()
  const [typeF, setTypeF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [sevF, setSevF] = useState('all')
  const [selected, setSelected] = useState<ExceptionItem | null>(null)
  const [note, setNote] = useState('')

  const all = useMemo(
    () => (clientIdScope ? world!.exceptions.filter((e) => e.clientId === clientIdScope) : world!.exceptions),
    [world, clientIdScope],
  )
  const filtered = useMemo(() => all.filter((e) => {
    if (typeF !== 'all' && e.type !== typeF) return false
    if (statusF !== 'all' && e.status !== statusF) return false
    if (sevF !== 'all' && e.severity !== sevF) return false
    return true
  }), [all, typeF, statusF, sevF])

  const counts = useMemo(() => ({
    open: all.filter((e) => ['open', 'assigned', 'investigating'].includes(e.status)).length,
    resolved: all.filter((e) => ['resolved', 'reviewer_review'].includes(e.status)).length,
    closed: all.filter((e) => ['approved', 'closed'].includes(e.status)).length,
  }), [all])

  async function act(e: ExceptionItem, action: string) {
    await patchException(e.id, action, note || undefined)
    toast.success(`Exception ${e.code} → ${action}`, { description: 'Lifecycle event recorded in the audit trail.' })
    setNote('')
    if (action === 'close') setSelected(null)
  }

  const detail = selected ? all.find((e) => e.id === selected.id) ?? selected : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Exception Center</h1>
          <p className="text-[13px] text-zinc-500">{counts.open} active · {counts.resolved} in review · {counts.closed} closed</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={typeF} onValueChange={setTypeF}>
            <SelectTrigger className="h-9 w-[160px] border-zinc-200 bg-white text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(exceptionTypeMeta).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sevF} onValueChange={setSevF}>
            <SelectTrigger className="h-9 w-[130px] border-zinc-200 bg-white text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severity</SelectItem>
              {Object.entries(severityMeta).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="h-9 w-[150px] border-zinc-200 bg-white text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(exceptionStatusMeta).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/70 text-left">
                {['Exception', 'Type', 'Severity', 'Asset', 'Location', 'Detected', 'Status', ''].map((h, i) => (
                  <th key={i} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtered.map((e) => (
                <tr key={e.id} onClick={() => setSelected(e)} className="cursor-pointer transition hover:bg-emerald-50/30">
                  <td className="max-w-[260px] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className={`h-4 w-4 shrink-0 ${e.severity === 'critical' ? 'text-red-500' : e.severity === 'high' ? 'text-orange-500' : 'text-zinc-300'}`} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-zinc-800">{e.title}</div>
                        <div className="font-mono text-[10px] text-zinc-400">{e.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-zinc-600">{exceptionTypeMeta[e.type]?.label ?? e.type}</td>
                  <td className="whitespace-nowrap px-3 py-2.5"><SimpleBadge label={severityMeta[e.severity]?.label ?? e.severity} cls={severityMeta[e.severity]?.cls ?? ''} /></td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-zinc-500">{e.assetCode ?? <span className="italic text-teal-600">discovery</span>}</td>
                  <td className="max-w-[160px] px-3 py-2.5"><div className="truncate text-zinc-500">{e.locationLabel ?? '—'}</div></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-zinc-500">{fmtDateTime(e.detectedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5"><Pill meta={exceptionStatusMeta[e.status] ?? exceptionStatusMeta.open} size="xs" /></td>
                  <td className="px-3 py-2.5 text-right">
                    {!readOnly && NEXT_ACTION[e.status]?.length ? (
                      <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" onClick={(ev) => { ev.stopPropagation(); act(e, NEXT_ACTION[e.status][0].action) }}>
                        {NEXT_ACTION[e.status][0].icon}{NEXT_ACTION[e.status][0].label}<ArrowRight className="h-3 w-3" />
                      </Button>
                    ) : <span />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Card list (phones) — full-width actions instead of table columns */}
      <div className="space-y-2 md:hidden">
        {filtered.map((e) => (
          <div key={e.id} className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <button onClick={() => setSelected(e)} className="w-full text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className={`h-4 w-4 shrink-0 ${e.severity === 'critical' ? 'text-red-500' : e.severity === 'high' ? 'text-orange-500' : 'text-zinc-300'}`} />
                    <span className="truncate text-[14px] font-semibold text-zinc-900">{e.title}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-zinc-400">{e.code}</div>
                </div>
                <Pill meta={exceptionStatusMeta[e.status] ?? exceptionStatusMeta.open} size="xs" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-zinc-500">
                <SimpleBadge label={severityMeta[e.severity]?.label ?? e.severity} cls={severityMeta[e.severity]?.cls ?? ''} />
                <span>{exceptionTypeMeta[e.type]?.label ?? e.type}</span>
                <span className="font-mono text-[11px]">{e.assetCode ?? <span className="italic text-teal-600">discovery</span>}</span>
                <span className="text-zinc-400">{fmtDateTime(e.detectedAt)}</span>
              </div>
            </button>
            {!readOnly && NEXT_ACTION[e.status]?.length ? (
              <Button size="sm" variant="outline" className="mt-3 h-10 w-full gap-1 text-[12px]"
                onClick={() => act(e, NEXT_ACTION[e.status][0].action)}>
                {NEXT_ACTION[e.status][0].icon}{NEXT_ACTION[e.status][0].label}<ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      {filtered.length === 0 && <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"><EmptyState title="No exceptions match" sub="Adjust the filters above — or enjoy the clean register." /></div>}

      {/* Detail sheet */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto bg-white p-0 sm:max-w-md">
          {detail && (
            <div className="flex h-full flex-col">
              <SheetHeader className="space-y-1 border-b border-zinc-100 px-5 py-4 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-zinc-400">{detail.code}</span>
                  <Pill meta={exceptionStatusMeta[detail.status] ?? exceptionStatusMeta.open} size="xs" />
                </div>
                <SheetTitle className="text-[15px] leading-snug">{detail.title}</SheetTitle>
                <SheetDescription className="text-xs">{exceptionTypeMeta[detail.type]?.label} · {detail.locationLabel ?? '—'} · detected by {detail.detectedBy}</SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div>
                  <MicroLabel>Description</MicroLabel>
                  <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">{detail.description}</p>
                </div>
                {detail.assetId && (
                  <button onClick={() => openAsset360(detail.assetId!)} className="w-full rounded-lg border border-zinc-200 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/30">
                    <MicroLabel>Linked asset</MicroLabel>
                    <div className="mt-1 text-[13px] font-medium text-zinc-800">{detail.assetDescription}</div>
                    <div className="font-mono text-[11px] text-zinc-400">{detail.assetCode}</div>
                  </button>
                )}
                {detail.detail && (() => {
                  try {
                    const d = JSON.parse(detail.detail) as { description?: string; make?: string; model?: string; serial?: string; condition?: string }
                    return (
                      <div className="rounded-lg bg-teal-50/60 p-3 ring-1 ring-teal-100">
                        <MicroLabel className="text-teal-700">Discovery payload</MicroLabel>
                        <div className="mt-1 text-[13px] text-zinc-700">{d.description}</div>
                        <div className="text-xs text-zinc-500">{d.make} {d.model} · SN {d.serial} · {d.condition}</div>
                      </div>
                    )
                  } catch { return null }
                })()}
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div><MicroLabel>Detected</MicroLabel><div className="mt-0.5 text-zinc-700">{fmtDateTime(detail.detectedAt)}</div></div>
                  <div><MicroLabel>Assigned to</MicroLabel><div className="mt-0.5 text-zinc-700">{detail.assignedTo ?? '—'}</div></div>
                </div>
                {detail.resolutionNote && (
                  <div className="rounded-lg bg-emerald-50/60 p-3 ring-1 ring-emerald-100">
                    <MicroLabel className="text-emerald-700">Resolution</MicroLabel>
                    <p className="mt-1 text-[13px] text-zinc-700">{detail.resolutionNote}</p>
                    <p className="mt-1 text-[11px] text-zinc-400">{fmtDateTime(detail.resolvedAt)}</p>
                  </div>
                )}
                {!readOnly && (
                  <div>
                    <MicroLabel>Action note (optional)</MicroLabel>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What action was taken? Original detection events are never overwritten…" className="mt-1.5 min-h-[70px] text-[13px]" />
                  </div>
                )}
              </div>
              {!readOnly && (
                <div className="border-t border-zinc-100 p-4">
                  {NEXT_ACTION[detail.status]?.length ? (
                    <div className="flex gap-2">
                      {NEXT_ACTION[detail.status].map((a) => (
                        <Button key={a.action} size="sm" className="flex-1 gap-1.5 bg-zinc-900 hover:bg-zinc-800" onClick={() => act(detail, a.action)}>{a.icon}{a.label}</Button>
                      ))}
                    </div>
                  ) : <div className="text-center text-xs text-zinc-400">This exception is closed and locked in the audit trail.</div>}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
