'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { World, QueueOp } from '@/modules/shared/types'

// All module→service traffic goes through the Core API base — the single
// integration point that makes standalone modules connected.
export const API_BASE = '/api/core'

export type Surface = 'landing' | 'architecture' | 'ops' | 'client' | 'mobile'
export type OpsView = 'overview' | 'clients' | 'locations' | 'audits' | 'assets' | 'exceptions' | 'evidence' | 'reports' | 'analytics' | 'team' | 'logs'
export type ClientView = 'dashboard' | 'audits' | 'assets' | 'exceptions' | 'evidence' | 'reports' | 'approvals'

interface Asset360Target { assetId: string }
interface Store {
  world: World | null
  loading: boolean
  surface: Surface
  setSurface: (s: Surface) => void
  opsView: OpsView
  setOpsView: (v: OpsView) => void
  clientView: ClientView
  setClientView: (v: ClientView) => void
  clientIdentityId: string
  setClientIdentityId: (id: string) => void
  asset360: Asset360Target | null
  openAsset360: (assetId: string) => void
  closeAsset360: () => void
  selectedAuditId: string | null
  openAudit: (id: string) => void
  refresh: () => Promise<void>
  submitVerifications: (ops: QueueOp[]) => Promise<{ applied: number; skipped: number }>
  patchException: (id: string, action: string, note?: string) => Promise<void>
  submitApproval: (auditId: string, decision: string, byName: string, byRole: string, comment?: string) => Promise<void>
  generateReport: (auditId: string) => Promise<void>
  finalizeReport: (auditId: string) => Promise<void>
}

const Ctx = createContext<Store | null>(null)

export function useES() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useES outside provider')
  return s
}

export function ESProvider({ children }: { children: React.ReactNode }) {
  const [world, setWorld] = useState<World | null>(null)
  const [loading, setLoading] = useState(true)
  const [surface, setSurface] = useState<Surface>('landing')
  const [opsView, setOpsView] = useState<OpsView>('overview')
  const [clientView, setClientView] = useState<ClientView>('dashboard')
  const [clientIdentityId, setClientIdentityId] = useState('cl_mrd')
  const [asset360, setAsset360] = useState<Asset360Target | null>(null)
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null)
  const inflight = useRef(false)

  const refresh = useCallback(async () => {
    if (inflight.current) return
    inflight.current = true
    try {
      const res = await fetch(`${API_BASE}/bootstrap`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`bootstrap ${res.status}`)
      setWorld(await res.json())
    } catch (e) {
      console.error(e)
      toast.error('Could not load platform data')
    } finally {
      inflight.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const submitVerifications = useCallback(async (ops: QueueOp[]) => {
    if (!ops.length) return { applied: 0, skipped: 0 }
    const res = await fetch(`${API_BASE}/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations: ops.map(({ label: _label, queuedAt: _q, ...op }) => op) }),
    })
    if (!res.ok) { toast.error('Sync failed — operations kept in queue'); throw new Error('sync failed') }
    const data = await res.json() as { applied: number; skipped: number }
    await refresh()
    return data
  }, [refresh])

  const patchException = useCallback(async (id: string, action: string, note?: string) => {
    const res = await fetch(`${API_BASE}/exceptions`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, note }),
    })
    if (!res.ok) { toast.error('Update failed'); return }
    await refresh()
  }, [refresh])

  const submitApproval = useCallback(async (auditId: string, decision: string, byName: string, byRole: string, comment?: string) => {
    const res = await fetch(`${API_BASE}/approvals`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditId, decision, byName, byRole, comment }),
    })
    if (!res.ok) { toast.error('Approval failed'); return }
    await refresh()
  }, [refresh])

  const generateReport = useCallback(async (auditId: string) => {
    const res = await fetch(`${API_BASE}/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auditId, action: 'generate' }) })
    if (!res.ok) { toast.error('Report generation failed'); return }
    await refresh()
  }, [refresh])

  const finalizeReport = useCallback(async (auditId: string) => {
    const res = await fetch(`${API_BASE}/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auditId, action: 'finalize' }) })
    if (!res.ok) { toast.error('Finalization failed'); return }
    await refresh()
  }, [refresh])

  const openAudit = useCallback((id: string) => { setSelectedAuditId(id) }, [])

  const value = useMemo<Store>(() => ({
    world, loading, surface, setSurface, opsView, setOpsView, clientView, setClientView,
    clientIdentityId, setClientIdentityId,
    asset360, openAsset360: (assetId) => setAsset360({ assetId }), closeAsset360: () => setAsset360(null),
    selectedAuditId, openAudit, refresh, submitVerifications, patchException, submitApproval, generateReport, finalizeReport,
  }), [world, loading, surface, opsView, clientView, clientIdentityId, asset360, selectedAuditId, refresh, submitVerifications, patchException, submitApproval, generateReport, finalizeReport])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
