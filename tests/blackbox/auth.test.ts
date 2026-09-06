/**
 * BLACK-BOX AUTH TESTS — the platform is team-only, so sign-in itself is a
 * contract. Hits the LIVE server over HTTP like a real client would.
 *
 * Covers: login success (cookie issued + /me round-trip), wrong password,
 * unknown email (no account enumeration), deactivated accounts, brute-force
 * lockout, unauthenticated Core API rejection, admin-only users API and
 * logout. Every fixture account it creates is torn down.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { db } from '@/lib/db'

const BASE = process.env.BLACKBOX_BASE_URL ?? 'http://127.0.0.1:3000'

let tag: string
let adminCookie = ''
const createdUserIds: string[] = []

async function post(path: string, body: unknown, cookie?: string): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
}

async function patch(path: string, body: unknown, cookie: string): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  })
}

function cookieOf(res: Response): string {
  return (res.headers.get('set-cookie') ?? '').split(';')[0]
}

async function adminApi(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeAll(async () => {
  tag = `bau${Date.now().toString(36)}`
  const res = await post('/api/auth/login', { email: 'admin@easysourcing.in', password: 'Admin@2026' })
  expect(res.status).toBe(200)
  adminCookie = cookieOf(res)
  expect(adminCookie).toStartWith('es_session=')
})

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  // brute-force lockout + failure records live in memory only — nothing to clean on disk
  await db.auditLog.deleteMany({ where: { entityRef: { in: [`locked.${tag}@es.test`, `ghost.${tag}@es.test`, `wrong.${tag}@es.test`, `deact.${tag}@es.test`, `newbie.${tag}@es.test`] }, action: { in: ['LOGIN_FAILED', 'LOGIN_BLOCKED'] } } })
})

describe('sign-in contract', () => {
  test('valid credentials → 200, httpOnly session cookie, /api/auth/me round-trips', async () => {
    const res = await post('/api/auth/login', { email: 'ops@easysourcing.in', password: 'Ops@2026' })
    expect(res.status).toBe(200)
    const cookie = cookieOf(res)
    expect(cookie).toStartWith('es_session=')
    expect(cookie).not.toContain('HttpOnly=false')

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie.toLowerCase()).toContain('samesite=lax')

    const body = await res.json() as { user: { email: string; role: string; name: string } }
    expect(body.user.email).toBe('ops@easysourcing.in')
    expect(body.user.role).toBe('OPS')
    expect(body.user.name).toBeTruthy()
    expect((body.user as unknown as { passwordHash?: string }).passwordHash).toBeUndefined()

    const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie } })
    expect(me.status).toBe(200)
    const meBody = await me.json() as { user: { role: string } }
    expect(meBody.user.role).toBe('OPS')
  })

  test('remember-me extends the cookie to 30 days', async () => {
    const res = await post('/api/auth/login', { email: 'ops@easysourcing.in', password: 'Ops@2026', remember: true })
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie') ?? '').toContain('Max-Age=2592000')
  })

  test('wrong password → 401 with generic message (no user enumeration)', async () => {
    const res = await post('/api/auth/login', { email: `wrong.${tag}@es.test`, password: 'not-the-password' })
    expect(res.status).toBe(401)
    expect(((await res.json()) as { error: string }).error).toBe('Invalid email or password')
  })

  test('unknown email → 401 with the SAME generic message', async () => {
    const res = await post('/api/auth/login', { email: `ghost.${tag}@es.test`, password: 'whatever123' })
    expect(res.status).toBe(401)
    expect(((await res.json()) as { error: string }).error).toBe('Invalid email or password')
  })

  test('malformed bodies → 400 JSON, never 500', async () => {
    expect((await post('/api/auth/login', { password: 'x@y.z' })).status).toBe(400)
    expect((await post('/api/auth/login', { email: 'x@y.z' })).status).toBe(400)
    const badJson = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' })
    expect(badJson.status).toBe(400)
  })

  test('five consecutive failures lock the account (429) — correct password would not be tried', async () => {
    const email = `locked.${tag}@es.test`
    for (let i = 0; i < 5; i++) {
      const res = await post('/api/auth/login', { email, password: `wrong-${i}` })
      expect(res.status).toBe(401)
    }
    const locked = await post('/api/auth/login', { email, password: 'even-if-correct-123' })
    expect(locked.status).toBe(429)
    expect(locked.headers.get('Retry-After')).toBeTruthy()
    expect(((await locked.json()) as { error: string }).error).toContain('locked')
  })
})

describe('team-only Core API', () => {
  test('no session → /api/core/bootstrap 401 with JSON error', async () => {
    const res = await fetch(`${BASE}/api/core/bootstrap`)
    expect(res.status).toBe(401)
    expect(((await res.json()) as { error: string }).error).toContain('Authentication required')
  })

  test('no session → /api/core/registry 401 (topology is private too)', async () => {
    expect((await fetch(`${BASE}/api/core/registry`)).status).toBe(401)
  })

  test('garbage cookie → 401', async () => {
    const res = await fetch(`${BASE}/api/core/bootstrap`, { headers: { cookie: 'es_session=forged.token.value' } })
    expect(res.status).toBe(401)
  })
})

describe('account lifecycle over the wire (admin only)', () => {
  let clientId: string

  test('non-admin account cannot read or write the users API', async () => {
    const client = await db.client.create({ data: { code: `BBA-${tag}`, name: `BB Auth Client ${tag}`, industry: 'Testing', contact: 'QA', email: `bbac.${tag}@es.test`, city: 'Testville', since: new Date() } })
    clientId = client.id

    const clientLogin = await post('/api/auth/login', { email: 'client@easysourcing.in', password: 'Client@2026' })
    const clientCookie = cookieOf(clientLogin)
    expect((await fetch(`${BASE}/api/auth/users`, { headers: { cookie: clientCookie } })).status).toBe(403)
    expect((await patch('/api/auth/users', { id: 'anything', action: 'deactivate' }, clientCookie)).status).toBe(403)
  })

  test('admin creates an account → that account can sign in immediately', async () => {
    const create = await adminApi('POST', '/api/auth/users', { name: 'BB Newbie', email: `newbie.${tag}@es.test`, password: 'Newbie@123', role: 'CLIENT', clientId })
    expect(create.status).toBe(201)
    const { user } = await create.json() as { user: { id: string } }
    createdUserIds.push(user.id)

    const res = await post('/api/auth/login', { email: `newbie.${tag}@es.test`, password: 'Newbie@123' })
    expect(res.status).toBe(200)
    const body = await res.json() as { user: { clientId: string | null } }
    expect(body.user.clientId).toBe(clientId)
  })

  test('password policy enforced (weak → 400, no letter/number → 400)', async () => {
    const short = await adminApi('POST', '/api/auth/users', { name: 'BB Shorty', email: `short.${tag}@es.test`, password: 'ab1', role: 'OPS' })
    expect(short.status).toBe(400)
    const noNumber = await adminApi('POST', '/api/auth/users', { name: 'BB NoNum', email: `nonum.${tag}@es.test`, password: 'abcdefgh', role: 'OPS' })
    expect(noNumber.status).toBe(400)
  })

  test('duplicate email → 409; bad role → 400', async () => {
    const dup = await adminApi('POST', '/api/auth/users', { name: 'BB Dup', email: 'ops@easysourcing.in', password: 'Whatever@1', role: 'OPS' })
    expect(dup.status).toBe(409)
    const badRole = await adminApi('POST', '/api/auth/users', { name: 'BB Role', email: `role.${tag}@es.test`, password: 'Whatever@1', role: 'SUPERUSER' })
    expect(badRole.status).toBe(400)
  })

  test('deactivated account: sessions die (me → 401) and login is blocked (403)', async () => {
    const create = await adminApi('POST', '/api/auth/users', { name: 'BB Deact', email: `deact.${tag}@es.test`, password: 'Deact@1234', role: 'OPS' })
    expect(create.status).toBe(201)
    const { user } = await create.json() as { user: { id: string } }
    createdUserIds.push(user.id)

    const login1 = await post('/api/auth/login', { email: `deact.${tag}@es.test`, password: 'Deact@1234' })
    expect(login1.status).toBe(200)
    const cookie = cookieOf(login1)
    expect((await fetch(`${BASE}/api/auth/me`, { headers: { cookie } })).status).toBe(200)

    const deact = await adminApi('PATCH', '/api/auth/users', { id: user.id, action: 'deactivate' })
    expect(deact.status).toBe(200)

    // open session must stop working — /me re-checks the DB, not just the token
    expect((await fetch(`${BASE}/api/auth/me`, { headers: { cookie } })).status).toBe(401)
    // and even valid credentials are refused
    const login2 = await post('/api/auth/login', { email: `deact.${tag}@es.test`, password: 'Deact@1234' })
    expect(login2.status).toBe(403)
  })

  test('admin cannot deactivate themselves; last-active-admin is protected', async () => {
    const meRes = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: adminCookie } })
    const { user } = await meRes.json() as { user: { id: string } }
    const self = await adminApi('PATCH', '/api/auth/users', { id: user.id, action: 'deactivate' })
    expect(self.status).toBe(409)
    expect(((await self.json()) as { error: string }).error).toContain('own account')
  })

  test('reset-password: admin gets a generated password that works', async () => {
    const create = await adminApi('POST', '/api/auth/users', { name: 'BB Reset', email: `reset.${tag}@es.test`, password: 'FirstPass@1', role: 'OPS' })
    const { user } = await create.json() as { user: { id: string } }
    createdUserIds.push(user.id)

    const reset = await adminApi('PATCH', '/api/auth/users', { id: user.id, action: 'reset-password' })
    expect(reset.status).toBe(200)
    const { password } = await reset.json() as { password: string }
    expect(password).toMatch(/[a-zA-Z]/)
    expect(password).toMatch(/[0-9]/)
    expect(password.length).toBeGreaterThanOrEqual(8)

    // old password dead, new one live
    expect((await post('/api/auth/login', { email: `reset.${tag}@es.test`, password: 'FirstPass@1' })).status).toBe(401)
    expect((await post('/api/auth/login', { email: `reset.${tag}@es.test`, password })).status).toBe(200)
  })
})

describe('logout', () => {
  test('logout clears the session cookie (stateless JWT contract)', async () => {
    const login = await post('/api/auth/login', { email: 'ops@easysourcing.in', password: 'Ops@2026' })
    const cookie = cookieOf(login)
    expect((await fetch(`${BASE}/api/auth/me`, { headers: { cookie } })).status).toBe(200)

    const out = await post('/api/auth/logout', {}, cookie)
    expect(out.status).toBe(200)
    // the server answers by expiring the cookie on the client…
    const setCookie = (out.headers.get('set-cookie') ?? '').toLowerCase()
    expect(setCookie).toContain('es_session=')
    expect(setCookie).toContain('max-age=0')
    // …and a browser that obeyed it (no cookie at all) is unauthorized again
    expect((await fetch(`${BASE}/api/auth/me`)).status).toBe(401)
  })
})
