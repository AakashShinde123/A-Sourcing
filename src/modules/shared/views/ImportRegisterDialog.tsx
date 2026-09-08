'use client'

// @es/shared · ImportRegisterDialog
// The workflow's front door — mirrors how audit firms actually start: the client
// emails their fixed-asset register (Excel/CSV export from their ERP), the ops
// team imports it, and field verification happens against that baseline.
// Parsing happens client-side; the Core API (/api/core/assets/import) is the
// controlled, auditable intake.

import React, { useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FileUp, Sheet, CircleCheck, TriangleAlert, CopyX, Loader2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useES } from '../store'
import { parseRegister, parseSheetRows, type ParsedRow } from '../register-parse'

// CSV parsing lives in ../register-parse.ts — pure, unit-tested, no React.

const SAMPLE_CSV = `Asset ID,Description,Category,Make,Model,Serial No,Barcode,Location,Custodian
FA-1201,Vertical Band Saw,Production Machinery,Kaltenborg,VB-400,KS-99214,BC1201,Production Block A,K. Menon
FA-1203,Server Rack 42U,IT Infrastructure,APC,SR42U,AP-77120,BC1203,Server Room,S. Iyer
FA-1206,Hydraulic Pallet Truck,Material Handling,Godrej,HPD-25,GD-33011,BC1206,Warehouse — Racking,D. Joshi`

