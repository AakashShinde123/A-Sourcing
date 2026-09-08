'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { World, QueueOp } from '@/modules/shared/types'

// All module→service traffic goes through the Core API base — the single
// integration point that makes standalone modules connected.
export const API_BASE = '/api/core'

export type Surface = 'landing' | 'architecture' | 'planner' | 'ops' | 'client' | 'mobile'
export type OpsView = 'overview' | 'clients' | 'locations' | 'audits' | 'assets' | 'exceptions' | 'evidence' | 'reports' | 'analytics' | 'team' | 'access' | 'logs'
export type ClientView = 'dashboard' | 'audits' | 'assets' | 'exceptions' | 'evidence' | 'reports' | 'approvals'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'OPS' | 'CLIENT' | 'AUDITOR'
  clientId?: string | null
  clientName?: string | null
  auditorId?: string | null
}

/** Surfaces a role may open — the platform is team-only and role-scoped. */
export function surfacesForRole(role: AuthUser['role']): Surface[] {
  if (role === 'CLIENT') return ['client']
  if (role === 'AUDITOR') return ['mobile']
  return ['landing', 'architecture', 'planner', 'ops', 'client', 'mobile']
}

export function homeSurfaceForRole(role: AuthUser['role']): Surface {
  if (role === 'CLIENT') return 'client'
  if (role === 'AUDITOR') return 'mobile'
  return 'landing'
}

interface Asset360Target { assetId: string }
interface Store {
  user: AuthUser | null
  authLoading: boolean
  login: (email: string, password: string, remember: boolean) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
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
  importAssets: (clientId: string, rows: Record<string, unknown>[]) => Promise<{ imported: number; skipped: number; rejected: number } | null>
  createAudit: (data: { clientId: string; name: string; type: string; financialYear?: string; startDate?: string; endDate?: string; locationsLabel?: string }) => Promise<string | null>
  assignAuditor: (auditId: string, auditorId: string, locationId: string | null, scope: string) => Promise<number | null>
  unassignAssignment: (auditId: string, assignmentId: string) => Promise<boolean>
  advanceAudit: (auditId: string) => Promise<boolean>
  addAuditor: (data: { name: string; email: string; phone?: string; city?: string }) => Promise<boolean>
  setAuditorStatus: (id: string, status: string) => Promise<boolean>
  removeAuditor: (id: string) => Promise<boolean>
  addClient: (data: { name: string; industry: string; city: string; contact: string; email: string; phone?: string }) => Promise<boolean>
  setClientStatus: (id: string, status: string) => Promise<boolean>
  removeClient: (id: string) => Promise<boolean>
}

/** Pull the server's human-readable error out of a non-2xx JSON response. */
async function apiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json() as { error?: string }
    return body?.error ?? fallback
  } catch {
    return fallback
  }
}

const Ctx = createContext<Store | null>(null)

export function useES() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useES outside provider')
  return s
}

