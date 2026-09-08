import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CORE_API, MODULES, PLATFORM, SHARED_KERNEL } from '@/modules/hub/registry'

export const dynamic = 'force-dynamic'

/**
 * GET /api/core/registry — service discovery endpoint.
 *
 * Every module asks THIS endpoint "who else is out there, and what do they
 * consume?" The payload is built from the same ModuleManifests the Hub UI and
 * the CI/CD pipelines use, so what you see on the Architecture map is exactly
 * what is deployed.
 */
export async function GET() {
  const started = Date.now()

  // Liveness: the core service proves its own health by touching the DB.
  let dbOk = true
  const counts: Record<string, number> = {}
  try {
    const [clients, assets, audits, verifications, exceptions, evidence, reports, approvals] = await Promise.all([
      db.client.count(), db.asset.count(), db.auditProject.count(), db.verification.count(),
      db.exception.count(), db.evidence.count(), db.report.count(), db.approval.count(),
    ])
    Object.assign(counts, { clients, assets, audits, verifications, exceptions, evidence, reports, approvals })
  } catch {
    dbOk = false
  }

  return NextResponse.json({
    platform: PLATFORM,
    service: {
      ...CORE_API,
      status: dbOk ? 'healthy' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      latencyMs: Date.now() - started,
      db: { ok: dbOk, engine: 'prisma/sqlite', counts },
    },
    modules: MODULES,
    sharedKernel: SHARED_KERNEL,
    generatedAt: new Date().toISOString(),
  })
}
