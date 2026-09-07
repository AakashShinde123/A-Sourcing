/**
 * WHITE-BOX INTEGRATION TESTS — /api/core/verify sync engine.
 * The handler is invoked directly; DB state is asserted after each call.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { POST } from '@/app/api/core/verify/route'
import { db } from '@/lib/db'
import { makeFixture, cleanupFixtures, jsonRequest, type Fixture } from './helpers'
import type { SyncOpNormalized } from '@/lib/core-logic'

let fx: Fixture

afterAll(async () => {
  await cleanupFixtures()
})

async function call(ops: unknown) {
  const res = await POST(await jsonRequest('http://local/api/core/verify', { operations: ops }))
  return { status: res.status, body: await res.json() as Record<string, unknown> }
}

function op(over: Partial<SyncOpNormalized> = {}): Record<string, unknown> {
  return {
    operationId: `wb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    auditId: fx.auditId, auditorId: fx.auditorId, result: 'matched', ...over,
  }
}

describe('sync engine — happy path', () => {
  test('empty batch is a no-op 200', async () => {
    const { status, body } = await call([])
    expect(status).toBe(200)
    expect(body.applied).toBe(0)
    expect(body.skipped).toBe(0)
  })

  test('matched op persists verification, stamps asset, writes audit log', async () => {
    fx = await makeFixture()
    const before = await db.asset.findUnique({ where: { id: fx.assetId } })
    const { status, body } = await call([op({ assetId: fx.assetId, assignmentId: fx.assignmentId })])
    expect(status).toBe(200)
    expect(body.applied).toBe(1)

    const v = await db.verification.findUnique({ where: { operationId: (body.items as { operationId: string }[])[0].operationId } })
    expect(v).not.toBeNull()
    expect(v!.result).toBe('matched')
    expect(v!.assetId).toBe(fx.assetId)

    const asset = await db.asset.findUnique({ where: { id: fx.assetId } })
    expect(asset!.lastVerifiedAt!.getTime()).toBeGreaterThanOrEqual(before!.lastVerifiedAt?.getTime() ?? 0)
    expect(asset!.status).not.toBe('missing')

    const log = await db.auditLog.findFirst({ where: { entityRef: fx.assetCode, action: 'VERIFICATION_RECORDED' } })
    expect(log).not.toBeNull()
  })

  test('IDEMPOTENCY: replaying the same operationId creates no duplicate', async () => {
    const opId = `wb-replay-${Date.now()}`
    const first = await call([op({ operationId: opId, assetId: fx.assetId })])
    expect(first.body.applied).toBe(1)
    const replay = await call([op({ operationId: opId, assetId: fx.assetId })])
    expect(replay.status).toBe(200)
    expect(replay.body.applied).toBe(0)
    expect(replay.body.skipped).toBe(1)
    const rows = await db.verification.count({ where: { operationId: opId } })
    expect(rows).toBe(1)
  })

  test('missing result marks the asset and opens a HIGH severity exception', async () => {
    const { body } = await call([op({ assetId: fx.assetId, result: 'missing', remarks: 'Not on floor' })])
    expect(body.applied).toBe(1)
    const item = (body.items as { exceptionCode?: string }[])[0]
    expect(item.exceptionCode).toMatch(/^EX-\d{4}-\d{4}$/)
    const ex = await db.exception.findUnique({ where: { code: item.exceptionCode! } })
    expect(ex!.type).toBe('missing')
    expect(ex!.severity).toBe('high')
    expect(ex!.status).toBe('open')
    const asset = await db.asset.findUnique({ where: { id: fx.assetId } })
    expect(asset!.status).toBe('missing')
  })

  test('unregistered discovery creates ES-DSC asset + exception + links them', async () => {
    const { body } = await call([op({
      result: 'unregistered',
      discovery: { description: 'Floor discovery during test', make: 'Acme', locationLabel: 'Zone 9' },
    })])
    expect(body.applied).toBe(1)
    const item = (body.items as { exceptionCode?: string }[])[0]
    const ex = await db.exception.findUnique({ where: { code: item.exceptionCode! } })
    expect(ex!.type).toBe('unregistered')
    expect(ex!.assetId).not.toBeNull()
    const asset = await db.asset.findUnique({ where: { id: ex!.assetId! } })
    expect(asset!.code).toMatch(/^ES-DSC-\d{5}$/)
    expect(asset!.clientId).toBe(fx.clientId)
  })

  test('photos persist as evidence rows bound to the verification', async () => {
    const { body } = await call([op({ assetId: fx.assetId, photos: ['seed-a', 'seed-b'] })])
    const item = (body.items as { operationId: string }[])[0]
    const v = await db.verification.findUnique({ where: { operationId: item.operationId } })
    const ev = await db.evidence.count({ where: { verificationId: v!.id } })
    expect(ev).toBe(2)
  })
})

describe('sync engine — assignment progress', () => {
  test('status moves to field_complete only when DISTINCT assets all verified (no double-count)', async () => {
    const f2 = await makeFixture({ assetCount: 2, totalInScope: 2 })
    const a = await db.asset.findMany({ where: { assignmentId: f2.assignmentId }, orderBy: { code: 'asc' } })
    expect(a.length).toBe(2)

    await call([op({ assetId: a[0].id, assignmentId: f2.assignmentId })])
    await call([op({ assetId: a[0].id, assignmentId: f2.assignmentId })]) // re-verify same asset
    let asg = await db.auditAssignment.findUnique({ where: { id: f2.assignmentId } })
    expect(asg!.status).toBe('in_progress') // 2 rows but only 1 distinct asset — regression guard

    await call([op({ assetId: a[1].id, assignmentId: f2.assignmentId })])
    asg = await db.auditAssignment.findUnique({ where: { id: f2.assignmentId } })
    expect(asg!.status).toBe('field_complete')
  })
})

describe('sync engine — hostile / invalid input (production hardening)', () => {
  test('invalid result value is rejected per-item, not applied', async () => {
    const { status, body } = await call([op({ result: 'hacked' as unknown as 'matched' })])
    expect(status).toBe(200)
    expect(body.applied).toBe(0)
    const items = body.items as { status: string; error?: string }[]
    expect(items[0].status).toBe('rejected')
    expect(items[0].error).toContain('result must be one of')
  })

  test('missing result with NO assetId must not 500-crash on asset!.clientId', async () => {
    // Regression test for the crash: `clientId: asset!.clientId` threw when asset was null.
    const { status, body } = await call([op({ result: 'missing' })])
    expect(status).toBe(200)
    expect(body.applied).toBe(0)
    const items = body.items as { status: string; error?: string }[]
    expect(items[0].status).toBe('rejected')
    expect(items[0].error).toContain('assetId')
  })

  test('unknown auditId is rejected instead of creating a dangling verification', async () => {
    const { status, body } = await call([op({ auditId: 'nonexistent-audit' })])
    expect(status).toBe(200)
    expect(body.applied).toBe(0)
    expect((body.items as { status: string }[])[0].status).toBe('rejected')
  })

  test('unknown auditorId is rejected instead of writing "Auditor" rows', async () => {
    const { status, body } = await call([op({ auditorId: 'nonexistent-auditor' })])
    expect(status).toBe(200)
    expect(body.applied).toBe(0)
    expect((body.items as { status: string }[])[0].status).toBe('rejected')
  })

  test('mixed batch: valid ops apply, invalid ops reject, batch never dies mid-way', async () => {
    const good1 = op({ assetId: fx.assetId })
    const bad = op({ result: 'missing' }) // no assetId — would crash old handler mid-batch
    const good2 = op({ assetId: fx.assetId, result: 'location_mismatch' })
    const { status, body } = await call([good1, bad, good2])
    expect(status).toBe(200)
    expect(body.applied).toBe(2)
    const items = body.items as { status: string }[]
    expect(items.map((i) => i.status)).toEqual(['applied', 'rejected', 'applied'])
  })

  test('unregistered WITHOUT discovery payload is rejected (no half-created rows)', async () => {
    const { body } = await call([op({ result: 'unregistered' })])
    expect(body.applied).toBe(0)
    expect((body.items as { status: string }[])[0].status).toBe('rejected')
  })

  test('malformed JSON body → 400 JSON error, never a 500/HTML page', async () => {
    const req = await jsonRequest('http://local/api/core/verify', '{not json')
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('application/json')
  })

  test('non-array operations field → 400', async () => {
    const { status } = await call({ operations: { nope: true } } as unknown)
    expect(status).toBe(400)
  })

  test('missing operations field → treated as empty batch (mobile client sends retry-friendly 200)', async () => {
    const res = await POST(await jsonRequest('http://local/api/core/verify', {}))
    expect(res.status).toBe(200)
    expect(((await res.json()) as Record<string, unknown>).applied).toBe(0)
  })
})