export function ESProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
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
      if (res.status === 401) { setUser(null); setWorld(null); return }
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

  // Session probe first — data loading only starts once we know who is asking.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        if (!res.ok) throw new Error('not signed in')
        const data = await res.json() as { user: AuthUser }
        if (cancelled) return
        setUser(data.user)
        if (data.user.role === 'CLIENT' && data.user.clientId) setClientIdentityId(data.user.clientId)
        setSurface(homeSurfaceForRole(data.user.role))
        await refresh()
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setAuthLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [refresh])

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember }),
      })
      const data = await res.json().catch(() => ({})) as { user?: AuthUser; error?: string }
      if (!res.ok || !data.user) return { ok: false, error: data.error ?? `Sign-in failed (${res.status})` }
      setUser(data.user)
      if (data.user.role === 'CLIENT' && data.user.clientId) setClientIdentityId(data.user.clientId)
      setOpsView('overview')
      setSurface(homeSurfaceForRole(data.user.role))
      await refresh()
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error — is the Core API reachable?' }
    }
  }, [refresh])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    setUser(null)
    setWorld(null)
    setSurface('landing')
    setOpsView('overview')
    setClientView('dashboard')
    setClientIdentityId('cl_mrd')
    toast.success('Signed out')
  }, [])

  const submitVerifications = useCallback(async (ops: QueueOp[]) => {
    if (!ops.length) return { applied: 0, skipped: 0 }
    const res = await fetch(`${API_BASE}/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations: ops.map(({ label: _label, queuedAt: _q, ...op }) => op) }),
    })
    if (!res.ok) { toast.error('Sync failed — operations kept in queue'); throw new Error('sync failed') }
    const data = await res.json() as {
      applied: number; skipped: number
      items?: { operationId: string; status: string; assetCode?: string; assetId?: string; exceptionCode?: string }[]
    }
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

  const importAssets = useCallback(async (clientId: string, rows: Record<string, unknown>[]) => {
    const res = await fetch(`${API_BASE}/assets/import`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, rows }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null) as { error?: string } | null
      toast.error('Import failed', { description: err?.error ?? `Core API responded ${res.status}` })
      return null
    }
    const data = await res.json() as { imported: number; updated: number; skipped: number; rejected: number; locationsUnlinked: number }
    await refresh()
    return data
  }, [refresh])

  const openAudit = useCallback((id: string) => { setSelectedAuditId(id) }, [])

  // ── Audit planning (Ops → Audit Projects) ──────────────────────
  const createAudit = useCallback(async (data: { clientId: string; name: string; type: string; financialYear?: string; startDate?: string; endDate?: string; locationsLabel?: string }) => {
    const res = await fetch(`${API_BASE}/audits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!res.ok) { toast.error('Could not create audit project', { description: await apiError(res, `Core API responded ${res.status}`) }); return null }
    const created = await res.json() as { audit: { id: string; code: string; name: string } }
    toast.success(`${created.audit.code} created`, { description: 'Now assign a field team scope so auditors see it on their device.' })
    await refresh()
    return created.audit.id
  }, [refresh])

  const assignAuditor = useCallback(async (auditId: string, auditorId: string, locationId: string | null, scope: string) => {
    const res = await fetch(`${API_BASE}/audits`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: auditId, action: 'assign', auditorId, locationId, scope }) })
    if (!res.ok) { toast.error('Could not publish scope', { description: await apiError(res, `Core API responded ${res.status}`) }); return null }
    const data = await res.json() as { attached: number }
    if (data.attached === 0) {
      toast.warning('Scope published — but 0 assets linked', {
        description: 'Assets attach by exact location match. Make sure the scope’s location matches the “Location” column used during register import, or the asset stays “not in any scope” on the auditor’s device.',
      })
    } else {
      toast.success('Field scope published', { description: `${data.attached} asset${data.attached === 1 ? '' : 's'} linked — visible on the auditor's device after their next sync.` })
    }
    await refresh()
    return data.attached
  }, [refresh])

  const unassignAssignment = useCallback(async (auditId: string, assignmentId: string) => {
    const res = await fetch(`${API_BASE}/audits`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: auditId, action: 'unassign', assignmentId }) })
    if (!res.ok) { toast.error('Could not withdraw scope', { description: await apiError(res, `Core API responded ${res.status}`) }); return false }
    toast.success('Scope withdrawn')
    await refresh()
    return true
  }, [refresh])

  const advanceAudit = useCallback(async (auditId: string) => {
    const res = await fetch(`${API_BASE}/audits`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: auditId, action: 'advance' }) })
    if (!res.ok) { toast.error('Stage move failed', { description: await apiError(res, `Core API responded ${res.status}`) }); return false }
    await refresh()
    return true
  }, [refresh])

  const addAuditor = useCallback(async (data: { name: string; email: string; phone?: string; city?: string }) => {
    const res = await fetch(`${API_BASE}/auditors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!res.ok) { toast.error('Could not add team member', { description: await apiError(res, `Core API responded ${res.status}`) }); return false }
    await refresh()
    return true
  }, [refresh])

  const setAuditorStatus = useCallback(async (id: string, status: string) => {
    const res = await fetch(`${API_BASE}/auditors`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    if (!res.ok) { toast.error('Status update failed', { description: await apiError(res, `Core API responded ${res.status}`) }); return false }
    await refresh()
    return true
  }, [refresh])

  const removeAuditor = useCallback(async (id: string) => {
    const res = await fetch(`${API_BASE}/auditors?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Remove not allowed', { description: await apiError(res, `Core API responded ${res.status}`) }); return false }
    await refresh()
    return true
  }, [refresh])

  const addClient = useCallback(async (data: { name: string; industry: string; city: string; contact: string; email: string; phone?: string }) => {
    const res = await fetch(`${API_BASE}/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!res.ok) { toast.error('Could not add client', { description: await apiError(res, `Core API responded ${res.status}`) }); return false }
    await refresh()
    return true
  }, [refresh])

  const setClientStatus = useCallback(async (id: string, status: string) => {
    const res = await fetch(`${API_BASE}/clients`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    if (!res.ok) { toast.error('Status update failed', { description: await apiError(res, `Core API responded ${res.status}`) }); return false }
    await refresh()
    return true
  }, [refresh])

  const removeClient = useCallback(async (id: string) => {
    const res = await fetch(`${API_BASE}/clients?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Remove not allowed', { description: await apiError(res, `Core API responded ${res.status}`) }); return false }
    await refresh()
    return true
  }, [refresh])

  const value = useMemo<Store>(() => ({
    user, authLoading, login, logout,
    world, loading, surface, setSurface, opsView, setOpsView, clientView, setClientView,
    clientIdentityId, setClientIdentityId,
    asset360, openAsset360: (assetId) => setAsset360({ assetId }), closeAsset360: () => setAsset360(null),
    selectedAuditId, openAudit, refresh, submitVerifications, patchException, submitApproval, generateReport, finalizeReport, importAssets,
    createAudit, assignAuditor, unassignAssignment, advanceAudit,
    addAuditor, setAuditorStatus, removeAuditor, addClient, setClientStatus, removeClient,
  }), [user, authLoading, login, logout, world, loading, surface, opsView, clientView, clientIdentityId, asset360, selectedAuditId, refresh, submitVerifications, patchException, submitApproval, generateReport, finalizeReport, importAssets, createAudit, assignAuditor, unassignAssignment, advanceAudit, addAuditor, setAuditorStatus, removeAuditor, addClient, setClientStatus, removeClient])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
