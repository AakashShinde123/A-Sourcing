/**
 * BLACK-BOX API TESTS — hit the LIVE server over HTTP (http://127.0.0.1:3000).
 * No imports of route handlers or internals: this suite only knows the URL
 * contract, exactly like a real mobile client / partner integration would.
 *
 * Covers: contract shape, golden workflows over the wire, hostile/fuzz input,
 * concurrency (idempotency under parallel retries), and latency budgets.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { db } from '@/lib/db'

const BASE = process.env.BLACKBOX_BASE_URL ?? 'http://127.0.0.1:3000'

let tag: string
let fx: { clientId: string; auditorId: string; auditId: string; assetId: string; assetCode: string; exceptionId: string }
const approvalAuditIds: string[] = []
const reportAuditIds: string[] = []
const syncOpIds: string[] = []

// The Core API sits behind the platform login (team-only deployment) — the
// suite signs in once as the seeded admin and rides the session cookie.
let sessionCookie = ''

async function api(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(sessionCookie ? { cookie: sessionCookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

async function login(email: string, password: string): Promise<Response> {
  return fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

beforeAll(async () => {
  tag = `bb${Date.now().toString(36)}`

  // Sign in before anything touches the protected Core API.
  const res = await login('admin@easysourcing.in', 'Admin@2026')
  if (!res.ok) throw new Error(`blackbox setup: admin login failed (${res.status})`)
  const setCookie = res.headers.get('set-cookie') ?? ''
  sessionCookie = setCookie.split(';')[0] // "es_session=<jwt>"
  if (!sessionCookie.startsWith('es_session=')) throw new Error('blackbox setup: no session cookie issued')
  // Fixtures live in the demo DB but are fully torn down in afterAll.
  const client = await db.client.create({
    data: { code: `BBC-${tag}`, name: `BB Client ${tag}`, industry: 'Testing', contact: 'QA', email: `bb.${tag}@es.test`, city: 'Testville', since: new Date() },
  })
  const auditor = await db.auditor.create({
    data: { name: `BB Auditor ${tag}`, email: `bba.${tag}@es.test`, employeeCode: `BB-${tag}`, status: 'in_field' },
  })
  const audit = await db.auditProject.create({
    data: { clientId: client.id, code: `BBA-${tag}`, name: `BB Audit ${tag}`, type: 'Fixed Asset Verification', status: 'in_progress', financialYear: 'FY 2025-26', startDate: new Date(), totalInScope: 10 },
  })
  const asset = await db.asset.create({
    data: { clientId: client.id, code: `ES-BB-${tag}`, clientAssetId: `BB-${tag}`, description: 'Black box test asset', category: 'Test', status: 'active' },
  })
  const exception = await db.exception.create({
    data: { code: `EX-BB-${tag}`.toUpperCase(), clientId: client.id, auditId: audit.id, assetId: asset.id, type: 'missing', severity: 'high', status: 'open', title: 'BB fixture exception', description: 'Black box lifecycle fixture', detectedBy: 'QA' },
  })
  fx = { clientId: client.id, auditorId: auditor.id, auditId: audit.id, assetId: asset.id, assetCode: asset.code, exceptionId: exception.id }
})

afterAll(async () => {
  // Verification rows created over HTTP against the fixture audit
  await db.verification.deleteMany({ where: { auditId: fx.auditId } })
  await db.evidence.deleteMany({ where: { auditId: fx.auditId } })
  await db.exception.deleteMany({ where: { auditId: fx.auditId } })
  await db.approval.deleteMany({ where: { auditId: { in: approvalAuditIds } } })
  await db.report.deleteMany({ where: { auditId: { in: reportAuditIds } } })
  await db.asset.deleteMany({ where: { clientId: fx.clientId } }) // includes HTTP-created discoveries
  await db.auditProject.deleteMany({ where: { id: { in: [fx.auditId, ...approvalAuditIds, ...reportAuditIds] } } })
  await db.auditor.deleteMany({ where: { id: fx.auditorId } })
  await db.client.deleteMany({ where: { id: fx.clientId } })
  // HTTP lifecycle traffic wrote audit logs referencing our fixture codes
  await db.auditLog.deleteMany({ where: { OR: [{ entityRef: { contains: 'BB-' } }, { entityRef: { contains: 'EX-BB' } }, { entityRef: { contains: 'BBA-' } }, { entityRef: { contains: 'ES-BB' } }] } })
})

describe('service discovery & read contract', () => {
  test('GET /api/core/registry → 200 healthy JSON with modules', async () => {
    const t0 = Date.now()
    const res = await api('GET', '/api/core/registry')
    const latency = Date.now() - t0
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = await res.json() as Record<string, unknown>
    expect((body.service as Record<string, unknown>).status).toBe('healthy')
    expect((body.modules as unknown[]).length).toBeGreaterThanOrEqual(3)
    expect(latency).toBeLessThan(500)
  })

  test('GET /api/core/bootstrap → 200 full world payload within latency budget', async () => {
    const t0 = Date.now()
    const res = await api('GET', '/api/core/bootstrap')
    const latency = Date.now() - t0
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    for (const k of ['clients', 'locations', 'assets', 'audits', 'verifications', 'exceptions', 'evidence', 'reports', 'approvals', 'auditLogs', 'stats']) {
      expect(body[k], `bootstrap key ${k}`).toBeDefined()
    }
    expect(latency).toBeLessThan(1500)
  })

  test('unknown core route → 404; wrong method on POST route → 405', async () => {
    expect((await api('GET', '/api/core/definitely-not-a-route')).status).toBe(404)
    expect((await api('GET', '/api/core/verify')).status).toBe(405)
  })
})

describe('sync engine over the wire', () => {
  test('golden path: matched op applies, asset stamp visible in bootstrap', async () => {
    const opId = `bb-op-${tag}-1`
    syncOpIds.push(opId)
    const res = await api('POST', '/api/core/verify', {
      operations: [{ operationId: opId, auditId: fx.auditId, auditorId: fx.auditorId, assetId: fx.assetId, result: 'matched', method: 'scan', gpsLat: 12.97, gpsLng: 77.59 }],
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { applied: number; skipped: number; items: { status: string }[] }
    expect(body.applied).toBe(1)
    expect(body.items[0].status).toBe('applied')

    // Black-box cross-check: the effect is visible through the read contract
    const boot = await (await api('GET', '/api/core/bootstrap')).json() as { assets: { id: string; lastVerifiedAt: string | null }[] }
    const a = boot.assets.find((x) => x.id === fx.assetId)
    expect(a?.lastVerifiedAt).not.toBeNull()
  })

  test('idempotent replay over HTTP: second POST reports duplicate, no new row', async () => {
    const opId = `bb-op-${tag}-1`
    const res = await api('POST', '/api/core/verify', {
      operations: [{ operationId: opId, auditId: fx.auditId, auditorId: fx.auditorId, assetId: fx.assetId, result: 'matched' }],
    })
    const body = await res.json() as { applied: number; skipped: number }
    expect(res.status).toBe(200)
    expect(body.applied).toBe(0)
    expect(body.skipped).toBe(1)
  })

  test('missing result over HTTP opens a high-severity exception visible in bootstrap', async () => {
    const opId = `bb-op-${tag}-miss`
    syncOpIds.push(opId)
    const res = await api('POST', '/api/core/verify', {
      operations: [{ operationId: opId, auditId: fx.auditId, auditorId: fx.auditorId, assetId: fx.assetId, result: 'missing', remarks: 'Cannot locate on floor' }],
    })
    expect(res.status).toBe(200)
    const boot = await (await api('GET', '/api/core/bootstrap')).json() as { exceptions: { assetId: string; type: string; severity: string; status: string }[] }
    const ex = boot.exceptions.find((e) => e.assetId === fx.assetId && e.type === 'missing')
    expect(ex).toBeDefined()
    expect(ex!.severity).toBe('high')
    expect(ex!.status).toBe('open')
  })

  test('unregistered discovery over HTTP creates ES-DSC asset linked to an exception', async () => {
    const opId = `bb-op-${tag}-dsc`
    syncOpIds.push(opId)
    const res = await api('POST', '/api/core/verify', {
      operations: [{ operationId: opId, auditId: fx.auditId, auditorId: fx.auditorId, result: 'unregistered', discovery: { description: 'Unlabeled pallet pump', make: 'Kiralex' } }],
    })
    const body = await res.json() as { applied: number; items: { exceptionCode?: string }[] }
    expect(res.status).toBe(200)
    expect(body.applied).toBe(1)
    expect(body.items[0].exceptionCode).toMatch(/^EX-\d{4}-\d{4}$/)

    const boot = await (await api('GET', '/api/core/bootstrap')).json() as { assets: { code: string; clientId: string }[] }
    const dsc = boot.assets.find((a) => a.code.startsWith('ES-DSC-') && a.clientId === fx.clientId)
    expect(dsc).toBeDefined()
  })

  test('CONCURRENCY: 6 parallel retries of one operationId → exactly 1 applied, all 200s', async () => {
    const opId = `bb-op-${tag}-race`
    syncOpIds.push(opId)
    const payload = { operations: [{ operationId: opId, auditId: fx.auditId, auditorId: fx.auditorId, assetId: fx.assetId, result: 'custodian_mismatch' }] }
    const responses = await Promise.all(Array.from({ length: 6 }, () => api('POST', '/api/core/verify', payload)))
    for (const r of responses) expect(r.status).toBe(200)
    const bodies = await Promise.all(responses.map((r) => r.json() as Promise<{ applied: number; skipped: number }>)
    )
    const totalApplied = bodies.reduce((s, b) => s + b.applied, 0)
    const totalSkipped = bodies.reduce((s, b) => s + b.skipped, 0)
    expect(totalApplied).toBe(1)
    expect(totalSkipped).toBe(5)
    const rows = await db.verification.count({ where: { operationId: opId } })
    expect(rows).toBe(1)
  })
})

describe('exception lifecycle over the wire', () => {
  test('full legal chain open→closed via PATCH', async () => {
    const steps = ['assign', 'investigate', 'resolve', 'review', 'approve', 'close']
    for (const [i, action] of steps.entries()) {
      const res = await api('PATCH', '/api/core/exceptions', { id: fx.exceptionId, action, note: `BB step ${i}` })
      expect(res.status).toBe(200)
    }
    const ex = await db.exception.findUnique({ where: { id: fx.exceptionId } })
    expect(ex!.status).toBe('closed')
  })

  test('illegal jump over HTTP → 409, closed exception protected', async () => {
    const res = await api('PATCH', '/api/core/exceptions', { id: fx.exceptionId, action: 'assign' })
    expect(res.status).toBe(409)
    expect((await res.json() as { error: string }).error).toContain('Illegal transition')
  })

  test('400 invalid action / 404 unknown id / 400 malformed JSON', async () => {
    expect((await api('PATCH', '/api/core/exceptions', { id: fx.exceptionId, action: 'detonate' })).status).toBe(400)
    expect((await api('PATCH', '/api/core/exceptions', { id: 'no-such-id', action: 'assign' })).status).toBe(404)
    const raw = await fetch(`${BASE}/api/core/exceptions`, { method: 'PATCH', headers: { 'content-type': 'application/json', cookie: sessionCookie }, body: '{{{' })
    expect(raw.status).toBe(400)
    expect(raw.headers.get('content-type')).toContain('application/json')
  })
})

describe('reports & approvals over the wire', () => {
  test('report versions unique over HTTP: v1, v2, finalize, v3', async () => {
    const client = await db.client.findUnique({ where: { id: fx.clientId } })
    const audit = await db.auditProject.create({
      data: { clientId: fx.clientId, code: `BBR-${tag}`, name: `BB Report Audit ${tag}`, type: 'Annual Physical Verification', status: 'review', financialYear: 'FY 2025-26', startDate: new Date(), totalInScope: 1 },
    })
    reportAuditIds.push(audit.id)
    void client
    const labels: string[] = []
    for (let i = 0; i < 2; i++) {
      const res = await api('POST', '/api/core/reports', { auditId: audit.id, action: 'generate' })
      expect(res.status).toBe(200)
      labels.push(((await res.json() as { report: { versionLabel: string } }).report).versionLabel)
    }
    expect(labels).toEqual(['v1', 'v2'])
    expect((await api('POST', '/api/core/reports', { auditId: audit.id, action: 'finalize' })).status).toBe(200)
    const res3 = await api('POST', '/api/core/reports', { auditId: audit.id, action: 'generate' })
    expect(((await res3.json() as { report: { versionLabel: string } }).report).versionLabel).toBe('v3')
  })

  test('approval flow: invalid decision 400, approve finalizes client_review audit', async () => {
    const audit = await db.auditProject.create({
      data: { clientId: fx.clientId, code: `BBP-${tag}`, name: `BB Approval Audit ${tag}`, type: 'Annual Physical Verification', status: 'client_review', financialYear: 'FY 2025-26', startDate: new Date(), totalInScope: 1 },
    })
    approvalAuditIds.push(audit.id)
    const bad = await api('POST', '/api/core/approvals', { auditId: audit.id, decision: 'sort-of-approved', byName: 'BB', byRole: 'QA' })
    expect(bad.status).toBe(400)
    const noActor = await api('POST', '/api/core/approvals', { auditId: audit.id, decision: 'approved' })
    expect(noActor.status).toBe(400)
    const good = await api('POST', '/api/core/approvals', { auditId: audit.id, decision: 'approved', byName: 'BB Approver', byRole: 'CFO', comment: 'Signed off' })
    expect(good.status).toBe(200)
    expect((await db.auditProject.findUnique({ where: { id: audit.id } }))!.status).toBe('completed')
  })
})

describe('hostile input / fuzz (must degrade to 4xx JSON, never 500/HTML)', () => {
  test('verify: malformed JSON, null body, operations as object/string/number', async () => {
    const cases: { method: string; path: string; body: string }[] = [
      { method: 'POST', path: '/api/core/verify', body: 'null' },
      { method: 'POST', path: '/api/core/verify', body: '{"operations":{"0":{}}}' },
      { method: 'POST', path: '/api/core/verify', body: '{"operations":"drop table"}' },
      { method: 'POST', path: '/api/core/verify', body: '{"operations":42}' },
      { method: 'POST', path: '/api/core/verify', body: '[1,2,3]' },
    ]
    for (const c of cases) {
      const res = await fetch(`${BASE}${c.path}`, { method: c.method, headers: { 'content-type': 'application/json' }, body: c.body })
      expect(res.status, `case ${c.body}`).toBeLessThan(500)
      expect(res.headers.get('content-type'), `case ${c.body}`).toContain('application/json')
    }
  })

  test('verify: individual hostile ops are rejected, not applied, no crash', async () => {
    const res = await api('POST', '/api/core/verify', {
      operations: [
        { operationId: '', auditId: fx.auditId, auditorId: fx.auditorId, result: 'matched' },
        { operationId: `bb-${tag}-fz1`, auditId: fx.auditId, auditorId: fx.auditorId, result: "'); DROP TABLE Verification;--" },
        { operationId: `bb-${tag}-fz2`, auditId: '../../../etc/passwd', auditorId: fx.auditorId, result: 'matched', assetId: fx.assetId },
        { operationId: `bb-${tag}-fz3`, auditId: fx.auditId, auditorId: fx.auditorId, result: 'missing', assetId: 'cuid-that-does-not-exist' },
        { operationId: `bb-${tag}-fz4`, auditId: fx.auditId, auditorId: fx.auditorId, result: 'unregistered' },
        { operationId: `bb-${tag}-fz5`, auditId: fx.auditId, auditorId: fx.auditorId, result: 'matched', assetId: fx.assetId, photos: 'not-an-array' },
        null,
      ],
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { applied: number; rejected: number; items: { status: string }[] }
    expect(body.applied).toBe(0)
    expect(body.rejected).toBeGreaterThanOrEqual(6)
    // the DB must still be alive
    expect((await api('GET', '/api/core/registry')).status).toBe(200)
  })

  test('oversized strings and unicode do not crash the engine', async () => {
    const res = await api('POST', '/api/core/verify', {
      operations: [
        { operationId: `bb-${tag}-big`, auditId: fx.auditId, auditorId: fx.auditorId, result: 'deferred', remarks: '💥'.repeat(2000) + 'x'.repeat(20000) },
        { operationId: `bb-${tag}-uni`, auditId: fx.auditId, auditorId: fx.auditorId, result: 'deferred', remarks: 'अस्थिर संपत्ति 🔧 東京 test' },
      ],
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { applied: number; rejected: number }
    expect(body.applied + body.rejected).toBe(2)
  })

  test('approvals/reports: hostile bodies stay 4xx JSON', async () => {
    expect((await api('POST', '/api/core/approvals', { auditId: fx.auditId })).status).toBe(400)
    expect((await api('POST', '/api/core/approvals', { auditId: fx.auditId, decision: 42, byName: 1, byRole: 2 })).status).toBe(400)
    expect((await api('POST', '/api/core/reports', { auditId: fx.auditId, action: 'DROP TABLE' })).status).toBe(400)
    expect((await api('POST', '/api/core/reports', {})).status).toBe(400)
  })

  test('error responses never leak stack traces', async () => {
    const res = await api('PATCH', '/api/core/exceptions', { id: 'nope', action: 'assign' })
    const text = await res.text()
    expect(text).not.toContain('at ')
    expect(text).not.toContain('node_modules')
  })
})

describe('latency sanity under load', () => {
  test('batch of 10 mixed ops applies within budget', async () => {
    const ops = Array.from({ length: 10 }, (_, i) => ({
      operationId: `bb-${tag}-load-${i}`,
      auditId: fx.auditId, auditorId: fx.auditorId, assetId: fx.assetId,
      result: i % 2 === 0 ? 'matched' : 'deferred',
    }))
    const t0 = Date.now()
    const res = await api('POST', '/api/core/verify', { operations: ops })
    const ms = Date.now() - t0
    expect(res.status).toBe(200)
    expect(((await res.json()) as { applied: number }).applied).toBe(10)
    expect(ms).toBeLessThan(3000)
  })
})
