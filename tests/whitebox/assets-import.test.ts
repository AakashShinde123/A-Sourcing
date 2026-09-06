/**
 * WHITE-BOX INTEGRATION TESTS — POST /api/core/assets/import
 * Asset-register intake: per-row verdicts, idempotent re-upload, ES code
 * allocation, location fuzzy-matching and the append-only audit trail entry.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { POST as importPOST } from '@/app/api/core/assets/import/route'
import { db } from '@/lib/db'
import { parseRegister, splitCsvLine } from '@/modules/shared/register-parse'
import { makeFixture, cleanupFixtures, jsonRequest, type Fixture } from './helpers'

let fx: Fixture
const REGISTER = [
  { clientAssetId: 'REG-001', description: 'Vertical Band Saw', category: 'Production Machinery', make: 'Kaltenborg', model: 'VB-400', serialNumber: 'KS-99214', barcode: 'BC-REG-001', locationLabel: 'production block a', custodian: 'K. Menon' },
  { clientAssetId: 'REG-002', description: 'Server Rack 42U', category: 'IT Infrastructure', serialNumber: 'AP-77120', locationLabel: 'Server Room', custodian: 'S. Iyer' },
  { clientAssetId: 'REG-003', description: 'Hydraulic Pallet Truck', category: 'Material Handling', locationLabel: 'Nowhere Known', custodian: null },
]

afterAll(async () => {
  await db.location.deleteMany({ where: { code: 'PBA-TST' } })
  await cleanupFixtures()
})

describe('asset register import', () => {
  test('happy path — all rows imported with generated ES codes and audit-trail entry', async () => {
    fx = await makeFixture({ assetCount: 1 })

    // seed one location so fuzzy-match can hit (stored lowercase query matches mixed-case name)
    await db.location.create({
      data: { id: `loc_${fx.clientId.slice(-6)}_a`, clientId: fx.clientId, parentId: null, level: 'site', name: 'Production Block A', code: 'PBA-TST' },
    })

    const res = await importPOST(jsonRequest('http://local/api/core/assets/import', { clientId: fx.clientId, rows: REGISTER }))
    expect(res.status).toBe(200)
    const data = await res.json() as { imported: number; skipped: number; rejected: number; items: { clientAssetId: string; status: string; code?: string }[] }

    expect(data.imported).toBe(3)
    expect(data.skipped).toBe(0)
    expect(data.rejected).toBe(0)
    expect(data.items).toHaveLength(3)
    for (const it of data.items) {
      expect(it.status).toBe('imported')
      expect(it.code).toMatch(/^ES-[\w-]+-\d{5}$/)
    }

    // rows landed in the DB with status 'registered'; exact location-linking is asserted below
    const created = await db.asset.findMany({ where: { clientId: fx.clientId, clientAssetId: { startsWith: 'REG-' } } })
    expect(created).toHaveLength(3)
    const saw = created.find((a) => a.clientAssetId === 'REG-001')
    expect(saw?.status).toBe('registered')
  })

  test('location fuzzy-match links case-insensitively; unknown locations stay unlinked', async () => {
    // The happy-path import above already ran with the location present, so
    // REG-001 should have linked to it. REG-003 ('Nowhere Known') must be null.
    const rows = await db.asset.findMany({ where: { clientId: fx.clientId, clientAssetId: { startsWith: 'REG-' } } })
    const linked = rows.find((a) => a.clientAssetId === 'REG-001')
    const unknown = rows.find((a) => a.clientAssetId === 'REG-003')
    expect(linked?.locationId).not.toBeNull()
    expect(unknown?.locationId).toBeNull()
  })

  test('idempotent re-upload — same register reports duplicates, creates nothing new', async () => {
    const before = await db.asset.count({ where: { clientId: fx.clientId } })
    const res = await importPOST(jsonRequest('http://local/api/core/assets/import', { clientId: fx.clientId, rows: REGISTER }))
    expect(res.status).toBe(200)
    const data = await res.json() as { imported: number; skipped: number; items: { status: string }[] }
    expect(data.imported).toBe(0)
    expect(data.skipped).toBe(3)
    expect(data.items.every((i) => i.status === 'duplicate')).toBe(true)
    const after = await db.asset.count({ where: { clientId: fx.clientId } })
    expect(after).toBe(before)
  })

  test('mixed batch — valid + duplicate + invalid rows each get their own verdict', async () => {
    const res = await importPOST(jsonRequest('http://local/api/core/assets/import', {
      clientId: fx.clientId,
      rows: [
        { clientAssetId: 'REG-010', description: 'New lathe', category: 'Production Machinery' },
        { clientAssetId: 'REG-001', description: 'Duplicate of first upload', category: 'Production Machinery' },
        { description: 'No asset id', category: 'Misc' },
        { clientAssetId: 'REG-011', description: '', category: 'Misc' },
      ],
    }))
    expect(res.status).toBe(200)
    const data = await res.json() as { imported: number; skipped: number; rejected: number; items: { clientAssetId: string; status: string; error?: string }[] }
    expect(data.imported).toBe(1)
    expect(data.skipped).toBe(1)
    expect(data.rejected).toBe(2)
    expect(data.items.find((i) => i.clientAssetId === '(missing)')?.error).toContain('required')
    // in-batch duplicates (same row twice) also resolve to a single import
    const again = await importPOST(jsonRequest('http://local/api/core/assets/import', {
      clientId: fx.clientId,
      rows: [
        { clientAssetId: 'REG-020', description: 'Twin A', category: 'Misc' },
        { clientAssetId: 'REG-020', description: 'Twin B', category: 'Misc' },
      ],
    }))
    const data2 = await again.json() as { imported: number; skipped: number }
    expect(data2.imported).toBe(1)
    expect(data2.skipped).toBe(1)
  })

  test('append-only audit trail records the batch summary', async () => {
    const client = await db.client.findUnique({ where: { id: fx.clientId } })
    const log = await db.auditLog.findFirst({ where: { action: 'REGISTER_IMPORTED', entityRef: fx.clientId }, orderBy: { at: 'desc' } })
    expect(log).not.toBeNull()
    expect(log!.detail).toContain(client!.code)
    expect(log!.detail).toMatch(/imported · \d+/)
  })

  test('validation — unknown client 404, empty/missing rows 400, non-array 400', async () => {
    const notFound = await importPOST(jsonRequest('http://local/api/core/assets/import', { clientId: 'cl_does_not_exist', rows: REGISTER }))
    expect(notFound.status).toBe(404)

    const noRows = await importPOST(jsonRequest('http://local/api/core/assets/import', { clientId: fx.clientId, rows: [] }))
    expect(noRows.status).toBe(400)

    const notArray = await importPOST(jsonRequest('http://local/api/core/assets/import', { clientId: fx.clientId, rows: 'nope' }))
    expect(notArray.status).toBe(400)

    const noClient = await importPOST(jsonRequest('http://local/api/core/assets/import', { rows: REGISTER }))
    expect(noClient.status).toBe(400)
  })
})

describe('register CSV parsing (pure)', () => {
  test('header row maps through aliases (Asset ID / Particulars / Group …)', () => {
    const csv = 'Asset ID,Particulars,Group,Brand,Serial No,Floor,Holder\nA-1,Lathe,Production,Kaltenborg,SN-1,Block 2,Ravi'
    const { rows, headerMapped } = parseRegister(csv)
    expect(headerMapped).toBe(true)
    expect(rows).toHaveLength(1)
    expect(rows[0].clientAssetId).toBe('A-1')
    expect(rows[0].description).toBe('Lathe')
    expect(rows[0].category).toBe('Production')
    expect(rows[0].make).toBe('Kaltenborg')
    expect(rows[0].serialNumber).toBe('SN-1')
    expect(rows[0].locationLabel).toBe('Block 2')
    expect(rows[0].custodian).toBe('Ravi')
  })

  test('headerless file falls back to positional order', () => {
    const { rows, headerMapped } = parseRegister('X-9,Compressor,HVAC\nX-10,Pump,Plumbing')
    expect(headerMapped).toBe(false)
    expect(rows[0].clientAssetId).toBe('X-9')
    expect(rows[0].description).toBe('Compressor')
    expect(rows[0].category).toBe('HVAC')
    expect(rows[1].clientAssetId).toBe('X-10')
  })

  test('quoted cells with commas stay intact; blank lines are skipped', () => {
    expect(splitCsvLine('"Widget, large",B,"say ""hi""",C')).toEqual(['Widget, large', 'B', 'say "hi"', 'C'])
    const { rows } = parseRegister('\nA-2,Desk,Furniture\n\n')
    expect(rows).toHaveLength(1)
  })
})
