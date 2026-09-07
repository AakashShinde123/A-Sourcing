/**
 * WHITE-BOX INTEGRATION TESTS — /api/core/auditors + /api/core/clients
 * Team & client management: creation with auto-allocated codes, uniqueness,
 * history/data guards on delete, status lifecycle and audit-trail entries.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { POST as auditorsPOST, PATCH as auditorsPATCH, DELETE as auditorsDELETE } from '@/app/api/core/auditors/route'
import { POST as clientsPOST, PATCH as clientsPATCH, DELETE as clientsDELETE } from '@/app/api/core/clients/route'
import { db } from '@/lib/db'
import { cleanupFixtures, jsonRequest, type Fixture } from './helpers'
import { NextRequest } from 'next/server'

let fx: Fixture
const createdAuditorIds: string[] = []
const createdClientIds: string[] = []

afterAll(async () => {
  await db.auditor.deleteMany({ where: { id: { in: createdAuditorIds } } })
  await db.clientUser.deleteMany({ where: { clientId: { in: createdClientIds } } })
  await db.client.deleteMany({ where: { id: { in: createdClientIds } } })
  await db.auditLog.deleteMany({ where: { action: { in: ['TEAM_MEMBER_ADDED', 'TEAM_MEMBER_STATUS', 'TEAM_MEMBER_REMOVED', 'CLIENT_ADDED', 'CLIENT_STATUS', 'CLIENT_REMOVED'] }, entityRef: { in: ['QA-ADD', 'QA-CLI', 'QA-DEL'] } } })
  await cleanupFixtures()
})

const deleteReq = (url: string) => jsonRequest(url, undefined, 'DELETE')

describe('POST /api/core/auditors — add team member', () => {
  test('creates member with auto ES-EMP code, available status and audit-trail entry', async () => {
    const res = await auditorsPOST(await jsonRequest('http://local/api/core/auditors', { name: 'QA Add Member', email: 'qa.add@es.test', city: 'Testville' }))
    expect(res.status).toBe(201)
    const { auditor } = await res.json() as { auditor: { id: string; employeeCode: string; status: string; colorSeed: string } }
    createdAuditorIds.push(auditor.id)
    expect(auditor.employeeCode).toMatch(/^ES-EMP-\d{3}$/)
    expect(auditor.status).toBe('available')
    expect(auditor.colorSeed.length).toBeGreaterThan(3)
    const log = await db.auditLog.findFirst({ where: { action: 'TEAM_MEMBER_ADDED', entityRef: auditor.employeeCode } })
    expect(log).not.toBeNull()
  })

  test('trims whitespace and lowercases email; optional fields may be absent', async () => {
    const res = await auditorsPOST(await jsonRequest('http://local/api/core/auditors', { name: '  Trimmed Name  ', email: '  QA.TRIM@ES.TEST ' }))
    expect(res.status).toBe(201)
    const { auditor } = await res.json() as { auditor: { id: string; email: string; name: string } }
    createdAuditorIds.push(auditor.id)
    expect(auditor.email).toBe('qa.trim@es.test')
    expect(auditor.name).toBe('Trimmed Name')
  })

  test('rejects missing/invalid fields with 400', async () => {
    expect((await auditorsPOST(await jsonRequest('http://local/api/core/auditors', { email: 'x@y.z' }))).status).toBe(400)
    expect((await auditorsPOST(await jsonRequest('http://local/api/core/auditors', { name: 'No Email' }))).status).toBe(400)
    expect((await auditorsPOST(await jsonRequest('http://local/api/core/auditors', { name: 'Bad Email', email: 'not-an-email' }))).status).toBe(400)
  })

  test('rejects duplicate email (case-insensitive) with 409', async () => {
    const res = await auditorsPOST(await jsonRequest('http://local/api/core/auditors', { name: 'Dup', email: 'QA.ADD@es.test' }))
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/core/auditors — status lifecycle', () => {
  test('flips status available → offline → available and logs transitions', async () => {
    const created = await (await auditorsPOST(await jsonRequest('http://local/api/core/auditors', { name: 'QA Status Member', email: 'qa.status@es.test' }))).json() as { auditor: { id: string } }
    createdAuditorIds.push(created.auditor.id)
    const off = await auditorsPATCH(await jsonRequest('http://local/api/core/auditors', { id: created.auditor.id, status: 'offline' }))
    expect(off.status).toBe(200)
    expect(((await off.json()) as { auditor: { status: string } }).auditor.status).toBe('offline')
    const back = await auditorsPATCH(await jsonRequest('http://local/api/core/auditors', { id: created.auditor.id, status: 'available' }))
    expect(((await back.json()) as { auditor: { status: string } }).auditor.status).toBe('available')
    const logs = await db.auditLog.findMany({ where: { action: 'TEAM_MEMBER_STATUS', detail: { contains: 'QA Status Member' } } })
    expect(logs.length).toBe(2)
  })

  test('rejects invalid status and unknown id', async () => {
    expect((await auditorsPATCH(await jsonRequest('http://local/api/core/auditors', { id: 'nope', status: 'available' }))).status).toBe(404)
    const any = await db.auditor.findFirst({ where: { id: { in: createdAuditorIds } } })
    expect((await auditorsPATCH(await jsonRequest('http://local/api/core/auditors', { id: any!.id, status: 'flying' }))).status).toBe(400)
  })
})

describe('DELETE /api/core/auditors — history guard', () => {
  test('member with verifications/assignments → 409 hasHistory, row kept', async () => {
    fx = await import('./helpers').then((m) => m.makeFixture({ assetCount: 1 }))
    const res = await auditorsDELETE(await deleteReq(`http://local/api/core/auditors?id=${fx.auditorId}`))
    expect(res.status).toBe(409)
    const data = await res.json() as { hasHistory: boolean; verifications: number; assignments: number }
    expect(data.hasHistory).toBe(true)
    expect(data.verifications + data.assignments).toBeGreaterThan(0)
    expect(await db.auditor.findUnique({ where: { id: fx.auditorId } })).not.toBeNull()
  })

  test('clean member is deleted and leaves a TEAM_MEMBER_REMOVED entry', async () => {
    const created = await (await auditorsPOST(await jsonRequest('http://local/api/core/auditors', { name: 'QA Delete Me', email: 'qa.del@es.test' }))).json() as { auditor: { id: string; employeeCode: string } }
    const res = await auditorsDELETE(await deleteReq(`http://local/api/core/auditors?id=${created.auditor.id}`))
    expect(res.status).toBe(200)
    expect(((await res.json()) as { removed: string }).removed).toBe(created.auditor.employeeCode)
    expect(await db.auditor.findUnique({ where: { id: created.auditor.id } })).toBeNull()
    expect(await db.auditLog.findFirst({ where: { action: 'TEAM_MEMBER_REMOVED', entityRef: created.auditor.employeeCode } })).not.toBeNull()
  })

  test('missing id / unknown id → 400 / 404', async () => {
    expect((await auditorsDELETE(await deleteReq('http://local/api/core/auditors'))).status).toBe(400)
    expect((await auditorsDELETE(await deleteReq('http://local/api/core/auditors?id=nope'))).status).toBe(404)
  })
})

describe('POST /api/core/clients — onboard client', () => {
  test('creates client with derived unique code, onboarding status and portal admin user', async () => {
    const res = await clientsPOST(await jsonRequest('http://local/api/core/clients', { name: 'QA Clients Ltd', industry: 'Testing', city: 'Testville', contact: 'QA Lead', email: 'qa.client@es.test' }))
    expect(res.status).toBe(201)
    const { client } = await res.json() as { client: { id: string; code: string; status: string; users: { name: string; role: string }[] } }
    createdClientIds.push(client.id)
    expect(client.code).toMatch(/^[A-Z0-9-]{2,8}$/)
    expect(client.status).toBe('onboarding')
    expect(client.users).toHaveLength(1)
    expect(client.users[0].role).toBe('Client Admin')
    const log = await db.auditLog.findFirst({ where: { action: 'CLIENT_ADDED', entityRef: client.code } })
    expect(log).not.toBeNull()
  })

  test('code collision falls back to suffixed unique code', async () => {
    const second = await clientsPOST(await jsonRequest('http://local/api/core/clients', { name: 'QA Clients Pvt Ltd', industry: 'Testing', city: 'Testville', contact: 'QA Two', email: 'qa.client2@es.test' }))
    expect(second.status).toBe(201)
    const { client } = await second.json() as { client: { id: string; code: string } }
    createdClientIds.push(client.id)
    expect(client.code.startsWith('QAC')).toBe(true)
    expect(client.code).not.toBe('QAC'.slice(0, 3) && 'QAC')
  })

  test('rejects missing/invalid fields with 400', async () => {
    expect((await clientsPOST(await jsonRequest('http://local/api/core/clients', { name: 'X' }))).status).toBe(400)
    expect((await clientsPOST(await jsonRequest('http://local/api/core/clients', { name: 'X Co', industry: 'Y', city: 'Z', contact: 'P', email: 'bad' }))).status).toBe(400)
  })
})

describe('PATCH + DELETE /api/core/clients — lifecycle and data guard', () => {
  test('pause → paused, reactivate → active, CLIENT_STATUS logged', async () => {
    const created = await (await clientsPOST(await jsonRequest('http://local/api/core/clients', { name: 'QA Pause Co', industry: 'Testing', city: 'Testville', contact: 'QA P', email: 'qa.pause@es.test' }))).json() as { client: { id: string } }
    createdClientIds.push(created.client.id)
    const paused = await clientsPATCH(await jsonRequest('http://local/api/core/clients', { id: created.client.id, status: 'paused' }))
    expect(((await paused.json()) as { client: { status: string } }).client.status).toBe('paused')
    const active = await clientsPATCH(await jsonRequest('http://local/api/core/clients', { id: created.client.id, status: 'active' }))
    expect(((await active.json()) as { client: { status: string } }).client.status).toBe('active')
    expect((await clientsPATCH(await jsonRequest('http://local/api/core/clients', { id: created.client.id, status: 'gone' }))).status).toBe(400)
    expect((await db.auditLog.findMany({ where: { action: 'CLIENT_STATUS', detail: { contains: 'QA Pause Co' } } })).length).toBe(2)
  })

  test('client with operational data → 409 hasData, row kept', async () => {
    fx = fx ?? await import('./helpers').then((m) => m.makeFixture({ assetCount: 1 }))
    const res = await clientsDELETE(await deleteReq(`http://local/api/core/clients?id=${fx.clientId}`))
    expect(res.status).toBe(409)
    const data = await res.json() as { hasData: boolean; assets: number }
    expect(data.hasData).toBe(true)
    expect(data.assets).toBeGreaterThan(0)
    expect(await db.client.findUnique({ where: { id: fx.clientId } })).not.toBeNull()
  })

  test('empty client is deleted together with its portal users', async () => {
    const created = await (await clientsPOST(await jsonRequest('http://local/api/core/clients', { name: 'QA Delete Co', industry: 'Testing', city: 'Testville', contact: 'QA D', email: 'qa.del@es.test' }))).json() as { client: { id: string; code: string } }
    const usersBefore = await db.clientUser.count({ where: { clientId: created.client.id } })
    expect(usersBefore).toBe(1)
    const res = await clientsDELETE(await deleteReq(`http://local/api/core/clients?id=${created.client.id}`))
    expect(res.status).toBe(200)
    expect(await db.client.findUnique({ where: { id: created.client.id } })).toBeNull()
    expect(await db.clientUser.count({ where: { clientId: created.client.id } })).toBe(0)
    expect(await db.auditLog.findFirst({ where: { action: 'CLIENT_REMOVED', entityRef: created.client.code } })).not.toBeNull()
    createdClientIds.splice(createdClientIds.indexOf(created.client.id), 1)
  })

  test('missing id / unknown id → 400 / 404', async () => {
    expect((await clientsDELETE(await deleteReq('http://local/api/core/clients'))).status).toBe(400)
    expect((await clientsDELETE(await deleteReq('http://local/api/core/clients?id=nope'))).status).toBe(404)
  })
})
