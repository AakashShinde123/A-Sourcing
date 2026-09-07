'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { v4 as uuid } from 'uuid'
import {
  ScanLine, Camera, MapPin, MapPinOff, CheckCircle2, XCircle, AlertTriangle, ArrowLeft,
  Search, PackageSearch, Plus, Loader2, RefreshCw, Clock, FileText,
} from 'lucide-react'
import { useES } from '@/modules/shared/store'
import type { Asset, QueueOp } from '@/modules/shared/types'

export type ScanIntent = { type: 'scan' } | { type: 'search' } | { type: 'discovery' }

const RESULTS = [
  { key: 'matched', label: 'Verified', sub: 'Asset matches register', tone: 'bg-emerald-500', ring: 'ring-emerald-200' },
  { key: 'location_mismatch', label: 'Location mismatch', sub: 'Found elsewhere', tone: 'bg-amber-500', ring: 'ring-amber-200' },
  { key: 'custodian_mismatch', label: 'Custodian mismatch', sub: 'Wrong custodian', tone: 'bg-orange-500', ring: 'ring-orange-200' },
  { key: 'serial_mismatch', label: 'Serial mismatch', sub: 'Serial differs', tone: 'bg-rose-500', ring: 'ring-rose-200' },
  { key: 'condition_exception', label: 'Condition issue', sub: 'Damaged / worn', tone: 'bg-zinc-600', ring: 'ring-zinc-300' },
  { key: 'missing', label: 'Not found', sub: 'Missing in area', tone: 'bg-red-600', ring: 'ring-red-200' },
] as const

type Stage = 'viewfinder' | 'asset' | 'saving' | 'done'

function captureGps() {
  const lat = 18.5204 + (Math.random() - 0.5) * 0.002
  const lng = 73.8567 + (Math.random() - 0.5) * 0.002
  return { lat, lng, acc: +(2.5 + Math.random() * 5).toFixed(1) }
}

