// @es/core · auth — server-side identity helpers (Node runtime: bcrypt + Prisma).
// The edge middleware authenticates every /api/core/* request; handlers call
// getSessionUser()/requireRole() only where RBAC needs the full user row.

import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { SESSION_COOKIE, verifySessionToken, type Role, type SessionPayload } from '@/lib/session'

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/** Password policy: 8–128 chars, at least one letter and one number. */
export function passwordIssue(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters'
  if (pw.length > 128) return 'Password must be at most 128 characters'
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must include at least one letter and one number'
  return null
}

const PW_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
/** Generate a policy-compliant random password (admin "reset password" flow). */
export function generatePassword(len = 12): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < len; i++) out += PW_ALPHABET[bytes[i] % PW_ALPHABET.length]
  // guarantee letter + number per policy
  if (!/[0-9]/.test(out)) out = out.slice(0, -1) + '7'
  return out
}

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  clientId: string | null
  clientName: string | null
  auditorId: string | null
  auditorName: string | null
  active: boolean
}

/** Full user row behind the session cookie — null when absent/expired/deactivated. */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  const payload = await verifySessionToken(token)
  if (!payload) return null
  const user = await db.user.findUnique({
    where: { id: payload.uid },
    include: { client: { select: { name: true } }, auditor: { select: { name: true } } },
  })
  if (!user || !user.active) return null
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    clientId: user.clientId,
    clientName: user.client?.name ?? null,
    auditorId: user.auditorId,
    auditorName: user.auditor?.name ?? null,
    active: user.active,
  }
}

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && ['ADMIN', 'OPS', 'CLIENT', 'AUDITOR'].includes(v)
}

/** Roles that run the Operations Portal side of the platform (internal team). */
export const TEAM_ROLES: Role[] = ['ADMIN', 'OPS']

/**
 * Route-level RBAC gate — returns the session user when their role is allowed,
 * otherwise null. Handlers respond 403 when null (401 is reserved for the
 * proxy's "no session at all" answer, so clients can distinguish the two).
 */
export async function requireRole(req: NextRequest, roles: Role[]): Promise<SessionUser | null> {
  const user = await getSessionUser(req)
  if (!user || !roles.includes(user.role)) return null
  return user
}

/** Normalized session payload for signing (used by login + tests). */
export function toPayload(u: { id: string; name: string; role: Role; clientId?: string | null; auditorId?: string | null }): SessionPayload {
  return { uid: u.id, role: u.role, name: u.name, clientId: u.clientId ?? undefined, auditorId: u.auditorId ?? undefined }
}
