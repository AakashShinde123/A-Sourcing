/**
 * Whitebox — GET /api/core/assets/labels (printable A4 QR label sheet).
 *
 * Covers the contract the Ops "Print QR labels" flow depends on:
 *   RBAC   → ADMIN/OPS allowed, CLIENT + AUDITOR + anonymous rejected
 *   Query  → missing ids = 400, unknown ids = 404, dedupe + cap handling
 *   Sheet  → valid HTML containing the asset code, the scanner value (barcode
 *            ?? code), an inline QR <svg>, and XSS-safe escaping of asset text
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { GET as labelsGET } from '@/app/api/core/assets/labels/route'
import { cleanupFixtures, jsonRequest, makeFixture, type AuthUserLike, type Fixture } from './helpers'

let fx: Fixture
let adminUser: AuthUserLike
let opsUser: AuthUserLike
let clientUser: AuthUserLike
let auditorUser: AuthUserLike

beforeAll(async () => {
  fx = await makeFixture({ assetCount: 2 })
  const hash = await bcrypt.hash('x', 4)
  const mk = (role: string, extra: Record<string, unknown> = {}) =>
    db.user.create({ data: { name: `U ${Date.now()}-${Math.random()}`, email: `lbl.${role}.${Date.now()}@es.test`, passwordHash: hash, role: role as never, ...extra } })
  adminUser = (await mk('ADMIN')) as AuthUserLike
  opsUser = (await mk('OPS')) as AuthUserLike
  clientUser = (await mk('CLIENT', { clientId: fx.clientId })) as AuthUserLike
  auditorUser = (await mk('AUDITOR', { auditorId: fx.auditorId })) as AuthUserLike
})

afterAll(async () => { await cleanupFixtures() })

async function req(ids: string | null, user: AuthUserLike | null) {
  const url = `http://localhost:3000/api/core/assets/labels${ids ? `?ids=${ids}` : ''}`
  return jsonRequest(url, undefined, 'GET', user)
}

describe('assets/labels API (direct handler)', () => {
  test('anonymous → 403, CLIENT → 403, AUDITOR → 403 (ops workflow)', async () => {
    for (const u of [null, clientUser, auditorUser]) {
      const res = await labelsGET(await req(fx.assetId, u))
      expect(res.status).toBe(403)
    }
  })

  test('missing ids param → 400 with guidance', async () => {
    const res = await labelsGET(await req(null, adminUser))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('ids')
  })

  test('unknown ids → 404', async () => {
    const res = await labelsGET(await req('asset_does_not_exist_1,asset_does_not_exist_2', adminUser))
    expect(res.status).toBe(404)
  })

  test('happy path (OPS) → HTML sheet with code, scanner value, QR svg; ids deduped', async () => {
    const asset = await db.asset.findUnique({ where: { id: fx.assetId } })
    const dupList = `${fx.assetId},${fx.assetId}`
    const res = await labelsGET(await req(dupList, opsUser))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain(`<title>ES labels — 1 asset</title>`) // dedupe worked
    expect(html).toContain(asset!.code)
    const scannerValue = asset!.barcode || asset!.code
    expect(html).toContain(scannerValue)
    expect(html).toContain('<svg') // inline QR
    expect(html).toContain('window.print')
  })

  test('asset without barcode falls back to the ES code as the QR value', async () => {
    const bare = await db.asset.create({
      data: {
        clientId: fx.clientId, code: `ES-TST-NOQR-${Date.now().toString(36).toUpperCase()}`,
        clientAssetId: `NOQR-${Date.now()}`, description: 'Untagged asset', category: 'Test',
        status: 'registered',
      },
    })
    try {
      const res = await labelsGET(await req(bare.id, adminUser))
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain(bare.code)
      expect(html).not.toContain('null') // no raw null leaked into the sheet
    } finally {
      await db.asset.delete({ where: { id: bare.id } }).catch(() => {})
    }
  })

  test('XSS-safe: hostile description/serial is escaped in the sheet', async () => {
    const evil = await db.asset.create({
      data: {
        clientId: fx.clientId, code: `ES-TST-XS-${Date.now().toString(36).toUpperCase()}`,
        clientAssetId: `XS-${Date.now()}`, description: '<script>alert(1)</script>',
        serialNumber: '" onmouseover="alert(2)', category: 'Test', status: 'registered',
      },
    })
    try {
      const res = await labelsGET(await req(evil.id, adminUser))
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).not.toContain('<script>alert(1)')
      expect(html).toContain('&lt;script&gt;')
      expect(html).not.toContain('" onmouseover="alert(2)')
    } finally {
      await db.asset.delete({ where: { id: evil.id } }).catch(() => {})
    }
  })
})
