/**
 * EasySourcing demo seed — deterministic, realistic enterprise data.
 * Run: bun prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// ── seeded RNG (mulberry32) ─────────────────────────────────────
let s = 42
function rnd() {
  s |= 0; s = (s + 0x6D2B79F5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
const ri = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min
const chance = (p: number) => rnd() < p

const D = (daysAgo: number, h = 10, m = 30) => {
  const d = new Date('2026-09-06T00:00:00+05:30')
  d.setDate(d.getDate() - daysAgo)
  d.setHours(h, m, 0, 0)
  return d
}

async function main() {
  console.log('Seeding EasySourcing demo data…')

  // wipe in FK order
  await db.auditLog.deleteMany()
  await db.approval.deleteMany()
  await db.report.deleteMany()
  await db.evidence.deleteMany()
  await db.verification.deleteMany()
  await db.exception.deleteMany()
  await db.asset.deleteMany()
  await db.auditAssignment.deleteMany()
  await db.auditProject.deleteMany()
  await db.auditor.deleteMany()
  await db.location.deleteMany()
  await db.clientUser.deleteMany()
  await db.client.deleteMany()

  // ── Clients ───────────────────────────────────────────────────
  const mrd = await db.client.create({ data: { id: 'cl_mrd', code: 'MRD', name: 'Meridian Manufacturing Pvt Ltd', industry: 'Heavy Manufacturing', city: 'Pune', contact: 'Kavita Deshpande', email: 'kavita.d@meridianmfg.in', phone: '+91 98220 41122', since: D(720), colorSeed: 'emerald' } })
  const zen = await db.client.create({ data: { id: 'cl_zen', code: 'ZEN', name: 'Zenith IT Parks Ltd', industry: 'IT Services', city: 'Bengaluru', contact: 'Farhan Ahmed', email: 'farhan@zenithitparks.com', phone: '+91 98860 22331', since: D(540), colorSeed: 'teal' } })
  const apx = await db.client.create({ data: { id: 'cl_apx', code: 'APX', name: 'Apex Healthcare Group', industry: 'Healthcare', city: 'Mumbai', contact: 'Dr. Ritu Malhotra', email: 'ritu.m@apexhealth.in', phone: '+91 98190 55402', since: D(400), colorSeed: 'rose' } })
  const nva = await db.client.create({ data: { id: 'cl_nva', code: 'NVA', name: 'Nova Logistics Ltd', industry: 'Logistics & Warehousing', city: 'Chennai', contact: 'Suresh Iyer', email: 'suresh.i@novalogistics.in', phone: '+91 98400 71225', since: D(300), colorSeed: 'amber' } })
  const sgm = await db.client.create({ data: { id: 'cl_sgm', code: 'SGM', name: 'Sangam Textiles Ltd', industry: 'Textiles', city: 'Coimbatore', contact: 'Lakshmi Sundar', email: 'lakshmi@sangamtextiles.co.in', phone: '+91 98430 19087', since: D(120), status: 'onboarding', colorSeed: 'orange' } })

  await db.clientUser.createMany({ data: [
    { clientId: mrd.id, name: 'Kavita Deshpande', role: 'Client Admin', email: 'kavita.d@meridianmfg.in' },
    { clientId: mrd.id, name: 'Nilesh Kulkarni', role: 'Client Approver', email: 'nilesh.k@meridianmfg.in' },
    { clientId: mrd.id, name: 'Aarti Joshi', role: 'Client Manager', email: 'aarti.j@meridianmfg.in' },
    { clientId: zen.id, name: 'Farhan Ahmed', role: 'Client Admin', email: 'farhan@zenithitparks.com' },
    { clientId: apx.id, name: 'Dr. Ritu Malhotra', role: 'Client Approver', email: 'ritu.m@apexhealth.in' },
  ] })

  // ── Location helpers ──────────────────────────────────────────
  type LocSeed = { id: string; level: string; name: string; code: string; address?: string; children?: LocSeed[] }
  let locSeq = 0
  async function seedTree(clientId: string, nodes: LocSeed[], parentId: string | null = null) {
    const ids: string[] = []
    for (const n of nodes) {
      locSeq++
      const id = `loc_${String(locSeq).padStart(3, '0')}`
      await db.location.create({ data: { id, clientId, parentId, level: n.level, name: n.name, code: n.code, address: n.address, gpsLat: n.address ? 18.5204 + (rnd() - 0.5) * 0.2 : undefined, gpsLng: n.address ? 73.8567 + (rnd() - 0.5) * 0.2 : undefined } })
      ids.push(id, ...(await seedTree(clientId, n.children ?? [], id)))
    }
    return ids
  }

  const mrdTree: LocSeed[] = [
    { id: '', level: 'site', name: 'Chakan Plant', code: 'CKN', address: 'MIDC Chakan Phase 2, Pune 410501', children: [
      { id: '', level: 'building', name: 'Production Block A', code: 'CKN-A', children: [
        { id: '', level: 'floor', name: 'Ground Floor', code: 'CKN-A-GF', children: [
          { id: '', level: 'zone', name: 'CNC Machining Zone', code: 'CKN-A-GF-Z1', children: [
            { id: '', level: 'department', name: 'Machining Department', code: 'CKN-A-GF-Z1-D1', children: [
              { id: '', level: 'room', name: 'CNC Hall 1', code: 'CKN-A-GF-Z1-D1-R1' },
              { id: '', level: 'room', name: 'CNC Hall 2', code: 'CKN-A-GF-Z1-D1-R2' },
            ] },
            { id: '', level: 'department', name: 'Assembly Department', code: 'CKN-A-GF-Z1-D2', children: [
              { id: '', level: 'room', name: 'Assembly Line 1', code: 'CKN-A-GF-Z1-D2-R1' },
            ] },
          ] },
          { id: '', level: 'zone', name: 'Utilities Zone', code: 'CKN-A-GF-Z2', children: [
            { id: '', level: 'department', name: 'Maintenance Department', code: 'CKN-A-GF-Z2-D1', children: [
              { id: '', level: 'room', name: 'Workshop', code: 'CKN-A-GF-Z2-D1-R1' },
            ] },
          ] },
        ] },
      ] },
      { id: '', level: 'building', name: 'Warehouse Block B', code: 'CKN-B', children: [
        { id: '', level: 'floor', name: 'Ground Floor', code: 'CKN-B-GF', children: [
          { id: '', level: 'zone', name: 'Storage Zone', code: 'CKN-B-GF-Z1', children: [
            { id: '', level: 'department', name: 'Finished Goods Store', code: 'CKN-B-GF-Z1-D1', children: [
              { id: '', level: 'room', name: 'FG Bay 1', code: 'CKN-B-GF-Z1-D1-R1' },
            ] },
            { id: '', level: 'department', name: 'Raw Material Store', code: 'CKN-B-GF-Z1-D2', children: [
              { id: '', level: 'room', name: 'RM Bay', code: 'CKN-B-GF-Z1-D2-R1' },
            ] },
          ] },
        ] },
      ] },
    ] },
    { id: '', level: 'site', name: 'Hinjewadi Office', code: 'HNJ', address: 'Rajiv Gandhi Infotech Park, Phase 1, Pune 411057', children: [
      { id: '', level: 'building', name: 'Office Tower', code: 'HNJ-T1', children: [
        { id: '', level: 'floor', name: '3rd Floor', code: 'HNJ-T1-L3', children: [
          { id: '', level: 'zone', name: 'Engineering Zone', code: 'HNJ-T1-L3-Z1', children: [
            { id: '', level: 'department', name: 'Design Department', code: 'HNJ-T1-L3-Z1-D1', children: [
              { id: '', level: 'room', name: 'Design Studio', code: 'HNJ-T1-L3-Z1-D1-R1' },
            ] },
            { id: '', level: 'department', name: 'IT Department', code: 'HNJ-T1-L3-Z1-D2', children: [
              { id: '', level: 'room', name: 'Server Room', code: 'HNJ-T1-L3-Z1-D2-R1' },
            ] },
          ] },
        ] },
      ] },
    ] },
  ]
  const mrdLocIds = await seedTree(mrd.id, mrdTree)

  await seedTree(zen.id, [
    { id: '', level: 'site', name: 'Whitefield Campus', code: 'WFC', address: 'ITPL Main Road, Whitefield, Bengaluru 560066', children: [
      { id: '', level: 'building', name: 'Block 1', code: 'WFC-B1', children: [
        { id: '', level: 'floor', name: 'Floors 1–4', code: 'WFC-B1-F', children: [
          { id: '', level: 'department', name: 'IT Assets', code: 'WFC-B1-IT', children: [
            { id: '', level: 'room', name: 'Workspaces & Server Room', code: 'WFC-B1-IT-R1' },
          ] },
        ] },
      ] },
    ] },
  ])
  await seedTree(apx.id, [
    { id: '', level: 'site', name: 'Andheri Hospital', code: 'AND', address: 'Veera Desai Road, Andheri West, Mumbai 400053', children: [
      { id: '', level: 'building', name: 'Main Wing', code: 'AND-MW', children: [
        { id: '', level: 'department', name: 'Radiology & Labs', code: 'AND-MW-RAD', children: [
          { id: '', level: 'room', name: 'Imaging Suite', code: 'AND-MW-RAD-R1' },
        ] },
        { id: '', level: 'department', name: 'General Wards', code: 'AND-MW-GW', children: [
          { id: '', level: 'room', name: 'Ward A–C', code: 'AND-MW-GW-R1' },
        ] },
      ] },
    ] },
  ])
  await seedTree(nva.id, [
    { id: '', level: 'site', name: 'Oragadam Warehouse', code: 'ORG', address: 'SIPCOT Industrial Park, Oragadam, Chennai 602105', children: [
      { id: '', level: 'building', name: 'Dispatch Hub', code: 'ORG-DH', children: [
        { id: '', level: 'department', name: 'Fleet & Handling', code: 'ORG-DH-FLEET', children: [
          { id: '', level: 'room', name: 'Fleet Yard', code: 'ORG-DH-FLEET-R1' },
        ] },
      ] },
    ] },
  ])
  await seedTree(sgm.id, [
    { id: '', level: 'site', name: 'Avinashi Mill', code: 'AVM', address: 'Avinashi Road, Coimbatore 641004', children: [
      { id: '', level: 'building', name: 'Spinning Wing', code: 'AVM-SW', children: [
        { id: '', level: 'department', name: 'Spinning Hall', code: 'AVM-SW-SPN', children: [
          { id: '', level: 'room', name: 'Ring Frames Area', code: 'AVM-SW-SPN-R1' },
        ] },
      ] },
    ] },
  ])

  const allLocs = await db.location.findMany()
  const locBy = (code: string) => allLocs.find((l) => l.code === code)!
  const roomIdsOf = (parentCode: string) => {
    const rooms: string[] = []
    const walk = (id: string) => {
      const l = allLocs.find((x) => x.id === id)!
      if (l.level === 'room' || l.level === 'department') rooms.push(l.id)
      for (const c of allLocs.filter((x) => x.parentId === id)) walk(c.id)
    }
    walk(locBy(parentCode).id)
    return rooms
  }

  // ── Auditors ──────────────────────────────────────────────────
  const auditors = await Promise.all([
    db.auditor.create({ data: { id: 'adr_1', name: 'Arjun Mehta', email: 'arjun.m@easysourcing.in', phone: '+91 90040 11223', employeeCode: 'ES-EMP-014', status: 'in_field', city: 'Pune', colorSeed: 'emerald', lastSyncAt: D(0, 9, 42) } }),
    db.auditor.create({ data: { id: 'adr_2', name: 'Priya Nair', email: 'priya.n@easysourcing.in', phone: '+91 90040 44556', employeeCode: 'ES-EMP-021', status: 'in_field', city: 'Pune', colorSeed: 'teal', lastSyncAt: D(0, 8, 55) } }),
    db.auditor.create({ data: { id: 'adr_3', name: 'Rahul Verma', email: 'rahul.v@easysourcing.in', phone: '+91 90040 77889', employeeCode: 'ES-EMP-027', status: 'available', city: 'Pune', colorSeed: 'amber', lastSyncAt: D(1, 17, 10) } }),
    db.auditor.create({ data: { id: 'adr_4', name: 'Sneha Kulkarni', email: 'sneha.k@easysourcing.in', phone: '+91 90080 33221', employeeCode: 'ES-EMP-033', status: 'in_field', city: 'Bengaluru', colorSeed: 'rose', lastSyncAt: D(0, 9, 15) } }),
    db.auditor.create({ data: { id: 'adr_5', name: 'Vikram Singh', email: 'vikram.s@easysourcing.in', phone: '+91 90080 66774', employeeCode: 'ES-EMP-038', status: 'offline', city: 'Chennai', colorSeed: 'orange', lastSyncAt: D(2, 18, 40) } }),
  ])

  // ── Asset catalogue data ──────────────────────────────────────
  const custodians = ['S. Pawar', 'M. Shaikh', 'R. Kadam', 'P. Jadhav', 'A. Taylor', 'V. Rao', 'D. Joshi', 'H. Patil', 'S. Bansal', 'K. Menon', 'T. Naidu', 'G. Chauhan']
  const catalog: Record<string, [string, string, string, string[]][]> = {
    'IT Equipment': [
      ['Dell', 'Latitude 5440', 'Laptop'], ['HP', 'EliteBook 840 G9', 'Laptop'], ['Lenovo', 'ThinkPad E14', 'Laptop'],
      ['Dell', 'OptiPlex 7010', 'Desktop'], ['HP', 'ProDesk 400 G9', 'Desktop'], ['Dell', 'PowerEdge R750', 'Server'],
      ['HP', 'LaserJet M428', 'Printer'], ['Canon', 'IR-2625', 'MFP'], ['Cisco', 'Catalyst 9300', 'Network Switch'],
      ['APC', 'SMART-UPS 3000VA', 'UPS'],
    ],
    'Production Machinery': [
      ['Bosch', 'VMC 850', 'CNC Machining Center'], ['DMG Mori', 'NLX 2500', 'CNC Lathe'], ['Haas', 'VF-2', 'Machining Center'],
      ['Siemens', 'Simogrind', 'Grinding Machine'], ['Godrej', 'HP-100', 'Hydraulic Press 100T'], ['Fanuc', 'R-2000iC', 'Robotic Arm'],
      ['Atlas Copco', 'GA 22', 'Air Compressor'], ['Mitutoyo', 'Crysta-Apex C544', 'CMM'],
    ],
    'Material Handling': [
      ['Toyota', '8FBN25', 'Forklift 2.5T'], ['Godrej', 'PNE 2050', 'Pallet Truck'], ['Crown', 'PE 4500', 'Stacker'],
      ['Tata', 'Intra V30', 'Goods Carrier'],
    ],
    'HVAC & Utilities': [
      ['Carrier', '39G Auha', 'Air Handling Unit'], ['Voltas', '185 Vectra', 'Split AC 2T'], ['Blue Star', 'GeoChiller', 'Chiller Unit'],
      ['Kirloskar', 'KCIL 30', 'Diesel Generator'],
    ],
    Furniture: [
      ['Godrej Interio', 'Wrofft', 'Workstation Cluster'], ['Featherlite', 'Astra', 'Ergonomic Chair'], ['Nilkamal', 'Proto', 'Storage Rack'],
    ],
    'Safety Equipment': [
      ['Honeywell', 'Suprema', 'Fire Extinguisher Cabinet'], ['3M', 'SecureFit 400', 'Safety Helmet Kit'], ['Usha', 'FireShield', 'Fire Hydrant Panel'],
    ],
    'Medical Equipment': [
      ['GE Healthcare', 'Revolution EVO', 'CT Scanner'], ['Siemens Healthineers', 'MAGNETOM Free.Max', 'MRI Scanner'], ['Philips', 'EPIQ 7', 'Ultrasound System'],
      ['Roche', 'Cobas 8000', 'Analyzer'], ['Dräger', 'Fabius Plus', 'Anesthesia Machine'], ['Mindray', 'uMEC12', 'Patient Monitor'],
    ],
    Vehicles: [
      ['Tata', 'Ace Gold', 'Delivery Mini Truck'], ['Mahindra', 'Bolero Pickup', 'Utility Vehicle'], ['Maruti Suzuki', 'Eeco Cargo', 'Van'],
    ],
  }
  const condPool = ['excellent', 'good', 'good', 'good', 'fair', 'fair', 'poor']
  let assetSeq = 0

  async function makeAssets(clientId: string, clientCode: string, roomIds: string[], count: number, categoryFilter?: string[]) {
    const cats = Object.keys(catalog).filter((c) => !categoryFilter || categoryFilter.includes(c))
    const created: string[] = []
    for (let i = 0; i < count; i++) {
      assetSeq++
      const cat = cats[Math.floor(rnd() * cats.length)]
      const [make, model, kind] = pick(catalog[cat])
      const id = `ast_${clientCode.toLowerCase()}_${String(assetSeq).padStart(4, '0')}`
      const code = `ES-${clientCode}-${String(assetSeq).padStart(5, '0')}`
      const cost = ri(18, 950) * 1000
      const status = chance(0.06) ? pick(['maintenance', 'retired', 'disposed']) : chance(0.03) ? 'missing' : 'active'
      const purchase = D(ri(200, 2200), 12)
      await db.asset.create({ data: {
        id, clientId, code, clientAssetId: `${clientCode}/FA/${String(1200 + assetSeq)}`,
        description: `${make} ${model} — ${kind}`, category: cat, subcategory: kind, make, model,
        serialNumber: `${make.slice(0, 2).toUpperCase()}${ri(100000, 999999)}`,
        barcode: `89${ri(100000000000, 999999999999)}`, qrCode: `${code}`,
        locationId: pick(roomIds), custodian: pick(custodians), status, condition: status === 'active' ? pick(condPool) : pick(['poor', 'fair']),
        purchaseDate: purchase, purchaseCost: cost, currentValue: Math.round(cost * (0.55 + rnd() * 0.4)),
        createdAt: purchase,
      } })
      created.push(id)
    }
    return created
  }

  await makeAssets(mrd.id, 'MRD', [...roomIdsOf('CKN'), ...roomIdsOf('HNJ')], 88)
  await makeAssets(zen.id, 'ZEN', roomIdsOf('WFC'), 24, ['IT Equipment', 'Furniture', 'HVAC & Utilities'])
  await makeAssets(apx.id, 'APX', roomIdsOf('AND'), 22, ['Medical Equipment', 'IT Equipment', 'Furniture'])
  await makeAssets(nva.id, 'NVA', roomIdsOf('ORG'), 16, ['Material Handling', 'Vehicles', 'Safety Equipment'])
  await makeAssets(sgm.id, 'SGM', roomIdsOf('AVM'), 14, ['Production Machinery', 'HVAC & Utilities'])

  // ── Audit projects ────────────────────────────────────────────
  const audit1 = await db.auditProject.create({ data: { id: 'aud_1', clientId: mrd.id, code: 'AUD-2025-014', name: 'FY 2025–26 Annual Physical Verification', type: 'Annual Physical Verification', status: 'in_progress', financialYear: 'FY 2025–26', startDate: D(17, 9), endDate: D(10), totalInScope: 58, locationsLabel: 'Chakan Plant · Hinjewadi Office' } })
  const audit2 = await db.auditProject.create({ data: { id: 'aud_2', clientId: zen.id, code: 'AUD-2025-011', name: 'Fixed Asset Verification — Q2', type: 'Fixed Asset Verification', status: 'client_review', financialYear: 'FY 2025–26', startDate: D(48, 9), endDate: D(12), totalInScope: 24, locationsLabel: 'Whitefield Campus · Block 1' } })
  const audit3 = await db.auditProject.create({ data: { id: 'aud_3', clientId: apx.id, code: 'AUD-2025-016', name: 'Asset Tagging Drive — Radiology', type: 'Asset Tagging', status: 'planning', financialYear: 'FY 2025–26', startDate: D(-6, 9), endDate: D(-25), totalInScope: 22, locationsLabel: 'Andheri Hospital · Main Wing' } })
  const audit4 = await db.auditProject.create({ data: { id: 'aud_4', clientId: nva.id, code: 'AUD-2025-008', name: 'Custodian Verification — Fleet', type: 'Custodian Verification', status: 'completed', financialYear: 'FY 2025–25', startDate: D(120, 9), endDate: D(85), totalInScope: 16, locationsLabel: 'Oragadam Warehouse' } })
  const audit5 = await db.auditProject.create({ data: { id: 'aud_5', clientId: mrd.id, code: 'AUD-2025-009', name: 'Location Verification — Warehouse', type: 'Location Verification', status: 'review', financialYear: 'FY 2025–25', startDate: D(90, 9), endDate: D(55), totalInScope: 30, locationsLabel: 'Chakan Plant · Warehouse Block B' } })
  await db.auditProject.create({ data: { id: 'aud_6', clientId: sgm.id, code: 'AUD-2025-017', name: 'Special Audit — Spinning Machinery', type: 'Special Audit', status: 'draft', financialYear: 'FY 2025–26', startDate: D(-20, 9), endDate: D(-5), totalInScope: 14, locationsLabel: 'Avinashi Mill' } })

  // ── Assignments for audit1 (the live audit) ───────────────────
  const a1 = await db.auditAssignment.create({ data: { id: 'asg_1', auditId: audit1.id, auditorId: 'adr_1', locationId: locBy('CKN-A').id, scope: 'Chakan Plant — Production Block A', status: 'in_progress' } })
  const a2 = await db.auditAssignment.create({ data: { id: 'asg_2', auditId: audit1.id, auditorId: 'adr_2', locationId: locBy('CKN-B').id, scope: 'Chakan Plant — Warehouse Block B', status: 'in_progress' } })
  const a3 = await db.auditAssignment.create({ data: { id: 'asg_3', auditId: audit1.id, auditorId: 'adr_3', locationId: locBy('HNJ').id, scope: 'Hinjewadi Office — Engineering Zone', status: 'assigned' } })

  const mrdAssets = await db.asset.findMany({ where: { clientId: mrd.id }, include: { location: true } })
  const assetsIn = (parentCode: string) => {
    const ids = new Set(roomIdsOf(parentCode))
    return mrdAssets.filter((a) => a.locationId && ids.has(a.locationId))
  }
  const scopeA = assetsIn('CKN-A').slice(0, 26)
  const scopeB = assetsIn('CKN-B').slice(0, 18)
  const scopeC = assetsIn('HNJ').slice(0, 14)
  for (const a of scopeA) await db.asset.update({ where: { id: a.id }, data: { assignmentId: a1.id } })
  for (const a of scopeB) await db.asset.update({ where: { id: a.id }, data: { assignmentId: a2.id } })
  for (const a of scopeC) await db.asset.update({ where: { id: a.id }, data: { assignmentId: a3.id } })

  // ── Verifications ─────────────────────────────────────────────
  let opSeq = 0
  const evSeeds = ['emerald', 'teal', 'amber', 'rose', 'orange', 'zinc']
  async function verifyAsset(asset: { id: string; locationId: string | null; custodian: string | null }, auditId: string, assignmentId: string | null, auditorId: string, daysAgo: number, resultOverride?: string): Promise<string> {
    opSeq++
    const result = resultOverride ?? (chance(0.86) ? 'matched' : pick(['location_mismatch', 'custodian_mismatch', 'missing', 'condition_exception', 'serial_mismatch']))
    const gpsOk = chance(0.93)
    const photos = chance(0.85) ? JSON.stringify([pick(evSeeds), ...(chance(0.4) ? [pick(evSeeds)] : [])]) : '[]'
    const v = await db.verification.create({ data: {
      id: `ver_${String(opSeq).padStart(4, '0')}`,
      operationId: `op-${String(opSeq).padStart(6, '0')}`,
      auditId, assignmentId, assetId: asset.id, auditorId, result,
      method: chance(0.78) ? 'scan' : chance(0.6) ? 'search' : 'manual',
      gpsLat: gpsOk ? 18.52 + (rnd() - 0.5) * 0.15 : null, gpsLng: gpsOk ? 73.86 + (rnd() - 0.5) * 0.15 : null,
      gpsAccuracy: gpsOk ? +(3 + rnd() * 8).toFixed(1) : null, gpsStatus: gpsOk ? 'captured' : 'unavailable',
      remarks: result === 'matched' ? (chance(0.3) ? 'Asset found in declared condition.' : null)
        : result === 'missing' ? 'Not found after physical search of the area.'
        : result === 'location_mismatch' ? 'Found at a different location than registered.'
        : result === 'custodian_mismatch' ? 'Custodian on floor differs from register.'
        : result === 'serial_mismatch' ? 'Serial number does not match register entry.'
        : 'Condition concerns observed.',
      photos, createdOffline: chance(0.25),
      verifiedAt: D(daysAgo, ri(9, 18), ri(0, 59)), syncedAt: D(Math.max(0, daysAgo - (chance(0.3) ? 1 : 0)), ri(9, 19)),
    } })
    if (photos !== '[]') {
      const seeds: string[] = JSON.parse(photos)
      for (let i = 0; i < seeds.length; i++) {
        await db.evidence.create({ data: { verificationId: v.id, auditId, assetId: asset.id, clientId: (await db.asset.findUnique({ where: { id: asset.id } }))!.clientId, kind: 'photo', label: `Field photo ${i + 1}`, colorSeed: seeds[i], capturedBy: auditors.find((a) => a.id === auditorId)!.name, capturedAt: v.verifiedAt } })
      }
    }
    if (result !== 'matched' && result !== 'deferred') {
      await db.asset.update({ where: { id: asset.id }, data: { status: result === 'missing' ? 'missing' : undefined } })
    }
    await db.asset.update({ where: { id: asset.id }, data: { lastVerifiedAt: v.verifiedAt } })
    return result
  }

  // Audit 1: ~66% of each scope verified over last 16 days
  const planA = scopeA.map((a, i) => ({ a, done: i < 17, day: 16 - Math.floor(i * 0.8) }))
  for (const { a, done, day } of planA) if (done) await verifyAsset(a, audit1.id, a1.id, 'adr_1', Math.max(0, day))
  const planB = scopeB.map((a, i) => ({ a, done: i < 12, day: 14 - Math.floor(i * 0.9) }))
  for (const { a, done, day } of planB) if (done) await verifyAsset(a, audit1.id, a2.id, 'adr_2', Math.max(0, day))
  const planC = scopeC.map((a, i) => ({ a, done: i < 5, day: 12 - i }))
  for (const { a, done, day } of planC) if (done) await verifyAsset(a, audit1.id, a3.id, 'adr_3', Math.max(0, day))

  // Audit 2: fully verified (client review stage)
  const zenAssets = await db.asset.findMany({ where: { clientId: zen.id } })
  for (let i = 0; i < zenAssets.length; i++) await verifyAsset(zenAssets[i], audit2.id, null, 'adr_4', 40 - Math.floor(i / 3), i === 5 ? 'missing' : i === 14 ? 'location_mismatch' : undefined)

  // Audit 4: completed audit
  const nvaAssets = await db.asset.findMany({ where: { clientId: nva.id } })
  for (let i = 0; i < nvaAssets.length; i++) await verifyAsset(nvaAssets[i], audit4.id, null, 'adr_5', 105 - Math.floor(i / 2), i === 3 ? 'custodian_mismatch' : undefined)

  // Audit 5: warehouse location verification, mostly done
  for (let i = 0; i < 24; i++) await verifyAsset(scopeB[i % scopeB.length], audit5.id, null, i % 2 ? 'adr_2' : 'adr_3', 85 - Math.floor(i / 2), i === 9 ? 'location_mismatch' : undefined)

  // ── Exceptions ────────────────────────────────────────────────
  const badVerifs = await db.verification.findMany({ where: { result: { in: ['missing', 'location_mismatch', 'custodian_mismatch', 'serial_mismatch', 'condition_exception'] } }, include: { asset: true, audit: true }, take: 40 })
  let exSeq = 0
  const statusPool = ['open', 'assigned', 'investigating', 'resolved', 'reviewer_review', 'approved', 'closed', 'investigating', 'assigned', 'resolved']
  for (const v of badVerifs) {
    if (!v.assetId || !v.asset) continue
    exSeq++
    const type = v.result
    const sev = type === 'missing' ? pick(['high', 'critical']) : type === 'condition_exception' ? 'medium' : pick(['low', 'medium', 'medium', 'high'])
    const st = exSeq <= 4 ? pick(['open', 'assigned', 'investigating']) : pick(statusPool)
    await db.exception.create({ data: {
      id: `exc_${String(exSeq).padStart(3, '0')}`, code: `EX-2025-${String(exSeq).padStart(4, '0')}`,
      clientId: v.asset.clientId, auditId: v.auditId, assetId: v.assetId, type,
      severity: sev, status: st,
      title: type === 'missing' ? `Asset not found — ${v.asset.code}` : type === 'location_mismatch' ? `Location mismatch — ${v.asset.code}` : type === 'custodian_mismatch' ? `Custodian mismatch — ${v.asset.code}` : type === 'serial_mismatch' ? `Serial mismatch — ${v.asset.code}` : `Condition exception — ${v.asset.code}`,
      description: v.remarks ?? 'Detected during physical verification.',
      locationLabel: (await db.location.findUnique({ where: { id: v.asset.locationId ?? '' } }))?.name ?? '—',
      detectedBy: auditors.find((a) => a.id === v.auditorId)?.name ?? 'System',
      detectedAt: v.verifiedAt, assignedTo: st === 'open' ? null : pick(['Rahul Verma', 'Sneha Kulkarni', 'Priya Nair']),
      resolutionNote: ['resolved', 'reviewer_review', 'approved', 'closed'].includes(st) ? 'Physically re-located and confirmed with department head; register updated.' : null,
      resolvedAt: ['resolved', 'reviewer_review', 'approved', 'closed'].includes(st) ? D(ri(1, 5), 15) : null,
    } })
  }
  // a few unregistered discoveries
  for (const [i, cid] of [mrd.id, mrd.id, zen.id].entries()) {
    exSeq++
    await db.exception.create({ data: {
      id: `exc_${String(exSeq).padStart(3, '0')}`, code: `EX-2025-${String(exSeq).padStart(4, '0')}`,
      clientId: cid, auditId: cid === zen.id ? audit2.id : audit1.id, type: 'unregistered', severity: 'medium',
      status: i === 0 ? 'investigating' : i === 1 ? 'approved' : 'resolved',
      title: `Unregistered asset discovered on floor`, description: 'Physical asset found during floor sweep without a register entry. Awaiting owner confirmation.',
      locationLabel: cid === zen.id ? 'Workspaces & Server Room' : 'CNC Hall 1',
      detectedBy: cid === zen.id ? 'Sneha Kulkarni' : 'Arjun Mehta', detectedAt: D(ri(2, 9), 14),
      resolutionNote: i > 0 ? 'Department confirmed procurement; register entry created and tagged.' : null,
      resolvedAt: i > 0 ? D(2, 16) : null,
      detail: JSON.stringify({ description: 'Bosch GWS 900 Angle Grinder', make: 'Bosch', model: 'GWS 900', serial: 'BC' + ri(100000, 999999), condition: 'good', photos: ['emerald'] }),
    } })
  }

  // ── Reports ───────────────────────────────────────────────────
  await db.report.create({ data: { id: 'rpt_1', clientId: nva.id, auditId: audit4.id, code: 'RPT-2025-031', name: 'Custodian Verification — Final Audit Report', type: 'Final Audit Report', versionLabel: 'Final', status: 'final', generatedBy: 'Meera Rangan (Audit Manager)', generatedAt: D(80, 12), sizeLabel: '2.4 MB', summary: JSON.stringify({ assets: 16, matched: 15, exceptions: 1, accuracy: '93.8%' }) } })
  await db.report.create({ data: { id: 'rpt_2', clientId: nva.id, auditId: audit4.id, code: 'RPT-2025-028', name: 'Custodian Verification — Report v2', type: 'Interim Report', versionLabel: 'v2', status: 'issued', generatedBy: 'Meera Rangan (Audit Manager)', generatedAt: D(88, 11), sizeLabel: '2.1 MB' } })
  await db.report.create({ data: { id: 'rpt_3', clientId: zen.id, auditId: audit2.id, code: 'RPT-2025-044', name: 'Fixed Asset Verification — Report v2', type: 'Executive Summary', versionLabel: 'v2', status: 'issued', generatedBy: 'Meera Rangan (Audit Manager)', generatedAt: D(10, 16), sizeLabel: '1.8 MB', summary: JSON.stringify({ assets: 24, matched: 22, exceptions: 2, accuracy: '91.7%' }) } })
  await db.report.create({ data: { id: 'rpt_4', clientId: mrd.id, auditId: audit5.id, code: 'RPT-2025-035', name: 'Location Verification — Report v1', type: 'Location-wise Report', versionLabel: 'v1', status: 'draft', generatedBy: 'Ankit Shah (Reviewer)', generatedAt: D(60, 10), sizeLabel: '3.1 MB' } })
  await db.report.create({ data: { id: 'rpt_5', clientId: mrd.id, auditId: audit1.id, code: 'RPT-2025-051', name: 'Annual Physical Verification — Executive Summary', type: 'Executive Summary', versionLabel: 'Draft', status: 'draft', generatedBy: 'System (auto-draft)', generatedAt: D(0, 7), sizeLabel: '0.9 MB' } })

  // ── Approvals ─────────────────────────────────────────────────
  await db.approval.create({ data: { clientId: nva.id, auditId: audit4.id, decision: 'approved', byName: 'Suresh Iyer', byRole: 'Client Manager', comment: 'Verified against our books. Accepted.', at: D(82, 15) } })
  await db.approval.create({ data: { clientId: mrd.id, auditId: audit5.id, decision: 'changes_requested', byName: 'Nilesh Kulkarni', byRole: 'Client Approver', comment: 'Please re-verify the two location mismatches in FG Bay 1 before report v2.', at: D(58, 11) } })

  // ── Audit logs ────────────────────────────────────────────────
  const logs: { actor: string; role: string; action: string; entity: string; entityRef?: string; detail?: string; at: Date }[] = [
    { actor: 'Kavita Deshpande', role: 'Client Admin · Meridian', action: 'IMPORT_COMPLETED', entity: 'Asset Register', entityRef: 'MRD-SEP-2026.xlsx', detail: '88 assets imported, 2 rows quarantined', at: D(18, 9) },
    { actor: 'Ankit Shah', role: 'Project Manager', action: 'AUDIT_CREATED', entity: 'Audit', entityRef: 'AUD-2025-014', detail: 'FY 2025–26 Annual Physical Verification', at: D(17, 10) },
    { actor: 'Ankit Shah', role: 'Project Manager', action: 'ASSIGNMENTS_PUBLISHED', entity: 'Audit', entityRef: 'AUD-2025-014', detail: '3 auditors assigned across 3 scopes', at: D(16, 17) },
    { actor: 'Arjun Mehta', role: 'Auditor', action: 'SYNC_BATCH', entity: 'Verifications', entityRef: '12 operations', detail: 'Offline queue synced from field device', at: D(15, 18) },
    { actor: 'System', role: 'Reconciliation Engine', action: 'RECONCILIATION_RUN', entity: 'Audit', entityRef: 'AUD-2025-014', detail: '34 matched · 3 missing · 2 location mismatch', at: D(14, 22) },
    { actor: 'Priya Nair', role: 'Auditor', action: 'DISCOVERY_CREATED', entity: 'Exception', entityRef: 'EX-2025-0031', detail: 'Unregistered asset found in CNC Hall 1', at: D(12, 13) },
    { actor: 'Sneha Kulkarni', role: 'Reviewer', action: 'EXCEPTION_RESOLVED', entity: 'Exception', entityRef: 'EX-2025-0012', detail: 'Re-verified; register corrected', at: D(9, 15) },
    { actor: 'Meera Rangan', role: 'Audit Manager', action: 'REPORT_GENERATED', entity: 'Report', entityRef: 'RPT-2025-044', detail: 'Zenith Fixed Asset v2', at: D(10, 16) },
    { actor: 'Nilesh Kulkarni', role: 'Client Approver · Meridian', action: 'CHANGES_REQUESTED', entity: 'Report', entityRef: 'RPT-2025-035', detail: 'Re-verify FG Bay 1 mismatches', at: D(58, 11) },
    { actor: 'Suresh Iyer', role: 'Client Manager · Nova', action: 'APPROVAL_GRANTED', entity: 'Audit', entityRef: 'AUD-2025-008', detail: 'Final report accepted', at: D(82, 15) },
    { actor: 'Vikram Singh', role: 'Auditor', action: 'AUDIT_FINALIZED', entity: 'Audit', entityRef: 'AUD-2025-008', detail: 'Frozen after client approval', at: D(81, 9) },
    { actor: 'Farhan Ahmed', role: 'Client Admin · Zenith', action: 'EVIDENCE_REVIEWED', entity: 'Evidence', entityRef: '24 items', detail: 'Reviewed photos for server room assets', at: D(11, 12) },
  ]
  let li = 0
  for (const l of logs) { li++; await db.auditLog.create({ data: { id: `log_${String(li).padStart(3, '0')}`, ...l } }) }

  const counts = {
    clients: await db.client.count(), locations: await db.location.count(), assets: await db.asset.count(),
    audits: await db.auditProject.count(), verifications: await db.verification.count(),
    exceptions: await db.exception.count(), evidence: await db.evidence.count(),
  }
  console.log('Seed complete:', counts)
}

main().finally(() => db.$disconnect())
