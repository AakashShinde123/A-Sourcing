'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { v4 as uuid } from 'uuid'
import {
  ScanLine, Camera, MapPin, MapPinOff, CheckCircle2, XCircle, AlertTriangle, ArrowLeft,
  Search, PackageSearch, Plus, Loader2, RefreshCw, Clock, CameraOff, QrCode, Printer,
} from 'lucide-react'
import { useES } from '@/modules/shared/store'
import type { Asset, Assignment, QueueOp } from '@/modules/shared/types'

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
type CamState = 'idle' | 'starting' | 'live' | 'denied' | 'insecure' | 'error'

/** Real GPS stamp — resolves null (→ "GPS unavailable") on denial/timeout. */
function realGps(): Promise<{ lat: number; lng: number; acc: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: +(p.coords.accuracy || 0).toFixed(1) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 },
    )
  })
}

/** Downscale a captured photo to a compact JPEG dataURL (evidence payload stays small). */
async function shrinkPhoto(file: File): Promise<string | null> {
  try {
    const url = URL.createObjectURL(file)
    const img = new Image()
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('decode')); img.src = url })
    const max = 640
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    return canvas.toDataURL('image/jpeg', 0.55)
  } catch { return null }
}

export function ScanFlow({ onExit, online, scope }: { onExit: () => void; online: boolean; scope: Assignment | null }) {
  const { world, submitVerifications, user } = useES()
  const [tab, setTab] = useState<'scan' | 'search' | 'discovery'>('scan')
  const [stage, setStage] = useState<Stage>('viewfinder')
  const [asset, setAsset] = useState<Asset | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [remarks, setRemarks] = useState('')
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null)
  const [gpsLocating, setGpsLocating] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [savedResult, setSavedResult] = useState<string | null>(null)
  const [savedDiscovery, setSavedDiscovery] = useState<{ code: string } | null>(null)
  const [disc, setDisc] = useState({ description: '', make: '', model: '', serial: '', condition: 'good' })

  // real camera state
  const [cam, setCam] = useState<CamState>('idle')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const loopFlag = useRef<{ stop: boolean }>({ stop: true })
  const lastToast = useRef<{ text: string; at: number }>({ text: '', at: 0 })
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  // The active field scope is owned by MobileApp (scope switcher on the hero);
  // ScanFlow purely verifies within it.
  const assignment = scope
  const asgId = assignment?.id ?? null
  const myAssets = useMemo(() => (world && asgId ? world.assets.filter((a) => a.assignmentId === asgId) : []), [world, asgId])
  const verifiedIds = useMemo(() => new Set((world?.verifications ?? []).filter((v) => v.assignmentId === asgId).map((v) => v.assetId)), [world, asgId])
  const pending = useMemo(() => myAssets.filter((a) => !verifiedIds.has(a.id)), [myAssets, verifiedIds])
  // Scopes published to ME (for precise "wrong scope" hints) — empty for ops preview accounts.
  const myScopes = useMemo(
    () => (world && user?.auditorId ? world.assignments.filter((x) => x.auditorId === user.auditorId) : []),
    [world, user],
  )

  /** Resolve a scanned/typed value against the register: barcode → code → client ERP id. */
  const resolveAsset = useCallback(
    (raw: string): Asset | null => {
      const v = raw.trim().toLowerCase()
      if (!v || !world) return null
      return world.assets.find((a) => [a.barcode, a.code, a.clientAssetId].some((f) => f?.toLowerCase() === v)) ?? null
    },
    [world],
  )

  function stopCamera() {
    loopFlag.current.stop = true
    const stream = streamRef.current
    if (stream) { stream.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    if (videoRef.current) videoRef.current.srcObject = null
    setCam('idle')
  }

  /** A decoded value opened the verify card? (false → keep scanning) */
  const handleDecoded = useCallback(
    (text: string): boolean => {
      const raw = text.trim()
      if (!raw) return false
      const hit = resolveAsset(raw)
      if (hit && hit.assignmentId === asgId) {
        openAsset(hit)
        return true
      }
      const now = Date.now()
      const fresh = lastToast.current.text !== raw || now - lastToast.current.at > 4000
      if (fresh) {
        lastToast.current = { text: raw, at: now }
        if (!hit) {
          toast.error(`Tag “${raw.slice(0, 24)}” is not in the register`, { description: 'Clean the tag and rescan, or use Manual to search by name/serial.' })
        } else {
          const mineScope = myScopes.find((x) => x.id === hit.assignmentId)
          toast.warning(`${hit.code} is outside the current scope`, {
            description: mineScope ? `Switch scope on the home screen — it belongs to “${mineScope.scope}”.` : 'This asset is not linked to any field scope yet — ask ops to assign it.',
          })
        }
      }
      return false
    },
    [resolveAsset, asgId, myScopes],
  )

  function openAsset(a: Asset) {
    stopCamera()
    setAsset(a); setStage('asset'); setResult(null); setPhotos([]); setRemarks(''); setGps(null)
    setGpsLocating(true)
    realGps().then((g) => { setGps(g); setGpsLocating(false) })
  }

  // Real camera lifecycle: on while the viewfinder is visible, off otherwise.
  useEffect(() => {
    let cancelled = false
    async function start() {
      if (typeof window === 'undefined') return
      if (!window.isSecureContext) { setCam('insecure'); return }
      if (!navigator.mediaDevices?.getUserMedia) { setCam('error'); return }
      setCam('starting')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          video.muted = true
          try { await video.play() } catch { /* autoplay guard — user gesture already happened */ }
        }
        if (cancelled) return
        setCam('live')
        decodeLoop()
      } catch (e) {
        if (cancelled) return
        const name = (e as DOMException)?.name
        setCam(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
      }
    }
    async function decodeLoop() {
      const flag = { stop: false }
      loopFlag.current = flag
      const video = videoRef.current
      if (!video) return
      // Native BarcodeDetector (Chrome/Android) → zero-dep fast path; zxing everywhere else (iOS Safari).
      let detector: { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> } | null = null
      if ('BarcodeDetector' in window) {
        try {
          const BD = (window as unknown as { BarcodeDetector: new (o?: { formats?: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
          try { detector = new BD({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'itf', 'upc_a', 'upc_e'] }) }
          catch { detector = new BD() }
        } catch { detector = null }
      }
      let zxing: { decodeFromCanvas: (c: HTMLCanvasElement) => { getText: () => string } } | null = null
      if (!detector) {
        try { const ZX = await import('@zxing/library'); zxing = new ZX.BrowserMultiFormatReader() as unknown as typeof zxing }
        catch { zxing = null }
      }
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const tick = async () => {
        while (!flag.stop) {
          const v = videoRef.current
          if (!v || v.readyState < 2) { await new Promise((r) => setTimeout(r, 300)); continue }
          try {
            let text: string | null = null
            if (detector) {
              const codes = await detector.detect(v)
              if (codes.length) text = codes[0].rawValue
            } else if (zxing && ctx) {
              if (canvas.width !== v.videoWidth && v.videoWidth) { canvas.width = v.videoWidth; canvas.height = v.videoHeight }
              ctx.drawImage(v, 0, 0)
              try { text = zxing.decodeFromCanvas(canvas).getText() } catch { /* NotFoundException — no code in frame */ }
            }
            if (text && handleDecoded(text)) return
          } catch { /* keep scanning */ }
          await new Promise((r) => setTimeout(r, 350))
        }
      }
      tick()
    }
    if (tab === 'scan' && stage === 'viewfinder' && assignment) start()
    return () => { cancelled = true; stopCamera() }
  }, [tab, stage, assignment])

  useEffect(() => () => stopCamera(), []) // final unmount safety

  function reset() { setStage('viewfinder'); setAsset(null); setResult(null); setPhotos([]); setRemarks(''); setGps(null); setSavedDiscovery(null) }

  async function buildAndSave(res: string, discovery?: Partial<QueueOp['discovery']>) {
    if (!world || !assignment) return
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
        const item = r.items?.find((i) => i.operationId === op.operationId)
        if (discovery && item?.assetCode) setSavedDiscovery({ code: item.assetCode })
        toast.success(res === 'matched' ? 'Verified & synced' : discovery ? 'New asset registered' : 'Recorded & synced', {
          description: discovery
            ? `${item?.assetCode ?? 'Asset'} added to the register — print its QR tag below.`
            : res === 'matched' ? `${asset?.code} reconciled as MATCHED.` : 'Exception opened automatically.',
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

  // Manual search: fuzzy list + EXACT-match resolution with precise scope feedback.
  const exact = useMemo(() => resolveAsset(searchQ), [searchQ, resolveAsset])
  const exactInScope = !!exact && exact.assignmentId === asgId
  const exactMineScope = exact ? myScopes.find((x) => x.id === exact.assignmentId) : undefined
  const searchResults = useMemo(() => {
    const n = searchQ.trim().toLowerCase()
    if (!n) return myAssets.slice(0, 4)
    return myAssets.filter((a) => [a.code, a.description, a.serialNumber, a.custodian, a.locationLabel, a.barcode].some((f) => f?.toLowerCase().includes(n))).slice(0, 6)
  }, [myAssets, searchQ])

  async function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const data = await shrinkPhoto(file)
    if (data) setPhotos((p) => (p.length >= 3 ? p : [...p, data]))
    else toast.error('Could not read that photo — try again')
  }

  const camBadge = cam === 'live' ? 'Scanning…' : cam === 'starting' ? 'Starting camera…' : 'Camera off'

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
            <div className="flex flex-1 flex-col items-center gap-4 px-4 pt-3">
              {/* LIVE camera viewport */}
              <div className="relative h-60 w-full max-w-[300px]">
                <div className="absolute inset-0 overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-900 shadow-[0_16px_40px_-14px_rgba(6,78,59,0.5)] ring-1 ring-zinc-900/20">
                  <video ref={videoRef} playsInline muted autoPlay
                    className={cn('h-full w-full object-cover transition-opacity duration-300', cam === 'live' ? 'opacity-100' : 'opacity-0')} />
                  {cam !== 'live' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-5 text-center">
                      {cam === 'starting' && <><Loader2 className="h-7 w-7 animate-spin text-emerald-400" /><div className="text-[12px] font-medium text-zinc-300">Starting camera…</div></>}
                      {cam === 'denied' && <><CameraOff className="h-7 w-7 text-amber-400" /><div className="text-[12px] font-semibold text-zinc-200">Camera blocked</div><div className="text-[10.5px] leading-relaxed text-zinc-400">Tap the lock or ⓘ icon next to the site address → Camera → <b>Allow</b>, then reload. Or use Manual below.</div></>}
                      {cam === 'insecure' && <><CameraOff className="h-7 w-7 text-amber-400" /><div className="text-[12px] font-semibold text-zinc-200">Needs HTTPS</div><div className="text-[10.5px] leading-relaxed text-zinc-400">The camera only works on a secure connection — open the app via its <b>https://</b> link, or use Manual below.</div></>}
                      {cam === 'error' && <><AlertTriangle className="h-7 w-7 text-amber-400" /><div className="text-[12px] font-semibold text-zinc-200">Camera unavailable</div><div className="text-[10.5px] leading-relaxed text-zinc-400">No camera was found, or another app is using it. Use Manual below instead.</div></>}
                      {cam === 'idle' && <><ScanLine className="h-7 w-7 text-emerald-400/80" /><div className="text-[12px] font-medium text-zinc-300">Preparing viewfinder…</div></>}
                    </div>
                  )}
                  {/* framing brackets + scanline (live only) */}
                  {cam === 'live' && (
                    <>
                      <div className="absolute -left-1 -top-1 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-emerald-500" />
                      <div className="absolute -right-1 -top-1 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-emerald-500" />
                      <div className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-emerald-500" />
                      <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-emerald-500" />
                      <div className="absolute left-3 right-3 h-0.5 animate-[scanline_1.8s_ease-in-out_infinite] rounded bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.8)]" />
                    </>
                  )}
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300 shadow-md">
                  {cam === 'live' ? '◉ Live — point at the QR tag' : camBadge}
                </div>
              </div>

              <div className="mt-2 text-center">
                <div className="text-[13px] font-semibold text-zinc-800">Point camera at the asset QR tag</div>
                <div className="mt-1 text-[11px] text-zinc-500">Detects QR & barcodes · works offline — register is cached on device</div>
              </div>
              <div className="rounded-xl bg-white px-3.5 py-2.5 text-center shadow-sm ring-1 ring-zinc-900/[0.06]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Scope cached</div>
                <div className="text-[12px] font-semibold text-zinc-800">{assignment?.scope}</div>
                <div className="text-[11px] text-zinc-500">{verifiedIds.size}/{myAssets.length} verified · {pending.length} pending</div>
              </div>
            </div>
          )}

          {tab === 'search' && (
            <div className="flex-1 space-y-2 overflow-y-auto px-4 pt-3 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} inputMode="search" autoComplete="off"
                  placeholder="Type asset code, QR value, serial, name…"
                  className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-[13px] text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
              </div>

              {/* EXACT match — resolves what the user typed with precise feedback */}
              {exact && !exactInScope && (
                <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-500/30">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-amber-800"><AlertTriangle className="h-4 w-4" /> {exact.code} exists — but not in this scope</div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-amber-700">
                    {exactMineScope
                      ? `It belongs to “${exactMineScope.scope}”. Go to Home and switch the field scope to verify it.`
                      : <>It is registered at <b>{exact.locationLabel || 'no location'}</b> but no field scope covers it yet. Ask ops (Audits → open project → <b>Assign field team</b>) to publish a scope for <b>{exact.locationLabel || 'its location'}</b>.</>}
                  </p>
                </div>
              )}
              {exact && exactInScope && (
                <button onClick={() => openAsset(exact)}
                  className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-3.5 text-left text-white shadow-[0_10px_28px_-8px_rgba(13,148,136,0.7)] transition active:scale-[0.99]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15"><ScanLine className="h-4.5 w-4.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold">Verify {exact.code} now</span>
                    <span className="block truncate text-[11px] text-white/85">{exact.description}</span>
                  </span>
                  <XCircle className="h-4 w-4 rotate-45 opacity-70" />
                </button>
              )}

              {myAssets.length === 0 && (
                <div className="rounded-xl bg-white p-3.5 text-center ring-1 ring-zinc-900/[0.06]">
                  <div className="text-[12px] font-bold text-zinc-800">No assets are linked to this scope yet</div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">Ops links assets automatically when a field scope is published. Ask your ops team to assign this location to you.</p>
                </div>
              )}

              {searchResults.map((a) => (
                <button key={a.id} onClick={() => openAsset(a)}
                  className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-zinc-900/[0.06] transition hover:ring-emerald-500/50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-zinc-900">{a.description}</div>
                    <div className="font-mono text-[10px] text-zinc-500">{a.code} · {a.serialNumber}</div>
                  </div>
                  <div className="text-right text-[10px] text-zinc-500">{a.locationLabel}</div>
                </button>
              ))}
              {searchQ.trim() && !exact && searchResults.length === 0 && myAssets.length > 0 && (
                <div className="rounded-xl bg-white p-3.5 text-center ring-1 ring-zinc-900/[0.06]">
                  <div className="text-[12px] font-semibold text-zinc-700">No asset matches “{searchQ.trim().slice(0, 24)}” in this scope</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Check the tag value, or use Discovery if the asset is missing from the register.</p>
                </div>
              )}
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
              <span className="rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                {tab === 'scan' ? 'QR MATCH' : 'MANUAL MATCH'}
              </span>
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
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ring-1',
              gpsLocating ? 'bg-sky-50 text-sky-700 ring-sky-500/25' : gps ? 'bg-emerald-50 text-emerald-700 ring-emerald-500/25' : 'bg-white text-zinc-500 ring-zinc-200')}>
              {gpsLocating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : gps ? <MapPin className="h-3.5 w-3.5" /> : <MapPinOff className="h-3.5 w-3.5" />}
              {gpsLocating ? 'Locating…' : gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)} ±${gps.acc}m` : 'GPS unavailable'}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotoPicked} />
            <button onClick={() => photoInputRef.current?.click()} disabled={photos.length >= 3}
              className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 ring-1 ring-zinc-200 active:scale-95 disabled:opacity-50">
              <Camera className="h-3.5 w-3.5" /> Photo {photos.length ? `(${photos.length}/3)` : ''}
            </button>
            {photos.map((p, i) => (
              <img key={i} src={p} alt={`Evidence ${i + 1}`} className="h-9 w-9 rounded-md object-cover ring-1 ring-zinc-300" />
            ))}
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
        <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-8 py-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 ring-1 ring-emerald-500/30">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </span>
          <div>
            <div className="font-display text-[15px] font-bold text-zinc-900">{online ? 'Synced to server' : 'Queued on device'}</div>
            <div className="mt-1 text-[12px] leading-relaxed text-zinc-600">
              {savedDiscovery
                ? 'New asset added to the register — tag it so it scans next time.'
                : `${asset?.code ?? 'Discovery'} recorded${savedResult && savedResult !== 'matched' ? ' — exception opened for the ops team' : ' as matched'}. Operation ID keeps sync idempotent.`}
            </div>
          </div>

          {savedDiscovery && (
            <div className="w-full rounded-2xl bg-white p-4 shadow-[0_10px_30px_-12px_rgba(6,78,59,0.25)] ring-1 ring-emerald-500/40">
              <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                <QrCode className="h-3.5 w-3.5" /> New asset code
              </div>
              <div className="mt-1 font-mono text-[18px] font-bold tracking-wide text-zinc-900">{savedDiscovery.code}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                Saved to the central register{online ? '' : ' after sync'} · visible to Ops &amp; Client instantly.
              </p>
              {online && (
                <button
                  onClick={() => window.open(`/api/core/assets/labels?codes=${encodeURIComponent(savedDiscovery.code)}`, '_blank')}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_22px_-8px_rgba(13,148,136,0.7)] active:scale-[0.98]">
                  <Printer className="h-4 w-4" /> Print QR tag
                </button>
              )}
              {!online && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[10.5px] leading-relaxed text-amber-700 ring-1 ring-amber-500/25">
                  Offline — the ES code and QR tag are issued the moment this discovery syncs.
                </p>
              )}
            </div>
          )}

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
