/**
 * Whitebox — /api/core/audits (audit project creation + field-team assignment).
 *
 * Covers the full planning contract the Ops Portal and the mobile app depend on:
 *   POST  create draft project (validation, defaults, code allocation)
 *   PATCH assign    → publishes a scope, auto-links location assets, wakes drafts
 *   PATCH advance   → lifecycle state machine (+409 at archived)
 *   PATCH unassign  → releases assets, keeps verification history
 *   RBAC            → team-only writes (CLIENT / anonymous rejected)
 */
import { afterAll, describe, expect, test } from 'bun:test'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { POST as auditsPOST, PATCH as auditsPATCH } from '@/app/api/core/audits/route'
import { cleanupFixtures, jsonRequest, makeFixture, uid, type Fixture } from './helpers'

let fx: Fixture
let locationId: string
const extraAssetIds: string[] = []
let adminUserId: string, opsUserId: string, clientUserId: string
const createdAuditIds: string[] = []

async function seedRoleUsers() {
  const hash = await bcrypt.hash('x', 4)
  adminUserId = (await db.user.create({ data: { name: `Admin ${uid('a')}`, email: `ad.${uid('a')}@es.test`, passwordHash: hash, role: 'ADMIN' } })).id
  opsUserId = (await db.user.create({ data: { name: `Ops ${uid('o')}`, email: `op.${uid('o')}@es.test`, passwordHash: hash, role: 'OPS' } })).id
  clientUserId = (await db.user.create({ data: { name: `Cli ${uid('c')}`, email: `cl.${uid('c')}@es.test`, passwordHash: hash, role: 'CLIENT' } })).id
}

