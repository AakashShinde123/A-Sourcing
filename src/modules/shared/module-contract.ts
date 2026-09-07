// ─────────────────────────────────────────────────────────────────────────────
// @es/shared · Module Contract
// Every standalone module (portal, mobile app, even the hub itself) declares
// itself with a ModuleManifest. The manifest is PURE DATA (server-safe) so it
// can be rendered by the Hub UI, served by the /api/core/registry discovery
// endpoint, or embedded into a CI/CD pipeline when each module ships on its own.
//
// Rule of the platform:
//   · modules NEVER import each other's internals — only @es/shared
//   · modules talk to each other ONLY through the Core API (REST contract)
//   · each module can be built, versioned and deployed on its own
// ─────────────────────────────────────────────────────────────────────────────

export type IconKey = 'layout-dashboard' | 'scan-line' | 'building-2' | 'boxes' | 'qr-code'
export type AccentKey = 'emerald' | 'teal' | 'amber' | 'violet'
export type ModuleKind = 'shell' | 'portal' | 'mobile' | 'service'

export interface ApiCall {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  purpose: string
}

export interface ModuleManifest {
  id: string
  name: string
  /** semver — bumped independently per module */
  version: string
  kind: ModuleKind
  tagline: string
  description: string
  iconKey: IconKey
  accent: AccentKey
  /** REST contract this module consumes from the Core API */
  apiContract: ApiCall[]
  deploy: {
    standalone: boolean
    /** where this module lands when deployed on its own */
    target: string
    /** container image used by the module's own pipeline */
    image: string
    /** shared packages the module needs at runtime */
    deps: string[]
  }
  screens: string[]
}

/** Shared kernel (@es/shared) — the versioned package every module depends on */
export const SHARED_KERNEL = {
  name: '@es/shared',
  version: '2.1.0',
  description: 'Types, design tokens, format helpers, API SDK and domain views shared by every module.',
  exports: [
    { name: 'types.ts', what: 'World / Asset / Audit / Verification … DTOs' },
    { name: 'format.ts', what: 'Currency, date, status & severity meta maps' },
    { name: 'ui-bits.tsx', what: 'Kpi, Pill, Avatar, Bar, EmptyState primitives' },
    { name: 'store.tsx', what: 'ESProvider — API SDK + global state' },
    { name: 'module-contract.ts', what: 'Manifest schema every module declares' },
    { name: 'views/*', what: 'Domain views reused by both portals' },
  ],
} as const

export const CORE_API_MANIFEST: ModuleManifest = {
  id: 'core-api',
  name: 'Core API Service',
  version: '3.1.0',
  kind: 'service',
  tagline: 'The single source of truth every module talks to',
  description:
    'Stateless REST service over Prisma/SQLite. Owns clients, locations, assets, audits, verifications, exceptions, evidence, reports, approvals and the append-only audit log. Session-authenticated (JWT httpOnly) with server-side RBAC: bootstrap payloads are scoped per role, writes are role-gated. Exposes the discovery endpoint /api/core/registry.',
  iconKey: 'boxes',
  accent: 'violet',
  apiContract: [
    { method: 'GET', path: '/api/core/bootstrap', purpose: 'Full world payload + stats — role-scoped (CLIENT: own data, AUDITOR: own work)' },
    { method: 'POST', path: '/api/core/audits', purpose: 'Create audit project (draft) — team only' },
    { method: 'PATCH', path: '/api/core/audits', purpose: 'Publish/withdraw field scopes, advance lifecycle — team only' },
    { method: 'POST', path: '/api/core/verify', purpose: 'Idempotent batch sync — AUDITOR identity forced from session' },
    { method: 'PATCH', path: '/api/core/exceptions', purpose: 'Exception lifecycle — team (ADMIN/OPS) only' },
    { method: 'POST', path: '/api/core/approvals', purpose: 'Client sign-off — CLIENT scoped to own audits, identity from session' },
    { method: 'POST', path: '/api/core/reports', purpose: 'Report generate / finalize — team only' },
    { method: 'POST', path: '/api/core/assets/import', purpose: 'Register intake (idempotent) — team only' },
    { method: 'POST', path: '/api/core/auditors', purpose: 'Add field team member — team only' },
    { method: 'PATCH', path: '/api/core/auditors', purpose: 'Team member status / contact — team only' },
    { method: 'DELETE', path: '/api/core/auditors', purpose: 'Remove member — team only, 409 if history' },
    { method: 'POST', path: '/api/core/clients', purpose: 'Onboard client — team only' },
    { method: 'PATCH', path: '/api/core/clients', purpose: 'Client lifecycle — team only' },
    { method: 'DELETE', path: '/api/core/clients', purpose: 'Remove client — ADMIN only, 409 if data exists' },
    { method: 'GET', path: '/api/core/registry', purpose: 'Service discovery (session required)' },
  ],
  deploy: {
    standalone: true,
    target: 'api.easysourcing.in',
    image: 'registry.es/core-api:3.0.0',
    deps: ['prisma', 'zod'],
  },
  screens: [],
}

/** Convenience lookup used by the Hub and the discovery route */
export const METHOD_CLS: Record<ApiCall['method'], string> = {
  GET: 'bg-emerald-100 text-emerald-700 ring-emerald-500/25',
  POST: 'bg-violet-100 text-violet-700 ring-violet-500/25',
  PATCH: 'bg-amber-100 text-amber-700 ring-amber-500/30',
  DELETE: 'bg-red-100 text-red-700 ring-red-500/25',
}
