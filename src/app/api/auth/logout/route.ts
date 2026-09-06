import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { CLEAR_COOKIE_OPTIONS, SESSION_COOKIE } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/auth/logout — clears the session cookie; logs the event when the session is still valid. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req).catch(() => null)
  if (user) {
    await db.auditLog.create({
      data: { actor: user.name, role: 'auth', action: 'LOGOUT', entity: 'Session', entityRef: user.email, detail: `role ${user.role}` },
    }).catch(() => undefined)
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', CLEAR_COOKIE_OPTIONS)
  return res
}
