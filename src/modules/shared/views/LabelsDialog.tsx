'use client'

import React, { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { QrCode, Printer, Loader2 } from 'lucide-react'

/**
 * Ops-only helper: pick which assets get QR labels, then open the printable
 * A4 sheet from GET /api/core/assets/labels?ids=… (browser Print → Save as PDF).
 */
export function LabelsDialog({ open, onOpenChange, assets }: { open: boolean; onOpenChange: (v: boolean) => void; assets: { id: string; code: string; description: string; barcode: string | null }[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [opening, setOpening] = useState(false)

  const key = useMemo(() => assets.map((a) => a.id).join('|'), [assets])
  const [syncedKey, setSyncedKey] = useState('')
  if (open && syncedKey !== key) {
    // default: everything currently filtered is selected
    setSyncedKey(key)
    setSelected(new Set(assets.map((a) => a.id)))
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  function openSheet() {
    if (selected.size === 0) return
    setOpening(true)
    window.open(`/api/core/assets/labels?ids=${[...selected].join(',')}`, '_blank')
    setTimeout(() => setOpening(false), 800)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-zinc-100 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px]"><QrCode className="h-4 w-4 text-emerald-600" /> Print QR labels</DialogTitle>
          <DialogDescription>
            Print tags, stick them on the assets, and the field app&apos;s scanner will resolve them. {selected.size} of {assets.length} selected.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between px-5 pt-3">
          <Button variant="outline" size="sm" className="h-8" onClick={() => setSelected(selected.size === assets.length ? new Set() : new Set(assets.map((a) => a.id)))}>
            {selected.size === assets.length ? 'Clear all' : 'Select all'}
          </Button>
          <span className="text-[11.5px] text-zinc-500">~21 labels fit on one A4 sheet</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <div className="space-y-1.5">
            {assets.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-100 bg-white p-2.5 transition hover:border-emerald-300">
                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="h-4 w-4 accent-emerald-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-zinc-800">{a.description}</span>
                  <span className="block truncate font-mono text-[10.5px] text-zinc-400">{a.code} · {a.barcode ?? 'no tag value — QR will use the ES code'}</span>
                </span>
              </label>
            ))}
            {assets.length === 0 && <p className="py-6 text-center text-[13px] text-zinc-500">No assets match the current filters.</p>}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3.5">
          <p className="text-[11px] leading-snug text-zinc-500">The sheet opens in a new tab — use <b>Print → Save as PDF</b> or send it straight to a label printer.</p>
          <Button size="sm" disabled={selected.size === 0 || opening} onClick={openSheet} className="gap-1.5 whitespace-nowrap">
            {opening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            Open sheet ({selected.size})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
