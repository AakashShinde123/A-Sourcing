// Hub · the shell module manifest
import type { ModuleManifest } from '../shared/module-contract'

export const HUB_MANIFEST: ModuleManifest = {
  id: 'hub',
  name: 'Platform Hub',
  version: '2.0.0',
  kind: 'shell',
  tagline: 'Launcher, switcher and system architecture map',
  description:
    'The glue surface: product landing, module switcher and a live architecture map built from the same manifests the CI/CD pipelines consume. Knows where every module is deployed.',
  iconKey: 'qr-code',
  accent: 'violet',
  apiContract: [
    { method: 'GET', path: '/api/core/registry', purpose: 'Live module & service discovery' },
    { method: 'GET', path: '/api/core/bootstrap', purpose: 'Landing page live stats' },
  ],
  deploy: {
    standalone: true,
    target: 'easysourcing.in',
    image: 'registry.es/hub:2.0.0',
    deps: ['@es/shared@2.1'],
  },
  screens: ['Landing', 'System Architecture', 'Deploy Planner'],
}
