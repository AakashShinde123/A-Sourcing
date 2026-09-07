import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const AUDITOR_STATUSES = ['available', 'in_field', 'offline']
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
 * Allocate the next auditor employee code (ES-EMP-NNN).
 * Max-suffix scan keeps allocation stable after deletes (same pattern as
 * the exception/report code allocators in core-logic).
 */
async function nextEmployeeCode(): Promise<string> {
  const rows = await db.auditor.findMany({ where: { employeeCode: { startsWith: 'ES-EMP-' } }, select: { employeeCode: true } })
  let max = 0
  for (const r of rows) {
    const n = parseInt(r.employeeCode.slice('ES-EMP-'.length), 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return `ES-EMP-${String(max + 1).padStart(3, '0')}`
}

/**
 * POST /api/core/auditors — add a field team member.
 * Contract: { name, email, phone?, city? } → { auditor }
 * Duplicates (email) are rejected 409; employee code is auto-allocated.
 */
export async function POST(req: NextRequest) {
  if (!(await requireRole(req, ['ADMIN', 'OPS']))) {
    return NextResponse.json({ error: 'Only operations accounts may manage the field team' }, { status: 403 })
  }
  let body: { name?: unknown; email?: unknown; phone?: unknown; city?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const name = str(body.name)
  const email = str(body.email)?.toLowerCase() ?? null
  const phone = str(body.phone)
  const city = str(body.city)

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (name.length > 80) return NextResponse.json({ error: 'name is too long (max 80 chars)' }, { status: 400 })
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'email is not a valid address' }, { status: 400 })
  if (phone && phone.length > 24) return NextResponse.json({ error: 'phone is too long (max 24 chars)' }, { status: 400 })

  const existing = await db.auditor.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: `A team member with email ${email} already exists (${existing.name})` }, { status: 409 })

  const count = await db.auditor.count()
  let auditor
  try {
    auditor = await db.auditor.create({
      data: {
        name,
        email,
        phone,
        city,
        employeeCode: await nextEmployeeCode(),
        status: 'available',
        colorSeed: SEEDS[count % SEEDS.length],
      },
    })
  } catch (e) {
    if (isUniqueViolation(e)) return NextResponse.json({ error: 'A team member with this email already exists' }, { status: 409 })
    throw e
  }

  await db.auditLog.create({
    data: {
      actor: 'Operations Team', role: 'Operations', action: 'TEAM_MEMBER_ADDED',
      entity: 'Auditor', entityRef: auditor.employeeCode,
      detail: `${auditor.name} joined the field team${city ? ` · ${city}` : ''}`,
    },
  })

  return NextResponse.json({ auditor }, { status: 201 })
}

/**
 * PATCH /api/core/auditors — update status / contact details.
 * Contract: { id, status?, phone?, city? } → { auditor }
 * Name and email are immutable (they anchor historical verifications).
 */
export async function PATCH(req: NextRequest) {
  if (!(await requireRole(req, ['ADMIN', 'OPS']))) {
    return NextResponse.json({ error: 'Only operations accounts may manage the field team' }, { status: 403 })
  }
  let body: { id?: unknown; status?: unknown; phone?: unknown; city?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const id = str(body.id)
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const auditor = await db.auditor.findUnique({ where: { id } })
  if (!auditor) return NextResponse.json({ error: 'Team member not found' }, { status: 404 })

  const status = str(body.status)
  if (status !== undefined && status !== null && !AUDITOR_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Allowed: ${AUDITOR_STATUSES.join(', ')}` }, { status: 400 })
  }

  const updated = await db.auditor.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(body.phone !== undefined ? { phone: str(body.phone) } : {}),
      ...(body.city !== undefined ? { city: str(body.city) } : {}),
    },
  })

  if (status && status !== auditor.status) {
    await db.auditLog.create({
      data: {
        actor: 'Operations Team', role: 'Operations', action: 'TEAM_MEMBER_STATUS',
        entity: 'Auditor', entityRef: updated.employeeCode,
        detail: `${updated.name}: ${auditor.status} → ${status}`,
      },
    })
  }

  return NextResponse.json({ auditor: updated })
}

/**
 * DELETE /api/core/auditors?id= — remove a field team member.
 * Members whose work is referenced by the audit trail (assignments or
 * verifications) can NOT be deleted — the response is 409 { hasHistory: true }
 * and the client should deactivate (PATCH status=offline) instead.
 */
export async function DELETE(req: NextRequest) {
  if (!(await requireRole(req, ['ADMIN', 'OPS']))) {
    return NextResponse.json({ error: 'Only operations accounts may manage the field team' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 })

  const auditor = await db.auditor.findUnique({ where: { id } })
  if (!auditor) return NextResponse.json({ error: 'Team member not found' }, { status: 404 })

  const [assignments, verifications] = await Promise.all([
    db.auditAssignment.count({ where: { auditorId: id } }),
    db.verification.count({ where: { auditorId: id } }),
  ])

  if (assignments > 0 || verifications > 0) {
    return NextResponse.json(
      {
        error: `${auditor.name} has ${verifications} verification${verifications === 1 ? '' : 's'} and ${assignments} assignment${assignments === 1 ? '' : 's'} in the audit trail and cannot be deleted. Deactivate the member instead.`,
        hasHistory: true, verifications, assignments,
      },
      { status: 409 },
    )
  }

  await db.auditor.delete({ where: { id } })
  await db.auditLog.create({
    data: {
      actor: 'Operations Team', role: 'Operations', action: 'TEAM_MEMBER_REMOVED',
      entity: 'Auditor', entityRef: auditor.employeeCode,
      detail: `${auditor.name} removed from the field team (no audit history)`,
    },
  })

  return NextResponse.json({ ok: true, removed: auditor.employeeCode })
}