export function ImportRegisterDialog({ open, onOpenChange, defaultClientId, lockClient }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  defaultClientId?: string
  lockClient?: string
}) {
  const { world, importAssets } = useES()
  const [clientId, setClientId] = useState(lockClient ?? defaultClientId ?? '')
  const [text, setText] = useState('')
  const [grid, setGrid] = useState<(string | number | boolean | null | undefined)[][] | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const effectiveClientId = lockClient ?? clientId
  const client = world?.clients.find((c) => c.id === effectiveClientId)

  const parsed = useMemo(
    () => (grid ? parseSheetRows(grid) : parseRegister(text)),
    [grid, text],
  )
  const { rows, headerMapped } = parsed
  const validRows = useMemo(
    () => rows.filter((r) => r.clientAssetId && r.description && r.category),
    [rows],
  )
  const invalidCount = rows.length - validRows.length
  const preview = validRows.slice(0, 5)

  const onFile = async (f: File | null) => {
    if (!f) return
    setFileName(f.name)
    if (/\.xlsx?$/i.test(f.name)) {
      // Real Excel workbooks — SheetJS is loaded on first use to keep the app bundle lean.
      const XLSX = await import('xlsx')
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const cells = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, { header: 1, raw: false, defval: '' })
      setGrid(cells)
      setText('')
    } else {
      setGrid(null)
      setText(await f.text())
    }
  }

  const reset = () => { setText(''); setGrid(null); setFileName(null); if (fileRef.current) fileRef.current.value = '' }

  const doImport = async () => {
    if (!effectiveClientId || !validRows.length) return
    setBusy(true)
    const res = await importAssets(effectiveClientId, validRows as unknown as Record<string, unknown>[])
    setBusy(false)
    if (res) {
      toast.success(`Imported ${res.imported} asset${res.imported === 1 ? '' : 's'}`, {
        description: [
          res.skipped ? `${res.skipped} duplicate${res.skipped === 1 ? '' : 's'} skipped` : null,
          res.rejected ? `${res.rejected} rejected` : null,
          `Registered to ${client?.name ?? 'client'} — awaiting tagging & assignment`,
        ].filter(Boolean).join(' · '),
      })
      reset()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto bg-white sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.6)]">
              <FileUp className="h-4 w-4 text-white" />
            </span>
            Import asset register
          </DialogTitle>
          <DialogDescription className="text-left">
            Start the engagement from the client&apos;s own register — drop their Excel (.xlsx) or CSV export here.
            Columns are auto-detected; duplicates are skipped, never double-counted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          {/* client picker */}
          {lockClient ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50/70 px-3 py-2.5 ring-1 ring-emerald-200/70">
              <span className="text-[12.5px] text-zinc-600">Register for</span>
              <span className="text-[13px] font-semibold text-emerald-800">{client?.name}</span>
            </div>
          ) : (
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">Client</div>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-9 w-full border-zinc-200 bg-white text-[13px]"><SelectValue placeholder="Pick the client this register belongs to" /></SelectTrigger>
                <SelectContent>{world?.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          {/* file drop / paste */}
          <label
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition',
              fileName ? 'border-emerald-300 bg-emerald-50/50' : 'border-zinc-300 bg-zinc-50/60 hover:border-emerald-300 hover:bg-emerald-50/40',
            )}
          >
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
              <Sheet className="h-5 w-5 text-emerald-600" />
            </span>
            {fileName ? (
              <span className="text-[13px] font-semibold text-emerald-700">{fileName} loaded — {rows.length} row{rows.length === 1 ? '' : 's'} found</span>
            ) : (
              <>
                <span className="text-[13px] font-semibold text-zinc-700">Drop the register here — Excel (.xlsx) or CSV</span>
                <span className="text-[11.5px] text-zinc-400">First worksheet is read · columns auto-detected</span>
              </>
            )}
          </label>

          <details className="group rounded-xl ring-1 ring-zinc-200 open:bg-zinc-50/60">
            <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-[12px] font-semibold text-zinc-600 select-none">
              Or paste CSV text directly
              <span className="text-[11px] font-medium text-emerald-600 group-open:hidden">show paste box</span>
            </summary>
            <div className="px-3 pb-3">
              <textarea
                value={grid ? '' : text}
                onChange={(e) => { setText(e.target.value); setGrid(null); setFileName(null) }}
                placeholder={SAMPLE_CSV}
                rows={5}
                className="w-full resize-y rounded-lg border border-zinc-200 bg-white p-2.5 font-mono text-[11.5px] leading-relaxed outline-none transition placeholder:text-zinc-300 focus:border-emerald-400 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
              />
              <button type="button" onClick={() => { setText(SAMPLE_CSV); setFileName('sample-register.csv') }}
                className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-600 hover:text-emerald-700">
                <CopyX className="h-3 w-3" /> Load a sample register
              </button>
            </div>
          </details>

          {/* parse verdict */}
          {rows.length > 0 && (
            <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700"><CircleCheck className="h-3.5 w-3.5" /> {validRows.length} valid</span>
                {invalidCount > 0 && <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600"><TriangleAlert className="h-3.5 w-3.5" /> {invalidCount} missing required columns</span>}
                <span className="ml-auto text-[11px] text-zinc-400">{headerMapped ? 'header row mapped automatically' : 'no header — positional mapping used'}</span>
              </div>
              {preview.length > 0 && (
                <div className="mt-2.5 overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-zinc-100 text-left text-zinc-400">
                        {['Asset ID', 'Description', 'Category', 'Location', 'Custodian'].map((h) => (
                          <th key={h} className="whitespace-nowrap px-1.5 py-1 font-semibold uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {preview.map((r, i) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap px-1.5 py-1 font-mono text-zinc-600">{r.clientAssetId}</td>
                          <td className="max-w-[180px] truncate px-1.5 py-1 text-zinc-700">{r.description}</td>
                          <td className="whitespace-nowrap px-1.5 py-1 text-zinc-600">{r.category}</td>
                          <td className="whitespace-nowrap px-1.5 py-1 text-zinc-500">{r.locationLabel ?? '—'}</td>
                          <td className="whitespace-nowrap px-1.5 py-1 text-zinc-500">{r.custodian ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validRows.length > 5 && <div className="mt-1 text-[10.5px] text-zinc-400">+ {validRows.length - 5} more rows…</div>}
                </div>
              )}
            </div>
          )}

          {/* actions */}
          <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
            <Button variant="outline" size="sm" onClick={() => { reset(); onOpenChange(false) }} disabled={busy}>Cancel</Button>
            <Button
              size="sm"
              onClick={doImport}
              disabled={busy || !effectiveClientId || validRows.length === 0}
              className="gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_4px_14px_-4px_rgba(16,185,129,0.7)] transition hover:from-emerald-600 hover:to-teal-700"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Import {validRows.length > 0 ? `${validRows.length} assets` : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
