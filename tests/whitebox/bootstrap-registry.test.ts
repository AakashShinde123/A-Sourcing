/**
 * WHITE-BOX INTEGRATION TESTS — /api/core/bootstrap aggregate invariants
 * and /api/core/registry service-discovery payload.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { GET as bootstrapGET } from '@/app/api/core/bootstrap/route'
import { GET as registryGET } from '@/app/api/core/registry/route'
import { db } from '@/lib/db'
import { makeFixture, cleanupFixtures } from './helpers'

afterAll(async () => {
  await cleanupFixtures()
})

describe('bootstrap aggregates', () => {
  test('returns the full world with consistent, in-bounds aggregates', async () => {
    await makeFixture() // guarantee at least one fixture row flows through aggregates
    const res = await bootstrapGET()
    expect(res.status).toBe(200)
    const w = await res.json() as Record<string, unknown>

    for (const key of ['clients', 'locations', 'assets', 'auditors', 'audits', 'assignments', 'verifications', 'exceptions', 'evidence', 'reports', 'approvals', 'auditLogs', 'stats']) {
      expect(w[key], `payload key ${key}`).toBeDefined()
    }

    const stats = w.stats as Record<string, unknown>
    const matchRate = stats.matchRate as number
    expect(matchRate).toBeGreaterThanOrEqual(0)
    expect(matchRate).toBeLessThanOrEqual(100)

    const trend = stats.verificationTrend as unknown[]
    expect(trend).toHaveLength(14)

    const audits = w.audits as Record<string, unknown>[]
    for (const a of audits) {
      const p = a.progress as number
      expect(Number.isInteger(p)).toBe(true)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(100)
    }

    const assets = w.assets as Record<string, unknown>[]
    for (const a of assets) {
      expect(typeof a.locationPath).toBe('string')
      expect(a.code).toBeDefined()
    }

    // global stats cross-checked against raw DB (white-box)
    const dbAssets = await db.asset.count()
    expect(stats.assetsRegistered).toBe(dbAssets)
  })

  test('verifiedAssets never exceeds distinct verified set for an audit', async () => {
    const res = await bootstrapGET()
    const w = await res.json() as Record<string, unknown>
    const audits = w.audits as { id: string; verifiedAssets: number; totalInScope: number }[]
    for (const a of audits) {
      const rows = await db.verification.count({ where: { auditId: a.id, assetId: { not: null } } })
      const distinct = new Set(
        (await db.verification.findMany({ where: { auditId: a.id, assetId: { not: null } }, select: { assetId: true } })).map((v) => v.assetId),
      ).size
      expect(distinct).toBeLessThanOrEqual(rows || 1)
      // bootstrap computes verifiedAssets from a Set, so it must equal distinct
      expect(a.verifiedAssets).toBe(distinct)
    }
  })
})

describe('registry / service discovery', () => {
  test('reports healthy core with live DB counts and module manifests', async () => {
    const res = await registryGET()
    expect(res.status).toBe(200)
    const r = await res.json() as Record<string, unknown>

    const service = r.service as Record<string, unknown>
    expect(service.status).toBe('healthy')
    const dbInfo = service.db as Record<string, unknown>
    expect(dbInfo.ok).toBe(true)
    const counts = dbInfo.counts as Record<string, number>
    for (const k of ['clients', 'assets', 'audits', 'verifications', 'exceptions', 'evidence', 'reports', 'approvals']) {
      expect(typeof counts[k]).toBe('number')
    }

    const modules = r.modules as unknown[]
    expect(Array.isArray(modules)).toBe(true)
    expect(modules.length).toBeGreaterThanOrEqual(3)

    const shared = r.sharedKernel as Record<string, unknown>
    expect(shared.version).toBeDefined()
    expect(typeof service.uptimeSeconds).toBe('number')
    expect(service.latencyMs).toBeGreaterThanOrEqual(0)
  })
})
