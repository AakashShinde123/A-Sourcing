/**
 * Shared fixtures for white-box integration tests.
 *
 * Tests run against an ISOLATED copy of the demo DB (db/test.db, selected via
 * DATABASE_URL). Every fixture is tracked and torn down in afterAll so test
 * runs stay deterministic and never touch the live demo data.
 */
import { db } from '@/lib/db'

let counter = 0
export const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(++counter).toString(36)}`

export interface Fixture {
  clientId: string
  auditorId: string
  auditId: string
  assetId: string
  assignmentId: string
  assetCode: string
  auditCode: string
}

const tracked = {
  clientIds: [] as string[],
  auditorIds: [] as string[],
  auditIds: [] as string[],
  assetIds: [] as string[],
  assignmentIds: [] as string[],
}

export async function makeFixture(opts?: { auditStatus?: string; totalInScope?: number; assetCount?: number }): Promise<Fixture> {
  const tag = uid('tst')
  const client = await db.client.create({
    data: {
      code: `TSTC-${tag.slice(-8).toUpperCase()}`, name: `Test Client ${tag}`, industry: 'Testing',
      contact: 'QA Lead', email: `qa.${tag}@es.test`, city: 'Testville', since: new Date('2024-01-01'),
    },
  })
  const auditor = await db.auditor.create({
    data: { name: `QA Auditor ${tag}`, email: `aud.${tag}@es.test`, employeeCode: `QA-${tag.slice(-6)}`, status: 'in_field', city: 'Testville' },
  })
  const audit = await db.auditProject.create({
    data: {
      clientId: client.id, code: `TSTA-${tag.slice(-8).toUpperCase()}`, name: `Test Audit ${tag}`,
      type: 'Fixed Asset Verification', status: opts?.auditStatus ?? 'in_progress', financialYear: 'FY 2025-26',
      startDate: new Date('2026-08-01'), totalInScope: opts?.totalInScope ?? 5,
    },
  })
  const assignment = await db.auditAssignment.create({
    data: { auditId: audit.id, auditorId: auditor.id, scope: 'Test zone', status: 'assigned' },
  })
  const n = opts?.assetCount ?? 1
  const assets = [] as { id: string; code: string }[]
  for (let i = 0; i < n; i++) {
    const code = `ES-TST-${tag.slice(-6).toUpperCase()}-${i}`
    const a = await db.asset.create({
      data: {
        clientId: client.id, code, clientAssetId: `CA-${tag}-${i}`, description: `Test asset ${i}`,
        category: 'Test', status: 'active', assignmentId: assignment.id,
      },
    })
    assets.push({ id: a.id, code })
  }
  tracked.clientIds.push(client.id)
  tracked.auditorIds.push(auditor.id)
  tracked.auditIds.push(audit.id)
  tracked.assetIds.push(...assets.map((a) => a.id))
  tracked.assignmentIds.push(assignment.id)
  return {
    clientId: client.id, auditorId: auditor.id, auditId: audit.id,
    assetId: assets[0].id, assignmentId: assignment.id,
    assetCode: assets[0].code, auditCode: audit.code,
  }
}

export async function cleanupFixtures(): Promise<void> {
  // Children first — verifications/exceptions/evidence/logs hang off fixture refs.
  await db.verification.deleteMany({ where: { OR: [{ auditId: { in: tracked.auditIds } }, { auditorId: { in: tracked.auditorIds } }] } })
  await db.exception.deleteMany({ where: { auditId: { in: tracked.auditIds } } })
  await db.evidence.deleteMany({ where: { auditId: { in: tracked.auditIds } } })
  await db.approval.deleteMany({ where: { auditId: { in: tracked.auditIds } } })
  await db.report.deleteMany({ where: { auditId: { in: tracked.auditIds } } })
  await db.auditLog.deleteMany({ where: { entityRef: { in: [...tracked.assetIds, ...tracked.auditIds.map((id) => id)] } } })
  await db.auditLog.deleteMany({ where: { detail: { contains: 'TST' } } })
  await db.asset.deleteMany({ where: { id: { in: tracked.assetIds } } })
  // Discovery assets created against fixture audits
  await db.asset.deleteMany({ where: { clientId: { in: tracked.clientIds } } })
  await db.auditAssignment.deleteMany({ where: { id: { in: tracked.assignmentIds } } })
  await db.auditProject.deleteMany({ where: { id: { in: tracked.auditIds } } })
  await db.auditor.deleteMany({ where: { id: { in: tracked.auditorIds } } })
  await db.client.deleteMany({ where: { id: { in: tracked.clientIds } } })
  tracked.clientIds.length = 0
  tracked.auditorIds.length = 0
  tracked.auditIds.length = 0
  tracked.assetIds.length = 0
  tracked.assignmentIds.length = 0
}

/** Build a NextRequest-shaped Request for direct handler invocation. */
export function jsonRequest(url: string, body: unknown, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest
}
