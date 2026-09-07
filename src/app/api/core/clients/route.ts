import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CLIENT_STATUSES = ['active', 'onboarding', 'paused']
const SEEDS = ['emerald', 'teal', 'amber', 'rose', 'orange', 'violet', 'cyan']

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

const str = (v: unknown): string | null => {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

/**
 * Derive a short unique client code from the organization name.
 * "Tata Motors Ltd" → TAT, collides fall through TAT-B … TAT-Z, then TAT-2 …
 * Same max-scan philosophy as the other code allocators: after deletes the
 * allocator never re-issues a code that ever appeared.
 */
async function allocateClientCode(name: string): Promise<string> {
  const letters = (name.toUpperCase().replace(/[^A-Z]/g, '') || 'CLX')
  const base = letters.slice(0, 3).padEnd(3, 'X')
  const taken = new Set((await db.client.findMany({ select: { code: true } })).map((c) => c.code))
  if (!taken.has(base)) return base
  for (const c of 'BCDEFGHJKLMNPQRSTUVWXYZ') { const cand = `${base}-${c}`; if (!taken.has(cand)) return cand }
  for (let n = 2; n < 100; n++) { const cand = `${base}-${n}`; if (!taken.has(cand)) return cand }
  return `${base}-${Date.now().toString(36).toUpperCase()}`
}

/**
 * POST /api/core/clients — onboard a client organization.
 * Contract: { name, industry, city, contact, email, phone? } → { client }
 * Creates the client with status 'onboarding', a unique code and a default
 * Client Admin portal user (the primary contact) so their portal works
 * immediately.
 */
export async function POST(req: NextRequest) {
  if (!(await requireRole(req, ['ADMIN', 'OPS']))) {
    return NextResponse.json({ error: 'Only operations accounts may add clients' }, { status: 403 })
  }
  let body: { name?: unknown; industry?: unknown; city?: unknown; contact?: unknown; email?: unknown; phone?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const name = str(body.name)
  const industry = str(body.industry)
  const city = str(body.city)
  const contact = str(body.contact)
  const email = str(body.email)?.toLowerCase() ?? null
  const phone = str(body.phone)

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (name.length > 80) return NextResponse.json({ error: 'name is too long (max 80 chars)' }, { status: 400 })
  if (!industry) return NextResponse.json({ error: 'industry is required' }, { status: 400 })
  if (!city) return NextResponse.json({ error: 'city is required' }, { status: 400 })
  if (!contact) return NextResponse.json({ error: 'primary contact person is required' }, { status: 400 })
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'email is not a valid address' }, { status: 400 })

  const count = await db.client.count()
  let client
  try {
    client = await db.client.create({
      data: {
        code: await allocateClientCode(name),
        name, industry, city, contact, email, phone,
        status: 'onboarding',
        since: new Date(),
        colorSeed: SEEDS[count % SEEDS.length],
        users: { create: { name: contact, role: 'Client Admin', email } },
      },
      include: { users: true },
    })
  } catch (e) {
    if (isUniqueViolation(e)) return NextResponse.json({ error: 'A client with this code/email already exists' }, { status: 409 })
    throw e
  }

  await db.auditLog.create({
    data: {
      actor: 'Operations Team', role: 'Operations', action: 'CLIENT_ADDED',
      entity: 'Client', entityRef: client.code,
      detail: `${client.name} onboarded (${industry}, ${city}) · portal admin ${contact}`,
    },
  })

  return NextResponse.json({ client }, { status: 201 })
}

/**
 * PATCH /api/core/clients — lifecycle: active | onboarding | paused.
 * Contract: { id, status } → { client }
 */
export async function PATCH(req: NextRequest) {
  if (!(await requireRole(req, ['ADMIN', 'OPS']))) {
    return NextResponse.json({ error: 'Only operations accounts may update clients' }, { status: 403 })
  }
  let body: { id?: unknown; status?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const id = str(body.id)
  const status = str(body.status)
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  if (!status || !CLIENT_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Allowed: ${CLIENT_STATUSES.join(', ')}` }, { status: 400 })
  }

  const client = await db.client.findUnique({ where: { id } })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const updated = await db.client.update({ where: { id }, data: { status } })

  if (status !== client.status) {
    await db.auditLog.create({
      data: {
        actor: 'Operations Team', role: 'Operations', action: 'CLIENT_STATUS',
        entity: 'Client', entityRef: updated.code,
        detail: `${updated.name}: ${client.status} → ${status}`,
      },
    })
  }

  return NextResponse.json({ client: updated })
}

/**
 * DELETE /api/core/clients?id= — remove a client organization.
 * Clients that already hold operational data (locations, assets, audits,
 * exceptions, reports) can NOT be deleted — 409 { hasData: true } — pause
 * them (PATCH status=paused) instead. Empty clients are removed together
 * with their portal users in one transaction.
 */
export async function DELETE(req: NextRequest) {
  // Destructive: client removal is reserved for platform admins.
  if (!(await requireRole(req, ['ADMIN']))) {
    return NextResponse.json({ error: 'Only platform admins may remove clients' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 })

  const client = await db.client.findUnique({ where: { id } })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const [locations, assets, audits, exceptions, reports] = await Promise.all([
    db.location.count({ where: { clientId: id } }),
    db.asset.count({ where: { clientId: id } }),
    db.auditProject.count({ where: { clientId: id } }),
    db.exception.count({ where: { clientId: id } }),
    db.report.count({ where: { clientId: id } }),
  ])

  if (locations + assets + audits + exceptions + reports > 0) {
    return NextResponse.json(
      {
        error: `${client.name} still holds ${assets} asset${assets === 1 ? '' : 's'}, ${audits} audit${audits === 1 ? '' : 's'} and related records and cannot be deleted. Pause the client instead.`,
        hasData: true, locations, assets, audits, exceptions, reports,
      },
      { status: 409 },
    )
  }

  await db.$transaction([
    db.clientUser.deleteMany({ where: { clientId: id } }),
    db.client.delete({ where: { id } }),
  ])

  await db.auditLog.create({
    data: {
      actor: 'Operations Team', role: 'Operations', action: 'CLIENT_REMOVED',
      entity: 'Client', entityRef: client.code,
      detail: `${client.name} removed (no operational data)`,
    },
  })

  return NextResponse.json({ ok: true, removed: client.code })
}
