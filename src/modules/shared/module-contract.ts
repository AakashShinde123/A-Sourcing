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
  method: 'GET' | 'POST' | 'PATCH'
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
  version: '2.1.4',
  kind: 'service',
  tagline: 'The single source of truth every module talks to',
  description:
    'Stateless REST service over Prisma/SQLite. Owns clients, locations, assets, audits, verifications, exceptions, evidence, reports, approvals and the append-only audit log. Exposes the discovery endpoint /api/core/registry.',
  iconKey: 'boxes',
  accent: 'violet',
  apiContract: [
    { method: 'GET', path: '/api/core/bootstrap', purpose: 'Full world payload + computed stats' },
    { method: 'POST', path: '/api/core/verify', purpose: 'Idempotent batch verification sync' },
    { method: 'PATCH', path: '/api/core/exceptions', purpose: 'Exception lifecycle transitions' },
    { method: 'POST', path: '/api/core/approvals', purpose: 'Client sign-off decisions' },
    { method: 'POST', path: '/api/core/reports', purpose: 'Report generate / finalize' },
    { method: 'GET', path: '/api/core/registry', purpose: 'Service discovery (this endpoint)' },
  ],
  deploy: {
    standalone: true,
    target: 'api.easysourcing.in',
    image: 'registry.es/core-api:2.1.4',
    deps: ['prisma', 'zod'],
  },
  screens: [],
}

/** Convenience lookup used by the Hub and the discovery route */
export const METHOD_CLS: Record<ApiCall['method'], string> = {
  GET: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  POST: 'bg-violet-500/10 text-violet-300 ring-violet-500/20',
  PATCH: 'bg-amber-500/10 text-amber-300 ring-amber-500/20',
}
