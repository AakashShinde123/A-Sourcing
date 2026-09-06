// Client Portal · standalone module manifest
import type { ModuleManifest } from '../shared/module-contract'

export const CLIENT_PORTAL_MANIFEST: ModuleManifest = {
  id: 'client-portal',
  name: 'Client Portal',
  version: '2.0.3',
  kind: 'portal',
  tagline: 'Evidence-backed transparency for your customers',
  description:
    'Scoped tenant view: customers see only their own organization — audit progress, assets, exceptions, evidence and reports, with formal one-click approvals that finalize an audit.',
  iconKey: 'building-2',
  accent: 'amber',
  apiContract: [
    { method: 'GET', path: '/api/core/bootstrap', purpose: 'World payload (client-scoped views)' },
    { method: 'POST', path: '/api/core/approvals', purpose: 'Approve / request changes' },
    { method: 'POST', path: '/api/core/reports', purpose: 'Regenerate client reports' },
  ],
  deploy: {
    standalone: true,
    target: 'clients.easysourcing.in',
    image: 'registry.es/client-portal:2.0.3',
    deps: ['@es/shared@2.1'],
  },
  screens: ['Dashboard', 'Audits', 'Assets', 'Exceptions', 'Evidence', 'Reports', 'Approvals'],
}
