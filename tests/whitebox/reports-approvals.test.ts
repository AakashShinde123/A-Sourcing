/**
 * WHITE-BOX INTEGRATION TESTS — /api/core/reports versioning engine
 * and /api/core/approvals decision engine.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { POST as reportsPOST } from '@/app/api/core/reports/route'
import { POST as approvalsPOST } from '@/app/api/core/approvals/route'
import { db } from '@/lib/db'
import { makeFixture, cleanupFixtures, jsonRequest } from './helpers'

let fx: Awaited<ReturnType<typeof makeFixture>>

afterAll(async () => {
  await cleanupFixtures()
})

async function report(body: Record<string, unknown>) {
  const res = await reportsPOST(jsonRequest('http://local/api/core/reports', body))
  return { status: res.status, body: await res.json() as Record<string, unknown> }
}

describe('report versioning engine', () => {
  test('404 for unknown audit', async () => {
    const { status } = await report({ auditId: 'nope', action: 'generate' })
    expect(status).toBe(404)
  })

  test('REGRESSION: generate sequence is unique & monotonic (was v1, v2, v2, …)', async () => {
    fx = await makeFixture({ auditStatus: 'review' })
    const labels: string[] = []
    for (let i = 0; i < 4; i++) {
      const { status, body } = await report({ auditId: fx.auditId, action: 'generate' })
      expect(status).toBe(200)
      labels.push((body.report as { versionLabel: string }).versionLabel)
    }
    expect(labels).toEqual(['v1', 'v2', 'v3', 'v4'])
    expect(new Set(labels).size).toBe(4)
  })

  test('finalize freezes the latest draft as Final', async () => {
    const { status } = await report({ auditId: fx.auditId, action: 'finalize' })
    expect(status).toBe(200)
    const reports = await db.report.findMany({ where: { auditId: fx.auditId }, orderBy: { generatedAt: 'desc' } })
    expect(reports[0].versionLabel).toBe('Final')
    expect(reports[0].status).toBe('final')
  })

  test('REGRESSION: generating after finalize continues the sequence (no v1 collision)', async () => {
    const { body } = await report({ auditId: fx.auditId, action: 'generate' })
    const label = (body.report as { versionLabel: string }).versionLabel
    expect(label).toBe('v5')
    const all = await db.report.findMany({ where: { auditId: fx.auditId } })
    const nonFinal = all.filter((r) => r.versionLabel.startsWith('v')).map((r) => r.versionLabel)
    expect(new Set(nonFinal).size).toBe(nonFinal.length)
  })

  test('finalize with zero existing reports is a 400, not a silent no-op', async () => {
    const fx2 = await makeFixture()
    const { status } = await report({ auditId: fx2.auditId, action: 'finalize' })
    expect(status).toBe(400)
  })

  test('generate with unknown action → 400', async () => {
    const { status } = await report({ auditId: fx.auditId, action: 'delete-everything' })
    expect(status).toBe(400)
  })
})

describe('approval decision engine', () => {
  test('404 for unknown audit', async () => {
    const res = await approvalsPOST(jsonRequest('http://local/api/core/approvals', { auditId: 'nope', decision: 'approved', byName: 'X', byRole: 'Y' }))
    expect(res.status).toBe(404)
  })

  test('approve on client_review audit finalizes it', async () => {
    fx = await makeFixture({ auditStatus: 'client_review' })
    const res = await approvalsPOST(jsonRequest('http://local/api/core/approvals', {
      auditId: fx.auditId, decision: 'approved', byName: 'QA Approver', byRole: 'CFO', comment: 'Numbers look right',
    }))
    expect(res.status).toBe(200)
    expect(((await res.json()) as Record<string, unknown>).ok).toBe(true)
    expect((await db.auditProject.findUnique({ where: { id: fx.auditId } }))!.status).toBe('completed')
  })

  test('changes_requested sends audit back to internal review', async () => {
    const fx2 = await makeFixture({ auditStatus: 'client_review' })
    await approvalsPOST(jsonRequest('http://local/api/core/approvals', {
      auditId: fx2.auditId, decision: 'changes_requested', byName: 'QA', byRole: 'Manager',
    }))
    expect((await db.auditProject.findUnique({ where: { id: fx2.auditId } }))!.status).toBe('review')
  })

  test('rejected / clarification record the decision without moving audit status', async () => {
    const fx3 = await makeFixture({ auditStatus: 'client_review' })
    await approvalsPOST(jsonRequest('http://local/api/core/approvals', { auditId: fx3.auditId, decision: 'clarification', byName: 'QA', byRole: 'Manager' }))
    expect((await db.auditProject.findUnique({ where: { id: fx3.auditId } }))!.status).toBe('client_review')
  })

  test('REGRESSION: invalid decision values are rejected with 400 (was silently recorded)', async () => {
    const fx4 = await makeFixture({ auditStatus: 'client_review' })
    const res = await approvalsPOST(jsonRequest('http://local/api/core/approvals', {
      auditId: fx4.auditId, decision: 'sure-why-not', byName: 'QA', byRole: 'Manager',
    }))
    expect(res.status).toBe(400)
    const approvals = await db.approval.count({ where: { auditId: fx4.auditId } })
    expect(approvals).toBe(0)
  })

  test('missing byName/byRole → 400 (audit trail needs an accountable actor)', async () => {
    const fx5 = await makeFixture({ auditStatus: 'client_review' })
    const res = await approvalsPOST(jsonRequest('http://local/api/core/approvals', { auditId: fx5.auditId, decision: 'approved' }))
    expect(res.status).toBe(400)
  })
})
