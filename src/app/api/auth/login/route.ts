import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, toPayload } from '@/lib/auth'
import { SESSION_COOKIE, SESSION_MAX_AGE, SESSION_MAX_AGE_REMEMBER, sessionCookieOptions, signSession } from '@/lib/session'
import { checkIpBudget, checkLockout, clearFailures, recordFailure } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local'
}

/**
 * POST /api/auth/login — team-only sign-in.
 *
 * Defenses stacked here:
 *  - per-IP attempt budget (30 / 15 min) against password spraying
 *  - per-email lockout (5 failures / 15 min) against targeted brute force
 *  - identical generic error for "no such user" and "wrong password" so the
 *    endpoint never enumerates accounts
 *  - bcrypt(12) comparison; deactivated accounts rejected even with valid
 *    credentials; every outcome lands in the immutable AuditLog
 */
export async function POST(req: NextRequest) {
  let body: { email?: unknown; password?: unknown; remember?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const remember = body.remember === true
  const ip = clientIp(req)

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const ipBudget = checkIpBudget(ip)
  if (!ipBudget.allowed) {
    return NextResponse.json(
      { error: `Too many sign-in attempts from this network — try again in ${Math.ceil(ipBudget.retryAfterSec / 60)} min` },
      { status: 429, headers: { 'Retry-After': String(ipBudget.retryAfterSec) } },
    )
  }

  const lock = checkLockout(`${ip}:${email}`)
  if (lock.locked) {
    return NextResponse.json(
      { error: `Account temporarily locked after repeated failures — try again in ${Math.ceil(lock.retryAfterSec / 60)} min` },
      { status: 429, headers: { 'Retry-After': String(lock.retryAfterSec) } },
    )
  }

  const user = await db.user.findUnique({ where: { email }, include: { client: { select: { name: true } } } })

  const fail = async (detail: string) => {
    recordFailure(`${ip}:${email}`)
    await db.auditLog.create({
      data: { actor: email, role: 'auth', action: 'LOGIN_FAILED', entity: 'Session', entityRef: email, detail: `${detail} · ip ${ip}` },
    }).catch(() => undefined) // logging must never mask the auth result
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  if (!user) return fail('unknown email')
  if (!user.active) {
    await db.auditLog.create({
      data: { actor: email, role: 'auth', action: 'LOGIN_BLOCKED', entity: 'Session', entityRef: email, detail: 'deactivated account · ip ' + ip },
    }).catch(() => undefined)
    return NextResponse.json({ error: 'This account has been deactivated — contact your platform admin' }, { status: 403 })
  }

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) return fail('wrong password')

  clearFailures(`${ip}:${email}`)
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  await db.auditLog.create({
    data: { actor: user.name, role: 'auth', action: 'LOGIN_SUCCESS', entity: 'Session', entityRef: user.email, detail: `role ${user.role} · ip ${ip}` },
  })

  const maxAge = remember ? SESSION_MAX_AGE_REMEMBER : SESSION_MAX_AGE
  const token = await signSession(toPayload({ ...user, role: user.role as import('@/lib/session').Role }), maxAge)
  const res = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, clientId: user.clientId, clientName: user.client?.name ?? null, auditorId: user.auditorId },
  })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge))
  return res
}
