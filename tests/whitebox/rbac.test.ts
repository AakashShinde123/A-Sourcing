/**
 * WHITE-BOX TESTS — server-side RBAC on the Core API.
 *
 * The proxy authenticates every /api/core/* call; these tests verify the
 * ROUTE-level authorization layer (invoked directly, bypassing the proxy):
 *   1. Anonymous requests are rejected everywhere.
 *   2. CLIENT sessions get a strictly scoped bootstrap payload (own client
 *      only, no audit trail) and cannot drive ops workflows.
 *   3. CLIENT sessions cannot approve other clients' audits, and a client
 *      approval always records the SIGNED-IN identity (payload can't spoof).
 *   4. AUDITOR sessions can sync verifications but their auditorId is forced
 *      from the session — payload attribution is impossible.
 *   5. Write endpoints require team roles; client removal requires ADMIN.
 * Runs against the isolated DB copy (db/test.db).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { makeFixture, cleanupFixtures, jsonRequest, uid, type Fixture } from './helpers'
import { GET as bootstrapGET } from '@/app/api/core/bootstrap/route'
import { POST as verifyPOST } from '@/app/api/core/verify/route'
import { PATCH as exceptionsPATCH } from '@/app/api/core/exceptions/route'
import { POST as approvalsPOST } from '@/app/api/core/approvals/route'
import { POST as reportsPOST } from '@/app/api/core/reports/route'
import { POST as importPOST } from '@/app/api/core/assets/import/route'
import { POST as auditorsPOST } from '@/app/api/core/auditors/route'
import { POST as clientsPOST, DELETE as clientsDELETE } from '@/app/api/core/clients/route'

const tag = uid('rbac')
let fx: Fixture
let clientUser: { id: string; name: string; role: 'CLIENT'; clientId: string }
let auditorUser: { id: string; name: string; role: 'AUDITOR'; auditorId: string }

beforeAll(async () => {
  fx = await makeFixture()
  const cu = await db.user.create({
    data: { name: `RBAC Client ${tag}`, email: `rbac.client.${tag}@es.test`, role: 'CLIENT', passwordHash: 'x', clientId: fx.clientId },
  })
  const au = await db.user.create({
    data: { name: `RBAC Auditor ${tag}`, email: `rbac.auditor.${tag}@es.test`, role: 'AUDITOR', passwordHash: 'x', auditorId: fx.auditorId },
  })
  clientUser = { id: cu.id, name: cu.name, role: 'CLIENT', clientId: fx.clientId }
  auditorUser = { id: au.id, name: au.name, role: 'AUDITOR', auditorId: fx.auditorId }
})

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: [clientUser?.id, auditorUser?.id].filter(Boolean) } } })
  // verifications created by the auditor-override test hang off the fixture
  await cleanupFixtures()
})

// ─── 1. Anonymous requests ───────────────────────────────────────
describe('anonymous requests are rejected on every guarded route', () => {
  test('bootstrap → 401', async () => {
    const res = await bootstrapGET(await jsonRequest('http://local/api/core/bootstrap', undefined, 'GET', null))
    expect(res.status).toBe(401)
  })
  test('verify / exceptions / reports / import / auditors / clients → 403', async () => {
    const json = 'application/json'
    expect((await verifyPOST(await jsonRequest('http://local/api/core/verify', { operations: [] }, 'POST', null))).status).toBe(403)
    expect((await exceptionsPATCH(await jsonRequest('http://local/api/core/exceptions', { id: 'x', action: 'assign' }, 'PATCH', null))).status).toBe(403)
    expect((await reportsPOST(await jsonRequest('http://local/api/core/reports', { auditId: fx.auditId, action: 'generate' }, 'POST', null))).status).toBe(403)
    expect((await importPOST(await jsonRequest('http://local/api/core/assets/import', { clientId: fx.clientId, rows: [] }, 'POST', null))).status).toBe(403)
    expect((await auditorsPOST(await jsonRequest('http://local/api/core/auditors', { name: 'X', email: 'x@x.test' }, 'POST', null))).status).toBe(403)
    expect((await clientsPOST(await jsonRequest('http://local/api/core/clients', { name: 'X', industry: 'T', city: 'T', contact: 'T', email: 'x@x.test' }, 'POST', null))).status).toBe(403)
  })
  test('requireRole returns the user only for allowed roles', async () => {
    const anon = await requireRole(await jsonRequest('http://local/x', undefined, 'POST', null), ['ADMIN'])
    expect(anon).toBeNull()
    const admin = await requireRole(await jsonRequest('http://local/x', undefined, 'POST'), ['ADMIN', 'OPS'])
    expect(admin?.role).toBe('ADMIN')
  })
})

// ─── 2. CLIENT bootstrap scoping ─────────────────────────────────
describe('CLIENT sessions receive strictly scoped data', () => {
  test('bootstrap contains only their client, their audits, no audit trail', async () => {
    const res = await bootstrapGET(await jsonRequest('http://local/api/core/bootstrap', undefined, 'GET', clientUser))
    expect(res.status).toBe(200)
    const w = await res.json() as {
      clients: { id: string }[]; audits: { clientId: string }[]; assets: { clientId: string }[]
      verifications: unknown[]; auditLogs: unknown[]; locations: { clientId: string }[]
    }
    expect(w.clients).toHaveLength(1)
    expect(w.clients[0].id).toBe(fx.clientId)
    expect(w.audits.length).toBeGreaterThan(0)
    for (const a of w.audits) expect(a.clientId).toBe(fx.clientId)
    for (const a of w.assets) expect(a.clientId).toBe(fx.clientId)
    for (const l of w.locations) expect(l.clientId).toBe(fx.clientId)
    expect(w.auditLogs).toEqual([]) // the ops trail never leaves the building
    // seeded demo data (other clients) must be absent
    const names = w.clients.map((c) => c.id)
    expect(names).not.toContain('cl_mrd')
  })
})

// ─── 3. CLIENT workflow restrictions ─────────────────────────────
describe('CLIENT sessions cannot drive ops workflows', () => {
  test('verify, exceptions lifecycle, reports, import → 403', async () => {
    expect((await verifyPOST(await jsonRequest('http://local/api/core/verify', { operations: [] }, 'POST', clientUser))).status).toBe(403)
    expect((await exceptionsPATCH(await jsonRequest('http://local/api/core/exceptions', { id: 'x', action: 'assign' }, 'PATCH', clientUser))).status).toBe(403)
    expect((await reportsPOST(await jsonRequest('http://local/api/core/reports', { auditId: fx.auditId, action: 'generate' }, 'POST', clientUser))).status).toBe(403)
    expect((await importPOST(await jsonRequest('http://local/api/core/assets/import', { clientId: fx.clientId, rows: [] }, 'POST', clientUser))).status).toBe(403)
  })
  test('approvals on ANOTHER client’s audit → 403', async () => {
    const meridianAudit = await db.auditProject.findFirst({ where: { clientId: 'cl_mrd' } })
    if (!meridianAudit) return // seeded demo client absent — nothing to prove against
    const res = await approvalsPOST(await jsonRequest('http://local/api/core/approvals', {
      auditId: meridianAudit.id, decision: 'clarification', byName: 'Spoof', byRole: 'Whatever',
    }, 'POST', clientUser))
    expect(res.status).toBe(403)
  })
  test('approval on own audit records the SIGNED-IN identity, not the payload', async () => {
    const res = await approvalsPOST(await jsonRequest('http://local/api/core/approvals', {
      auditId: fx.auditId, decision: 'clarification', byName: 'Spoofed Name', byRole: 'Spoofed Role', comment: 'rbac check',
    }, 'POST', clientUser))
    expect(res.status).toBe(200)
    const approval = await db.approval.findFirst({ where: { auditId: fx.auditId }, orderBy: { at: 'desc' } })
    expect(approval?.byName).toBe(clientUser.name) // session identity wins
    expect(approval?.byRole).toContain('Client')
    const log = await db.auditLog.findFirst({ where: { entityRef: fx.auditCode, action: 'REVIEW_COMMENT' }, orderBy: { at: 'desc' } })
    expect(log?.actor).toBe(clientUser.name)
  })
})

// ─── 4. AUDITOR verification identity ────────────────────────────
describe('AUDITOR sessions', () => {
  test('cannot drive exceptions lifecycle, reports or import', async () => {
    expect((await exceptionsPATCH(await jsonRequest('http://local/api/core/exceptions', { id: 'x', action: 'assign' }, 'PATCH', auditorUser))).status).toBe(403)
    expect((await reportsPOST(await jsonRequest('http://local/api/core/reports', { auditId: fx.auditId, action: 'generate' }, 'POST', auditorUser))).status).toBe(403)
    expect((await importPOST(await jsonRequest('http://local/api/core/assets/import', { clientId: fx.clientId, rows: [] }, 'POST', auditorUser))).status).toBe(403)
  })
  test('verifications are attributed to the SESSION auditor even with a spoofed payload', async () => {
    const op = {
      operationId: `rbac-op-${tag}`, auditId: fx.auditId, assignmentId: fx.assignmentId,
      auditorId: 'adr_1', // spoof: the seeded demo auditor, NOT the session user
      assetId: fx.assetId, result: 'matched', method: 'scan', gpsLat: 12.97, gpsLng: 77.59,
      gpsStatus: 'captured', remarks: null, photos: [], createdOffline: false,
      verifiedAt: new Date().toISOString(),
    }
    const res = await verifyPOST(await jsonRequest('http://local/api/core/verify', { operations: [op] }, 'POST', auditorUser))
    expect(res.status).toBe(200)
    const body = await res.json() as { applied: number }
    expect(body.applied).toBe(1)
    const v = await db.verification.findUnique({ where: { operationId: op.operationId } })
    expect(v?.auditorId).toBe(fx.auditorId) // forced from the session, not the payload
  })
})

// ─── 5. Team-only writes & admin-only deletes ────────────────────
describe('team-only writes; client removal is ADMIN-only', () => {
  test('CLIENT removal → 403 for OPS, allowed for ADMIN on an empty client', async () => {
    const created = await clientsPOST(await jsonRequest('http://local/api/core/clients', {
      name: `RBAC Delete Co ${tag}`, industry: 'Testing', city: 'Testville', contact: 'QA', email: `rbac.del.${tag}@es.test`,
    }, 'POST')) // default jsonRequest user = platform admin
    expect(created.status).toBe(201)
    const { client } = await created.json() as { client: { id: string } }
    const { id } = client
    const opsUser = await db.user.findUnique({ where: { email: 'ops@easysourcing.in' } })
    if (opsUser) {
      const asOps = { id: opsUser.id, name: opsUser.name, role: 'OPS' as const }
      const del = await clientsDELETE(await jsonRequest(`http://local/api/core/clients?id=${id}`, undefined, 'DELETE', asOps))
      expect(del.status).toBe(403)
    }
    const del = await clientsDELETE(await jsonRequest(`http://local/api/core/clients?id=${id}`, undefined, 'DELETE'))
    expect(del.status).toBe(200)
  })
})
