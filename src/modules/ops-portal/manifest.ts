// Operations Portal · standalone module manifest
import type { ModuleManifest } from '../shared/module-contract'

export const OPS_PORTAL_MANIFEST: ModuleManifest = {
  id: 'ops-portal',
  name: 'Operations Portal',
  version: '2.1.0',
  kind: 'portal',
  tagline: 'The internal cockpit for EasySourcing audit teams',
  description:
    'Data-dense desktop workspace: KPI cockpit, audit projects, asset register, location tree, exception governance, evidence, reports, analytics and the append-only audit trail.',
  iconKey: 'layout-dashboard',
  accent: 'emerald',
  apiContract: [
    { method: 'GET', path: '/api/core/bootstrap', purpose: 'World payload + KPIs' },
    { method: 'PATCH', path: '/api/core/exceptions', purpose: 'Drive exception lifecycle' },
    { method: 'POST', path: '/api/core/reports', purpose: 'Generate & finalize reports' },
  ],
  deploy: {
    standalone: true,
    target: 'ops.easysourcing.in',
    image: 'registry.es/ops-portal:2.1.0',
    deps: ['@es/shared@2.1'],
  },
  screens: ['Overview', 'Audit Projects', 'Asset Register', 'Locations', 'Exception Center', 'Evidence', 'Reports', 'Analytics & Risk', 'Field Team', 'Audit Trail', 'Clients'],
}
