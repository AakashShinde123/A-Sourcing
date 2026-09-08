// Auditor Mobile · standalone module manifest
import type { ModuleManifest } from '../shared/module-contract'

export const AUDITOR_MOBILE_MANIFEST: ModuleManifest = {
  id: 'auditor-mobile',
  name: 'Auditor Mobile',
  version: '2.2.0',
  kind: 'mobile',
  tagline: 'Offline-first field verification in 10–20 seconds',
  description:
    'Dedicated field experience: scan QR, verify against expected state, photograph, capture GPS. Fully offline-first with a localStorage queue and idempotent sync that never duplicates events.',
  iconKey: 'scan-line',
  accent: 'teal',
  apiContract: [
    { method: 'GET', path: '/api/core/bootstrap', purpose: 'Jobs + expected-state cache' },
    { method: 'POST', path: '/api/core/verify', purpose: 'Idempotent offline-queue sync' },
  ],
  deploy: {
    standalone: true,
    target: 'field.easysourcing.in · Play Store (PWA wrapper)',
    image: 'registry.es/auditor-mobile:2.1.1',
    deps: ['@es/shared@2.1'],
  },
  screens: ['Home & progress ring', 'Jobs', 'Scan flow', 'Manual search', 'Floor-to-Sheet discovery', 'Exceptions', 'Profile & sync'],
}