export function ScanFlow({ onExit, online }: { onExit: () => void; online: boolean }) {
  const { world, submitVerifications, user } = useES()
  const [tab, setTab] = useState<'scan' | 'search' | 'discovery'>('scan')
  const [stage, setStage] = useState<Stage>('viewfinder')
  const [asset, setAsset] = useState<Asset | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [remarks, setRemarks] = useState('')
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [savedResult, setSavedResult] = useState<string | null>(null)
  const [disc, setDisc] = useState({ description: '', make: '', model: '', serial: '', condition: 'good' })
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Session-scoped assignment: the signed-in field user's first assignment;
  // admin/ops demo sessions fall back to the seeded asg_1.
  const assignment = useMemo(
    () => world?.assignments.find((a) => a.auditorId === (user?.auditorId ?? 'adr_1')) ?? world?.assignments.find((a) => a.id === 'asg_1') ?? null,
    [world, user],
  )
  const asgId = assignment?.id ?? 'asg_1'
  const myAssets = useMemo(() => (world ? world.assets.filter((a) => a.assignmentId === asgId) : []), [world, asgId])
  const verifiedIds = useMemo(() => new Set((world?.verifications ?? []).filter((v) => v.assignmentId === asgId).map((v) => v.assetId)), [world, asgId])
  const pending = useMemo(() => myAssets.filter((a) => !verifiedIds.has(a.id)), [myAssets, verifiedIds])

  // fake camera lock-on
  useEffect(() => {
    if (tab === 'scan' && stage === 'viewfinder') {
      scanTimer.current = setTimeout(() => {
        const target = pending[0] ?? null
        if (!target) { toast.info('All assets in this scope are verified', { description: 'Try Floor-to-Sheet discovery instead.' }); return }
        setAsset(target); setStage('asset'); setGps(captureGps()); setResult(null); setPhotos([]); setRemarks('')
      }, 1900)
      return () => { if (scanTimer.current) clearTimeout(scanTimer.current) }
    }
  }, [tab, stage, pending])

  function reset() { setStage('viewfinder'); setAsset(null); setResult(null); setPhotos([]); setRemarks('') }

  async function buildAndSave(res: string, discovery?: Partial<QueueOp['discovery']>) {
    if (!world) return
    setStage('saving')
    setSavedResult(res)
    const op: QueueOp = {
      operationId: `op-${uuid()}`,
      auditId: assignment?.auditId ?? world.audits[0].id,
      assignmentId: assignment?.id ?? null,
      auditorId: user?.auditorId ?? 'adr_1',
      assetId: discovery ? null : asset?.id,
      result: res,
      method: tab === 'scan' ? 'scan' : tab === 'search' ? 'search' : 'discovery',
      gpsLat: gps?.lat ?? null, gpsLng: gps?.lng ?? null, gpsAccuracy: gps?.acc ?? null,
      gpsStatus: gps ? 'captured' : 'unavailable',
      remarks: remarks || null,
      photos,
      createdOffline: !online,
      verifiedAt: new Date().toISOString(),
      discovery: discovery as QueueOp['discovery'],
      label: discovery ? discovery.description ?? 'Discovery' : `${asset?.code} — ${RESULTS.find((r) => r.key === res)?.label ?? res}`,
      queuedAt: new Date().toISOString(),
    }
    if (online) {
      try {
        const r = await submitVerifications([op])
        toast.success(res === 'matched' ? 'Verified & synced' : 'Recorded & synced', {
          description: res === 'matched' ? `${asset?.code} reconciled as MATCHED.` : 'Exception opened automatically.',
          icon: <RefreshCw className="h-4 w-4" />,
        })
        if (r.skipped > 0) toast.info(`${r.skipped} duplicate operation(s) skipped — sync is idempotent`)
      } catch { /* toast handled in store */ }
    } else {
      window.dispatchEvent(new CustomEvent('es-queue-add', { detail: op }))
      toast('Queued offline', { description: 'Stored on device — will sync when connectivity returns.', icon: <Clock className="h-4 w-4" /> })
    }
    setStage('done')
  }

  const searchResults = useMemo(() => {
    const n = searchQ.trim().toLowerCase()
    if (!n) return myAssets.slice(0, 4)
    return myAssets.filter((a) => [a.code, a.description, a.serialNumber, a.custodian, a.locationLabel, a.barcode].some((f) => f?.toLowerCase().includes(n))).slice(0, 6)
  }, [myAssets, searchQ])

  return (
    <div className="flex h-full flex-col bg-[#f4f7f3] text-zinc-900">
      {/* header */}
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <button onClick={() => { if (stage === 'viewfinder') { onExit() } else { reset() } }} className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-700">
          <ArrowLeft className="h-4 w-4" /> {stage === 'viewfinder' ? 'Home' : 'Scan'}
        </button>
        <div className="text-[12px] font-bold uppercase tracking-widest text-emerald-700">
          {stage === 'viewfinder' ? 'Scan Asset' : stage === 'done' ? 'Done' : 'Verify'}
        </div>
        <div className="w-10" />
      </div>

      {stage === 'viewfinder' && (
        <>
          <div className="flex gap-1 px-4">
            {([['scan', 'QR Scan', <ScanLine key="1" className="h-3 w-3" />], ['search', 'Manual', <Search key="2" className="h-3 w-3" />], ['discovery', 'Discovery', <PackageSearch key="3" className="h-3 w-3" />]] as const).map(([k, label, icon]) => (
              <button key={k} onClick={() => setTab(k)}
                className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold transition',
                  tab === k ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_4px_14px_-4px_rgba(16,185,129,0.7)]' : 'bg-white text-zinc-500 ring-1 ring-zinc-900/[0.06]')}>
                {icon}{label}
              </button>
            ))}
          </div>

          {tab === 'scan' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
              {/* camera viewport — intentionally dark, like every real camera app */}
              <div className="relative h-52 w-52">
                <div className="absolute inset-0 overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-900 shadow-[0_16px_40px_-14px_rgba(6,78,59,0.5)] ring-1 ring-zinc-900/20">
                  <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.25) 1px, transparent 1px)', backgroundSize: '26px 26px' }} />
                </div>
                <div className="absolute -left-1 -top-1 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-emerald-500" />
                <div className="absolute -right-1 -top-1 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-emerald-500" />
                <div className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-emerald-500" />
                <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-emerald-500" />
                <div className="absolute left-3 right-3 h-0.5 animate-[scanline_1.8s_ease-in-out_infinite] rounded bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.8)]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ScanLine className="h-10 w-10 text-emerald-400/80" />
                </div>
              </div>
              <div className="text-center">
                <div className="text-[13px] font-semibold text-zinc-800">Point camera at the asset QR tag</div>
                <div className="mt-1 text-[11px] text-zinc-500">Works offline — asset data is cached on device</div>
              </div>
              <div className="rounded-xl bg-white px-3.5 py-2.5 text-center shadow-sm ring-1 ring-zinc-900/[0.06]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Scope cached</div>
                <div className="text-[12px] font-semibold text-zinc-800">{assignment?.scope}</div>
                <div className="text-[11px] text-zinc-500">{verifiedIds.size}/{myAssets.length} verified · {pending.length} pending</div>
              </div>
            </div>
          )}

          {tab === 'search' && (
            <div className="flex-1 space-y-2 overflow-y-auto px-4 pt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Asset ID, serial, description, custodian…"
                  className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-[13px] text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
              </div>
              {searchResults.map((a) => (
                <button key={a.id} onClick={() => { setAsset(a); setStage('asset'); setGps(captureGps()) }}
                  className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-zinc-900/[0.06] transition hover:ring-emerald-500/50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-zinc-900">{a.description}</div>
                    <div className="font-mono text-[10px] text-zinc-500">{a.code} · {a.serialNumber}</div>
                  </div>
                  <div className="text-right text-[10px] text-zinc-500">{a.locationLabel}</div>
                </button>
              ))}
            </div>
          )}

          {tab === 'discovery' && (
            <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pt-3 pb-4">
              <div className="rounded-xl bg-teal-50 p-3 text-[11px] leading-relaxed text-teal-800 ring-1 ring-teal-500/25">
                <strong className="font-bold">Floor-to-Sheet discovery.</strong> Found a physical asset that is not in the register? Capture it here — an Unregistered exception is created for reconciliation.
              </div>
              {([['description', 'Description *', 'e.g. Bosch GWS 900 Angle Grinder'], ['make', 'Make', 'e.g. Bosch'], ['model', 'Model', 'e.g. GWS 900'], ['serial', 'Serial number', 'Nameplate serial']] as const).map(([k, label, ph]) => (
                <div key={k}>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-600">{label}</label>
                  <input value={disc[k]} onChange={(e) => setDisc((d) => ({ ...d, [k]: e.target.value }))} placeholder={ph}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-emerald-500" />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-600">Condition</label>
                <div className="flex gap-1.5">
                  {['excellent', 'good', 'fair', 'poor'].map((c) => (
                    <button key={c} onClick={() => setDisc((d) => ({ ...d, condition: c }))}
                      className={cn('flex-1 rounded-lg py-2 text-[11px] font-semibold capitalize transition', disc.condition === c ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm' : 'bg-white text-zinc-500 ring-1 ring-zinc-200')}>{c}</button>
                  ))}
                </div>
              </div>
              <button
                disabled={!disc.description.trim()}
                onClick={() => buildAndSave('unregistered', { description: disc.description, make: disc.make, model: disc.model, serial: disc.serial, condition: disc.condition, locationLabel: assignment?.scope })}
                className={cn('mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold transition',
                  disc.description.trim() ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-[0_8px_24px_-8px_rgba(13,148,136,0.7)] active:scale-[0.98]' : 'bg-zinc-200 text-zinc-400')}>
                <Plus className="h-4 w-4" /> Register discovery
              </button>
            </div>
          )}
        </>
      )}

      {stage === 'asset' && asset && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-1">
          {/* expected data */}
          <div className="rounded-2xl bg-white p-4 shadow-[0_10px_30px_-12px_rgba(6,78,59,0.25)] ring-1 ring-emerald-500/40">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-2 py-0.5 font-mono text-[10px] font-bold text-white">QR MATCH</span>
              <span className="font-mono text-[11px] font-semibold text-zinc-500">{asset.code}</span>
            </div>
            <div className="mt-2 text-[15px] font-bold leading-snug text-zinc-900">{asset.description}</div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
              <div><span className="text-zinc-400">Expected at</span><div className="font-semibold text-zinc-700">{asset.locationLabel}</div></div>
              <div><span className="text-zinc-400">Custodian</span><div className="font-semibold text-zinc-700">{asset.custodian}</div></div>
              <div><span className="text-zinc-400">Serial</span><div className="font-mono font-semibold text-zinc-700">{asset.serialNumber}</div></div>
              <div><span className="text-zinc-400">Category</span><div className="font-semibold text-zinc-700">{asset.category}</div></div>
            </div>
          </div>

          {/* evidence chips */}
          <div className="mt-3 flex items-center gap-2">
            <div className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ring-1', gps ? 'bg-emerald-50 text-emerald-700 ring-emerald-500/25' : 'bg-white text-zinc-500 ring-zinc-200')}>
              {gps ? <MapPin className="h-3.5 w-3.5" /> : <MapPinOff className="h-3.5 w-3.5" />}
              {gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)} ±${gps.acc}m` : 'GPS unavailable'}
            </div>
            <button onClick={() => setPhotos((p) => (p.length >= 3 ? p : [...p, ['emerald', 'teal', 'amber'][p.length]]))}
              className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 ring-1 ring-zinc-200 active:scale-95">
              <Camera className="h-3.5 w-3.5" /> Photo {photos.length ? `(${photos.length})` : ''}
            </button>
            {photos.map((p, i) => <span key={i} className={cn('h-6 w-6 rounded-md bg-gradient-to-br shadow-sm', p === 'emerald' ? 'from-emerald-400 to-teal-600' : p === 'teal' ? 'from-teal-400 to-cyan-600' : 'from-amber-400 to-orange-500')} />)}
          </div>

          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks (optional)"
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] shadow-sm outline-none placeholder:text-zinc-400 focus:border-emerald-500" />

          {/* result choice */}
          <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Verification result</div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {RESULTS.map((r) => (
              <button key={r.key} onClick={() => setResult(r.key)}
                className={cn('rounded-xl p-2.5 text-left ring-1 transition',
                  result === r.key ? `${r.tone} text-white ring-transparent shadow-md` : 'bg-white ring-zinc-200 hover:ring-zinc-400')}>
                <div className="text-[12px] font-bold leading-tight">{r.label}</div>
                <div className={cn('text-[10px]', result === r.key ? 'text-white/85' : 'text-zinc-500')}>{r.sub}</div>
              </button>
            ))}
          </div>

          <button
            disabled={!result || stage === 'saving'}
            onClick={() => buildAndSave(result!)}
            className={cn('mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold transition active:scale-[0.98]',
              result ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-[0_10px_28px_-8px_rgba(13,148,136,0.7)]' : 'bg-zinc-200 text-zinc-400')}>
            {stage === 'saving' ? <><Loader2 className="h-4 w-4 animate-spin" /> {online ? 'Syncing…' : 'Queueing…'}</> : <><CheckCircle2 className="h-4 w-4" /> Save verification</>}
          </button>
          {!online && <div className="mt-1.5 text-center text-[10px] text-zinc-500">Offline — saved to encrypted local queue</div>}
        </div>
      )}

      {stage === 'done' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 ring-1 ring-emerald-500/30">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </span>
          <div>
            <div className="font-display text-[15px] font-bold text-zinc-900">{online ? 'Synced to server' : 'Queued on device'}</div>
            <div className="mt-1 text-[12px] leading-relaxed text-zinc-600">
              {asset?.code ?? 'Discovery'} recorded{savedResult && savedResult !== 'matched' ? ' — exception opened for the ops team' : ' as matched'}. Operation ID keeps sync idempotent.
            </div>
          </div>
          <div className="flex w-full flex-col gap-2">
            <button onClick={reset} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 py-3 text-[14px] font-bold text-white shadow-[0_10px_28px_-8px_rgba(13,148,136,0.7)] active:scale-[0.98]">
              <ScanLine className="h-4 w-4" /> Verify next asset
            </button>
            <button onClick={onExit} className="rounded-xl bg-white py-2.5 text-[13px] font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50">Back to home</button>
          </div>
        </div>
      )}
    </div>
  )
}
