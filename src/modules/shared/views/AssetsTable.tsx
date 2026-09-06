'use client'

import React, { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, ChevronLeft, ChevronRight, Download, QrCode } from 'lucide-react'
import { toast } from 'sonner'
import { useES } from '@/modules/shared/store'
import { Pill, SimpleBadge, EmptyState, MicroLabel } from '@/modules/shared/ui-bits'
import { assetStatusMeta, conditionMeta, fmtDateShort, fmtMoneyShort } from '@/modules/shared/format'
import type { Asset } from '@/modules/shared/types'

const PAGE = 12

export function AssetsTable({ clientIdScope, title = 'Asset Register', sub }: { clientIdScope?: string; title?: string; sub?: string }) {
  const { world, openAsset360 } = useES()
  const [q, setQ] = useState('')
  const [clientF, setClientF] = useState('all')
  const [catF, setCatF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [page, setPage] = useState(0)

  const assets = useMemo(
    () => (clientIdScope ? world!.assets.filter((a) => a.clientId === clientIdScope) : world!.assets),
    [world, clientIdScope],
  )
  const categories = useMemo(() => Array.from(new Set(assets.map((a) => a.category))).sort(), [assets])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return assets.filter((a) => {
      if (clientF !== 'all' && a.clientId !== clientF) return false
      if (catF !== 'all' && a.category !== catF) return false
      if (statusF !== 'all' && a.status !== statusF) return false
      if (!needle) return true
      return [a.code, a.clientAssetId, a.description, a.serialNumber, a.make, a.model, a.custodian, a.locationLabel, a.qrCode]
        .some((f) => f?.toLowerCase().includes(needle))
    })
  }, [assets, q, clientF, catF, statusF])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const view = filtered.slice(page * PAGE, (page + 1) * PAGE)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">{title}</h1>
          <p className="text-[13px] text-zinc-500">{sub ?? `${filtered.length} of ${assets.length} assets · click any row for Asset 360`}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.success('Export queued', { description: 'XLSX export will download when ready (background job).' })}>
          <Download className="h-3.5 w-3.5" /> Export XLSX
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Search ID, serial, make, custodian, location…" className="h-9 border-zinc-200 bg-white pl-8 text-[13px]" />
        </div>
        {!clientIdScope && (
          <Select value={clientF} onValueChange={(v) => { setClientF(v); setPage(0) }}>
            <SelectTrigger className="h-9 w-[170px] border-zinc-200 bg-white text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>{world!.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}<SelectItem value="all">All clients</SelectItem></SelectContent>
          </Select>
        )}
        <Select value={catF} onValueChange={(v) => { setCatF(v); setPage(0) }}>
          <SelectTrigger className="h-9 w-[160px] border-zinc-200 bg-white text-[13px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusF} onValueChange={(v) => { setStatusF(v); setPage(0) }}>
          <SelectTrigger className="h-9 w-[150px] border-zinc-200 bg-white text-[13px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(assetStatusMeta).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table (tablet and up) */}
      <div className="hidden overflow-hidden card md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/70 text-left">
                {['Asset', 'Category', 'Location', 'Custodian', 'Status', 'Condition', 'Value', 'Last verified'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {view.map((a) => (
                <tr key={a.id} onClick={() => openAsset360(a.id)} className="cursor-pointer transition hover:bg-emerald-50/30">
                  <td className="max-w-[280px] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100"><QrCode className="h-3.5 w-3.5 text-zinc-500" /></span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-zinc-800">{a.description}</div>
                        <div className="font-mono text-[11px] text-zinc-400">{a.code} · {a.serialNumber}</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-zinc-600">{a.category}</td>
                  <td className="max-w-[190px] px-3 py-2.5"><div className="truncate text-zinc-600" title={a.locationPath}>{a.locationLabel}</div></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-zinc-600">{a.custodian ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5"><Pill meta={assetStatusMeta[a.status] ?? assetStatusMeta.registered} size="xs" /></td>
                  <td className="whitespace-nowrap px-3 py-2.5">{a.condition ? <SimpleBadge label={conditionMeta[a.condition]?.label ?? a.condition} cls={conditionMeta[a.condition]?.cls ?? ''} /> : '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-zinc-700">{fmtMoneyShort(a.currentValue)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-zinc-500">{a.lastVerifiedAt ? fmtDateShort(a.lastVerifiedAt) : <span className="text-zinc-300">never</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Card list (phones) — same data, no horizontal scrolling */}
      <div className="space-y-2 md:hidden">
        {view.map((a) => (
          <button key={a.id} onClick={() => openAsset360(a.id)}
            className="w-full card p-3.5 text-left card-hover transition active:bg-emerald-50/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-zinc-900">{a.description}</div>
                <div className="truncate font-mono text-[11px] text-zinc-400">{a.code} · {a.serialNumber}</div>
              </div>
              <Pill meta={assetStatusMeta[a.status] ?? assetStatusMeta.registered} size="xs" />
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
              <div className="truncate text-zinc-400">Location <span className="font-medium text-zinc-700">{a.locationLabel}</span></div>
              <div className="truncate text-zinc-400">Custodian <span className="font-medium text-zinc-700">{a.custodian ?? '—'}</span></div>
              <div className="text-zinc-400">Value <span className="font-medium tabular-nums text-zinc-700">{fmtMoneyShort(a.currentValue)}</span></div>
              <div className="text-zinc-400">Verified <span className="font-medium text-zinc-700">{a.lastVerifiedAt ? fmtDateShort(a.lastVerifiedAt) : 'never'}</span></div>
            </div>
          </button>
        ))}
      </div>

      {view.length === 0 && <div className="card p-6"><EmptyState title="No assets match your filters" sub="Try clearing the search or picking a different category." /></div>}
      {/* Pagination — shared by table and cards */}
      {filtered.length > PAGE && (
        <div className="flex items-center justify-between card px-3 py-2">
          <MicroLabel>Page {page + 1} of {pages}</MicroLabel>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-9 w-9" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  )
}
