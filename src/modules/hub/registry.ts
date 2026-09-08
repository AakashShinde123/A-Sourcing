// Platform registry — every deployable unit in one place.
// The Hub UI renders from this, and /api/core/registry serves it as the
// service-discovery payload. Single source of truth for the topology.
import { CORE_API_MANIFEST, SHARED_KERNEL, type ModuleManifest } from '../shared/module-contract'
import { HUB_MANIFEST } from './manifest'
import { OPS_PORTAL_MANIFEST } from '../ops-portal/manifest'
import { CLIENT_PORTAL_MANIFEST } from '../client-portal/manifest'
import { AUDITOR_MOBILE_MANIFEST } from '../auditor-mobile/manifest'
import type { Surface } from '../shared/store'

/** Manifest id → hub surface route (the shell mounts the module at this key) */
export const MODULE_SURFACE: Record<string, Surface> = {
  'hub': 'landing',
  'ops-portal': 'ops',
  'client-portal': 'client',
  'auditor-mobile': 'mobile',
}

/** The four independently deployable frontend modules */
export const MODULES: ModuleManifest[] = [
  HUB_MANIFEST,
  OPS_PORTAL_MANIFEST,
  CLIENT_PORTAL_MANIFEST,
  AUDITOR_MOBILE_MANIFEST,
]

export const CORE_API = CORE_API_MANIFEST
export { SHARED_KERNEL }

export const PLATFORM = {
  name: 'EasySourcing',
  tagline: 'Asset Physical Verification · Audit · Reconciliation',
  platformVersion: '2.1',
} as const

export function moduleById(id: string): ModuleManifest | undefined {
  return MODULES.find((m) => m.id === id) ?? (id === CORE_API.id ? CORE_API : undefined)
}
