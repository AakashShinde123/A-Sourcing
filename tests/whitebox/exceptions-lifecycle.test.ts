/**
 * WHITE-BOX INTEGRATION TESTS — /api/core/exceptions lifecycle machine.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { PATCH } from '@/app/api/core/exceptions/route'
import { db } from '@/lib/db'
import { makeFixture, cleanupFixtures, jsonRequest } from './helpers'

let fx: Awaited<ReturnType<typeof makeFixture>>
let exId: string

afterAll(async () => {
  await cleanupFixtures()
})

async function patch(body: Record<string, unknown>) {
  const res = await PATCH(await jsonRequest('http://local/api/core/exceptions', body, 'PATCH'))
  return { status: res.status, body: await res.json() as Record<string, unknown> }
}

async function freshException(): Promise<string> {
  const ex = await db.exception.create({
    data: {
      code: `EX-TST-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6)}`,
      clientId: fx.clientId, auditId: fx.auditId, assetId: fx.assetId,
      type: 'missing', severity: 'high', status: 'open',
      title: 'WB test exception', description: 'White-box lifecycle fixture', detectedBy: 'QA',
    },
  })
  return ex.id
}

describe('exception lifecycle — basic contract', () => {
  test('404 for unknown exception id', async () => {
    const { status } = await patch({ id: 'does-not-exist', action: 'assign' })
    expect(status).toBe(404)
  })

  test('400 for invalid action', async () => {
    fx = await makeFixture()
    exId = await freshException()
    const { status } = await patch({ id: exId, action: 'explode' })
    expect(status).toBe(400)
  })

  test('resolve records resolutionNote and resolvedAt', async () => {
    await patch({ id: exId, action: 'assign', assignedTo: 'WB Ops' })
    await patch({ id: exId, action: 'investigate' })
    const { body } = await patch({ id: exId, action: 'resolve', note: 'Asset located in Annex B' })
    expect(body.status).toBe('resolved')
    const ex = await db.exception.findUnique({ where: { id: exId } })
    expect(ex!.resolutionNote).toBe('Asset located in Annex B')
    expect(ex!.resolvedAt).not.toBeNull()
  })
})

describe('exception lifecycle — state machine enforcement (production hardening)', () => {
  test('legal chain open→…→closed works end to end', async () => {
    exId = await freshException()
    const steps: [string, string][] = [
      ['assign', 'assigned'], ['investigate', 'investigating'], ['resolve', 'resolved'],
      ['review', 'reviewer_review'], ['approve', 'approved'], ['close', 'closed'],
    ]
    for (const [action, expected] of steps) {
      const { status, body } = await patch({ id: exId, action })
      expect(status).toBe(200)
      expect(body.status).toBe(expected)
    }
    const ex = await db.exception.findUnique({ where: { id: exId } })
    expect(ex!.status).toBe('closed')
  })

  test('REGRESSION: stage skipping is rejected with 409 (was silently allowed)', async () => {
    exId = await freshException()
    const { status, body } = await patch({ id: exId, action: 'approve' }) // open → approved jump
    expect(status).toBe(409)
    expect((body as { error: string }).error).toContain('Illegal transition')
    const ex = await db.exception.findUnique({ where: { id: exId } })
    expect(ex!.status).toBe('open') // untouched
  })

  test('REGRESSION: closed exceptions cannot be moved backwards', async () => {
    exId = await freshException()
    for (const a of ['assign', 'investigate', 'resolve', 'review', 'approve', 'close']) await patch({ id: exId, action: a })
    const { status } = await patch({ id: exId, action: 'assign' })
    expect(status).toBe(409)
    expect((await db.exception.findUnique({ where: { id: exId } }))!.status).toBe('closed')
  })

  test('every lifecycle move writes an audit log entry', async () => {
    exId = await freshException()
    const code = (await db.exception.findUnique({ where: { id: exId } }))!.code
    await patch({ id: exId, action: 'assign' })
    const logs = await db.auditLog.count({ where: { entityRef: code, action: 'EXCEPTION_ASSIGN' } })
    expect(logs).toBeGreaterThanOrEqual(1)
  })
})
