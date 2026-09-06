import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generatePassword, getSessionUser, hashPassword, isRole, passwordIssue, verifyPassword } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PUBLIC_FIELDS = { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, createdAt: true, clientId: true, auditorId: true } as const

async function requireAdmin(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user || user.role !== 'ADMIN') return null
  return user
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * GET /api/auth/users — platform accounts for the Ops → Access view (ADMIN only).
 * Password hashes never leave the server; client/auditor names join for scope display.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const users = await db.user.findMany({
    select: { ...PUBLIC_FIELDS, client: { select: { name: true } }, auditor: { select: { name: true } } },
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json({
    users: users.map((u) => ({ ...u, clientName: u.client?.name ?? null, auditorName: u.auditor?.name ?? null, client: undefined, auditor: undefined })),
  })
}

/**
 * POST /api/auth/users — create a team account (ADMIN only).
 * { name, email, password, role, clientId?, auditorId? }
 * Role CLIENT must carry a valid clientId; AUDITOR a valid auditorId —
 * that link is what scopes their portal view and data access.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = body.password
  const role = body.role

  if (name.length < 2 || name.length > 80) return NextResponse.json({ error: 'Name must be 2–80 characters' }, { status: 400 })
  if (!emailRe.test(email)) return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
  if (!isRole(role)) return NextResponse.json({ error: 'Role must be one of ADMIN, OPS, CLIENT, AUDITOR' }, { status: 400 })
  const pwIssue = passwordIssue(password)
  if (pwIssue) return NextResponse.json({ error: pwIssue }, { status: 400 })

  const clientId = typeof body.clientId === 'string' && body.clientId ? body.clientId : null
  const auditorId = typeof body.auditorId === 'string' && body.auditorId ? body.auditorId : null

  if (role === 'CLIENT') {
    if (!clientId) return NextResponse.json({ error: 'CLIENT accounts must be linked to a client' }, { status: 400 })
    if (!(await db.client.findUnique({ where: { id: clientId } }))) return NextResponse.json({ error: 'clientId not found' }, { status: 404 })
  } else if (role === 'AUDITOR') {
    if (!auditorId) return NextResponse.json({ error: 'AUDITOR accounts must be linked to a field team member' }, { status: 400 })
    const auditor = await db.auditor.findUnique({ where: { id: auditorId } })
    if (!auditor) return NextResponse.json({ error: 'auditorId not found' }, { status: 404 })
    if (await db.user.findUnique({ where: { auditorId } })) return NextResponse.json({ error: 'This field team member already has a login account' }, { status: 409 })
  } else if (clientId || auditorId) {
    return NextResponse.json({ error: 'Only CLIENT/AUDITOR accounts carry a data scope' }, { status: 400 })
  }

  if (await db.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const created = await db.user.create({
    data: { name, email, role, passwordHash: await hashPassword(password as string), clientId: role === 'CLIENT' ? clientId : null, auditorId: role === 'AUDITOR' ? auditorId : null },
    select: PUBLIC_FIELDS,
  })
  await db.auditLog.create({
    data: { actor: admin.name, role: 'access', action: 'USER_ADDED', entity: 'User', entityRef: email, detail: `role ${role}${clientId ? ' · client scope' : ''}${auditorId ? ' · auditor scope' : ''}` },
  })
  return NextResponse.json({ user: created }, { status: 201 })
}

/**
 * PATCH /api/auth/users — account lifecycle (ADMIN only).
 * { id, action: 'deactivate' | 'activate' | 'reset-password', password? }
 *
 * Guards:
 *  - you cannot deactivate yourself (lockout by misfire)
 *  - deactivating an ADMIN requires ≥ 1 other active ADMIN (no admin-less platform)
 *  - generated passwords are returned exactly once and never logged
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id : ''
  const action = typeof body.action === 'string' ? body.action : ''
  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (action === 'deactivate' || action === 'activate') {
    if (target.id === admin.id && action === 'deactivate') {
      return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 409 })
    }
    if (action === 'deactivate' && target.role === 'ADMIN') {
      const activeAdmins = await db.user.count({ where: { role: 'ADMIN', active: true } })
      if (activeAdmins <= 1) return NextResponse.json({ error: 'Cannot deactivate the last active admin' }, { status: 409 })
    }
    const updated = await db.user.update({ where: { id }, data: { active: action === 'activate' }, select: PUBLIC_FIELDS })
    await db.auditLog.create({
      data: { actor: admin.name, role: 'access', action: action === 'deactivate' ? 'USER_DEACTIVATED' : 'USER_REACTIVATED', entity: 'User', entityRef: target.email },
    })
    return NextResponse.json({ user: updated })
  }

  if (action === 'reset-password') {
    let next = typeof body.password === 'string' ? body.password : ''
    let generated = false
    if (!next) {
      next = generatePassword()
      generated = true
    } else {
      const issue = passwordIssue(next)
      if (issue) return NextResponse.json({ error: issue }, { status: 400 })
    }
    await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(next) } })
    await db.auditLog.create({
      data: { actor: admin.name, role: 'access', action: 'PASSWORD_RESET', entity: 'User', entityRef: target.email, detail: generated ? 'auto-generated password' : 'admin-set password' },
    })
    return NextResponse.json({ ok: true, password: generated ? next : undefined, generated })
  }

  return NextResponse.json({ error: 'action must be deactivate | activate | reset-password' }, { status: 400 })
}