describe('audits API (direct handler)', () => {
  test('setup: fixture + location with unassigned assets + role users', async () => {
    fx = await makeFixture({ assetCount: 1 })
    const loc = await db.location.create({
      data: { clientId: fx.clientId, level: 'building', name: `Test Block ${uid('L')}`, code: `TBLK-${uid('l').slice(-6).toUpperCase()}` },
    })
    locationId = loc.id
    for (let i = 0; i < 3; i++) {
      const a = await db.asset.create({
        data: {
          clientId: fx.clientId, code: `ES-TST-${uid('x').slice(-8).toUpperCase()}-${i}`, clientAssetId: `CAL-${i}`,
          description: `Unassigned test asset ${i}`, category: 'Test', status: 'active', locationId,
        },
      })
      extraAssetIds.push(a.id)
    }
    await seedRoleUsers()
  })

  test('POST creates a draft project with sensible defaults (code, FY, locations label)', async () => {
    const res = await auditsPOST(await jsonRequest('http://localhost/api/core/audits', {
      clientId: fx.clientId, name: 'QA Annual Verification', type: 'Annual Physical Verification',
    }))
    expect(res.status).toBe(201)
    const body = await res.json() as { audit: { id: string; code: string; status: string; financialYear: string; locationsLabel: string; totalInScope: number } }
    createdAuditIds.push(body.audit.id)
    expect(body.audit.code).toMatch(/^AUD-\d{4}-\d{3}$/)
    expect(body.audit.status).toBe('draft')
    expect(body.audit.financialYear).toMatch(/^FY \d{4}-\d{2}$/)
    expect(body.audit.totalInScope).toBe(0)
  })

  test('POST validation: bad type 400, unknown client 404, missing name 400', async () => {
    const badType = await auditsPOST(await jsonRequest('http://localhost/api/core/audits', { clientId: fx.clientId, name: 'X project', type: 'Quantum Audit' }))
    expect(badType.status).toBe(400)

    const noClient = await auditsPOST(await jsonRequest('http://localhost/api/core/audits', { clientId: 'cl_missing', name: 'X project', type: 'Special Audit' }))
    expect(noClient.status).toBe(404)

    const noName = await auditsPOST(await jsonRequest('http://localhost/api/core/audits', { clientId: fx.clientId, name: '  ', type: 'Special Audit' }))
    expect(noName.status).toBe(400)
  })

  test('RBAC: CLIENT session and anonymous calls are rejected on POST and PATCH', async () => {
    const clientRes = await auditsPOST(await jsonRequest('http://localhost/api/core/audits', { clientId: fx.clientId, name: 'Sneaky project', type: 'Special Audit' }, 'POST', { id: clientUserId, name: 'Cli', role: 'CLIENT', clientId: fx.clientId }))
    expect(clientRes.status).toBe(403)

    const anonRes = await auditsPOST(await jsonRequest('http://localhost/api/core/audits', { clientId: fx.clientId, name: 'Anon project', type: 'Special Audit' }, 'POST', null))
    expect(anonRes.status).toBe(403)

    const anonAssign = await auditsPATCH(await jsonRequest('http://localhost/api/core/audits', { id: fx.auditId, action: 'advance' }, 'PATCH', null))
    expect(anonAssign.status).toBe(403)
  })

  test('PATCH assign publishes a scope, auto-links the location assets and wakes a draft', async () => {
    // create a fresh draft for the draft → planning assertion
    const created = await auditsPOST(await jsonRequest('http://localhost/api/core/audits', {
      clientId: fx.clientId, name: 'QA Assignment Flow', type: 'Fixed Asset Verification',
    }))
    const draft = await created.json() as { audit: { id: string } }
    createdAuditIds.push(draft.audit.id)

    const res = await auditsPATCH(await jsonRequest('http://localhost/api/core/audits', {
      id: draft.audit.id, action: 'assign', auditorId: fx.auditorId, locationId, scope: 'Test Block A — QA Assignment Flow',
    }, 'PATCH'))
    expect(res.status).toBe(201)
    const body = await res.json() as { assignment: { id: string; scope: string }; attached: number; totalInScope: number }
    expect(body.attached).toBe(3) // the three unassigned assets at the location
    expect(body.totalInScope).toBe(3) // all assets now joined to THIS audit via assignments

    const audit = await db.auditProject.findUnique({ where: { id: draft.audit.id } })
    expect(audit?.status).toBe('planning') // draft woke up on first published scope

    // the auditor's own device view (bootstrap scoping) now includes the scope
    const mine = await db.auditAssignment.findMany({ where: { auditorId: fx.auditorId, auditId: draft.audit.id } })
    expect(mine).toHaveLength(1)
    expect(mine[0].scope).toContain('Test Block A')
  })

  test('PATCH assign rejects a location from another client (400)', async () => {
    const otherClient = await db.client.create({
      data: { code: `TOC-${uid('oc').slice(-8).toUpperCase()}`, name: `Other Client ${uid('oc')}`, industry: 'Testing', contact: 'QA', email: `toc.${uid('oc')}@es.test`, city: 'Testville', since: new Date() },
    })
    const otherLoc = await db.location.create({
      data: { clientId: otherClient.id, level: 'building', name: `Other Block ${uid('OB')}`, code: `OBLK-${uid('ob').slice(-6).toUpperCase()}` },
    })
    const res = await auditsPATCH(await jsonRequest('http://localhost/api/core/audits', {
      id: createdAuditIds[0], action: 'assign', auditorId: fx.auditorId, locationId: otherLoc.id,
    }, 'PATCH'))
    expect(res.status).toBe(400)
    await db.location.delete({ where: { id: otherLoc.id } })
    await db.client.delete({ where: { id: otherClient.id } })
  })

  test('PATCH advance walks the lifecycle and refuses to move past archived', async () => {
    const r1 = await auditsPATCH(await jsonRequest('http://localhost/api/core/audits', { id: createdAuditIds[0], action: 'advance' }, 'PATCH'))
    expect(r1.status).toBe(200)
    expect(((await r1.json()) as { audit: { status: string } }).audit.status).toBe('planning')

    const r2 = await auditsPATCH(await jsonRequest('http://localhost/api/core/audits', { id: createdAuditIds[0], action: 'advance' }, 'PATCH'))
    expect(((await r2.json()) as { audit: { status: string } }).audit.status).toBe('ready')

    const archived = await makeFixture({ auditStatus: 'archived' })
    const blocked = await auditsPATCH(await jsonRequest('http://localhost/api/core/audits', { id: archived.auditId, action: 'advance' }, 'PATCH'))
    expect(blocked.status).toBe(409)
  })

  test('PATCH unassign releases assets, keeps verifications and recomputes scope', async () => {
    // one verification hangs off the fixture assignment → history must survive
    const asg = await db.auditAssignment.create({
      data: { auditId: createdAuditIds[0], auditorId: fx.auditorId, locationId, scope: 'Withdraw me', status: 'assigned' },
    })
    await db.asset.updateMany({ where: { id: { in: extraAssetIds } }, data: { assignmentId: asg.id } })
    await db.verification.create({
      data: {
        operationId: `op-${uid('v')}`, auditId: createdAuditIds[0], assignmentId: asg.id, assetId: extraAssetIds[0],
        auditorId: fx.auditorId, result: 'matched', method: 'scan', verifiedAt: new Date(),
      },
    })

    const res = await auditsPATCH(await jsonRequest('http://localhost/api/core/audits', { id: createdAuditIds[0], action: 'unassign', assignmentId: asg.id }, 'PATCH'))
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; totalInScope: number }
    expect(body.ok).toBe(true)

    const detached = await db.asset.findMany({ where: { id: { in: extraAssetIds } } })
    expect(detached.every((a) => a.assignmentId === null)).toBe(true)

    const gone = await db.auditAssignment.findUnique({ where: { id: asg.id } })
    expect(gone).toBeNull()

    const verif = await db.verification.findFirst({ where: { auditId: createdAuditIds[0] } })
    expect(verif?.assignmentId).toBeNull() // history kept, live link broken

    // scope recomputed — this audit holds no assets anymore
    expect(body.totalInScope).toBe(0)
  })

  test('PATCH unknown action → 400, unknown ids → 404', async () => {
    const badAction = await auditsPATCH(await jsonRequest('http://localhost/api/core/audits', { id: createdAuditIds[0], action: 'explode' }, 'PATCH'))
    expect(badAction.status).toBe(400)

    const noAudit = await auditsPATCH(await jsonRequest('http://localhost/api/core/audits', { id: 'aus_missing', action: 'advance' }, 'PATCH'))
    expect(noAudit.status).toBe(404)
  })

  test('every planning action landed in the immutable audit trail', async () => {
    const logs = await db.auditLog.findMany({ where: { entity: { in: ['AuditProject', 'AuditAssignment'] }, OR: [{ entityRef: { startsWith: 'AUD-' } }, { action: { startsWith: 'SCOPE_' } }] } })
    const actions = new Set(logs.map((l) => l.action))
    for (const a of ['AUDIT_CREATED', 'SCOPE_ASSIGNED', 'SCOPE_WITHDRAWN', 'AUDIT_STAGE']) expect(actions.has(a)).toBe(true)
  })

  afterAll(async () => {
    await db.verification.deleteMany({ where: { auditId: { in: createdAuditIds } } })
    await db.asset.deleteMany({ where: { id: { in: extraAssetIds } } })
    await db.location.deleteMany({ where: { id: { in: [locationId].filter(Boolean) } } })
    await db.auditAssignment.deleteMany({ where: { auditId: { in: createdAuditIds } } })
    await db.auditProject.deleteMany({ where: { id: { in: createdAuditIds } } })
    await db.auditLog.deleteMany({ where: { OR: [{ entityRef: { startsWith: 'AUD-' } }, { action: { startsWith: 'SCOPE_' } }, { action: { startsWith: 'AUDIT_' } }] } })
    await db.user.deleteMany({ where: { id: { in: [adminUserId, opsUserId, clientUserId].filter(Boolean) } } })
    await cleanupFixtures()
  })
})
