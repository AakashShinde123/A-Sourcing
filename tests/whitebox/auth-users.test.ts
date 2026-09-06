/**
 * WHITE-BOX TESTS — platform access layer.
 *  1. Password policy + generator (lib/auth, pure)
 *  2. Excel/CSV shared grid parser (register-parse, pure)
 *  3. /api/auth/users route handlers invoked directly with signed session
 *     cookies — RBAC, validation, guards, audit logging.
 * Runs against the isolated DB copy (db/test.db).
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { generatePassword, passwordIssue } from '@/lib/auth'
import { signSession } from '@/lib/session'
import { parseSheetRows } from '@/modules/shared/register-parse'
import { POST as usersPOST, PATCH as usersPATCH, GET as usersGET } from '@/app/api/auth/users/route'
import { uid } from './helpers'

const tag = uid('auth')

async function adminCookie(userId: string, role = 'ADMIN'): Promise<string> {
  const token = await signSession({ uid: userId, role: role as 'ADMIN', name: 'Test Admin' }, 3600)
  return `es_session=${token}`
}

function authedReq(url: string, cookie: string, body?: unknown, method = 'POST'): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

// ─── password policy ─────────────────────────────────────────────
describe('password policy', () => {
  test('rejects short, long, and letter/number-less passwords', () => {
    expect(passwordIssue('Ab1')).toMatch(/at least 8/)
    expect(passwordIssue(undefined)).toMatch(/at least 8/)
    expect(passwordIssue('a'.repeat(129) + '1')).toMatch(/at most 128/)
    expect(passwordIssue('abcdefgh')).toMatch(/letter and one number/)
    expect(passwordIssue('12345678')).toMatch(/letter and one number/)
  })
  test('accepts solid passwords', () => {
    expect(passwordIssue('Admin@2026')).toBeNull()
    expect(passwordIssue('field-pw-123')).toBeNull()
  })
  test('generated passwords always satisfy the policy', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword()
      expect(passwordIssue(pw)).toBeNull()
      expect(pw.length).toBe(12)
    }
  })
})

// ─── Excel grid parser (shared with CSV path) ────────────────────
describe('parseSheetRows (xlsx grid)', () => {
  test('maps aliased headers and stringifies Excel numbers', () => {
    const grid = [
      ['Asset ID', 'Description', 'Category', 'Serial No', 'Qty'],
      ['FA-1', 'Air Compressor', 'Utilities', 88213, 2],
    ]
    const { rows, headerMapped } = parseSheetRows(grid as unknown as (string | number | null)[][])
    expect(headerMapped).toBe(true)
    expect(rows).toHaveLength(1)
    expect(rows[0].clientAssetId).toBe('FA-1')
    expect(rows[0].description).toBe('Air Compressor')
    expect(rows[0].category).toBe('Utilities')
    expect(rows[0].serialNumber).toBe('88213') // number cell → string
  })
  test('skips fully empty rows and trims cells', () => {
    const grid = [
      ['Asset ID', 'Description', 'Category'],
      ['FA-2', '  Lathe  ', ' Machinery '],
      ['', '', ''],
    ]
    const { rows } = parseSheetRows(grid)
    expect(rows).toHaveLength(1)
    expect(rows[0].description).toBe('Lathe')
    expect(rows[0].category).toBe('Machinery')
  })
  test('falls back to positional mapping without a recognizable header', () => {
    const grid = [['FA-3', 'Compressor', 'Utilities']]
    const { rows, headerMapped } = parseSheetRows(grid)
    expect(headerMapped).toBe(false)
    expect(rows[0].clientAssetId).toBe('FA-3')
    expect(rows[0].description).toBe('Compressor')
    expect(rows[0].category).toBe('Utilities')
  })
  test('blank sheet → no rows', () => {
    expect(parseSheetRows([['', ''], ['', '']]).rows).toHaveLength(0)
  })
})

// ─── /api/auth/users route handlers ──────────────────────────────
describe('users API (direct handler RBAC)', () => {
  let adminId: string
  let clientId: string

  test('setup: seed an admin row to sign sessions for', async () => {
    const u = await db.user.create({
      data: { name: `Admin ${tag}`, email: `admin.${tag}@es.test`, passwordHash: 'x', role: 'ADMIN' },
    })
    adminId = u.id
  })

  test('GET requires ADMIN — OPS session is 403, admin gets the list', async () => {
    const ops = await db.user.create({
      data: { name: `Ops ${tag}`, email: `ops.${tag}@es.test`, passwordHash: 'x', role: 'OPS' },
    })
    const opsReq = authedReq('http://localhost/api/auth/users', await adminCookie(ops.id, 'OPS'), undefined, 'GET')
    const opsRes = await usersGET(opsReq)
    expect(opsRes.status).toBe(403)

    const req = authedReq('http://localhost/api/auth/users', await adminCookie(adminId), undefined, 'GET')
    const res = await usersGET(req)
    expect(res.status).toBe(200)
    const body = await res.json() as { users: { email: string }[] }
    expect(body.users.some((u) => u.email === `admin.${tag}@es.test`)).toBe(true)
    await db.user.delete({ where: { id: ops.id } })
  })

  test('POST validation: weak password 400, bad role 400, duplicate email 409', async () => {
    const cookie = await adminCookie(adminId)
    const weak = await usersPOST(authedReq('http://localhost/api/auth/users', cookie, { name: 'X Y', email: `w.${tag}@es.test`, password: 'ab1', role: 'OPS' }))
    expect(weak.status).toBe(400)

    const badRole = await usersPOST(authedReq('http://localhost/api/auth/users', cookie, { name: 'X Y', email: `r.${tag}@es.test`, password: 'Valid@123', role: 'SUPERUSER' }))
    expect(badRole.status).toBe(400)

    const dup = await usersPOST(authedReq('http://localhost/api/auth/users', cookie, { name: 'X Y', email: `admin.${tag}@es.test`, password: 'Valid@123', role: 'OPS' }))
    expect(dup.status).toBe(409)
  })

  test('CLIENT role requires a clientId (400) and links when valid (201)', async () => {
    const cookie = await adminCookie(adminId)
    const noClient = await usersPOST(authedReq('http://localhost/api/auth/users', cookie, { name: 'C U', email: `c1.${tag}@es.test`, password: 'Valid@123', role: 'CLIENT' }))
    expect(noClient.status).toBe(400)

    const client = await db.client.create({
      data: { code: `TAC-${tag.slice(-8).toUpperCase()}`, name: `Auth Test Client ${tag}`, industry: 'Testing', contact: 'QA', email: `tac.${tag}@es.test`, city: 'Testville', since: new Date() },
    })
    clientId = client.id
    const ok = await usersPOST(authedReq('http://localhost/api/auth/users', cookie, { name: 'C U', email: `c2.${tag}@es.test`, password: 'Valid@123', role: 'CLIENT', clientId }))
    expect(ok.status).toBe(201)
    const body = await ok.json() as { user: { id: string; clientId: string | null } }
    expect(body.user.clientId).toBe(clientId)
    await db.user.delete({ where: { id: body.user.id } })
  })

  test('self-deactivation is blocked (409) and PASSWORD_RESET logs without leaking the hash', async () => {
    const cookie = await adminCookie(adminId)
    const self = await usersPATCH(authedReq('http://localhost/api/auth/users', cookie, { id: adminId, action: 'deactivate' }, 'PATCH'))
    expect(self.status).toBe(409)

    const target = await db.user.create({
      data: { name: `Res ${tag}`, email: `res.${tag}@es.test`, passwordHash: 'x', role: 'OPS' },
    })
    const reset = await usersPATCH(authedReq('http://localhost/api/auth/users', cookie, { id: target.id, action: 'reset-password' }, 'PATCH'))
    expect(reset.status).toBe(200)
    const body = await reset.json() as { password?: string; generated: boolean }
    expect(body.generated).toBe(true)
    expect(body.password).toMatch(/[a-zA-Z]/)
    expect(body.password).toMatch(/[0-9]/)
    expect(JSON.stringify(body)).not.toContain('passwordHash')

    const log = await db.auditLog.findFirst({ where: { action: 'PASSWORD_RESET', entityRef: `res.${tag}@es.test` } })
    expect(log).toBeTruthy()
    await db.user.delete({ where: { id: target.id } })
  })

  test('deactivating the last active admin is refused (409)', async () => {
    const cookie = await adminCookie(adminId)
    // make our actor the ONLY active admin, then try to deactivate a second
    // (inactive) admin row — the last-admin guard must still refuse it.
    const others = await db.user.findMany({ where: { role: 'ADMIN', active: true, id: { not: adminId } }, select: { id: true } })
    await db.user.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { active: false } })
    const target = await db.user.create({
      data: { name: `Last Adm ${tag}`, email: `lastadm.${tag}@es.test`, passwordHash: 'x', role: 'ADMIN', active: false },
    })
    try {
      const res = await usersPATCH(authedReq('http://localhost/api/auth/users', cookie, { id: target.id, action: 'deactivate' }, 'PATCH'))
      expect(res.status).toBe(409)
      expect(((await res.json()) as { error: string }).error).toContain('last active admin')
    } finally {
      await db.user.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { active: true } })
      await db.user.delete({ where: { id: target.id } })
    }
  })

  test('cleanup: fixture rows removed, audit trail swept', async () => {
    await db.user.deleteMany({ where: { email: { endsWith: `${tag}@es.test` } } })
    await db.auditLog.deleteMany({ where: { entityRef: { contains: tag } } })
    if (clientId) await db.client.deleteMany({ where: { id: clientId } })
    await db.user.deleteMany({ where: { id: adminId } })
  })
})

afterAll(async () => {
  // safety net in case a test bailed before cleanup
  await db.user.deleteMany({ where: { email: { contains: tag } } })
})
