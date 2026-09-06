// @es/core · session — edge-safe session primitives (jose only, no Node APIs).
// Imported by the middleware (edge runtime) AND by server routes. bcrypt and
// Prisma live in lib/auth.ts — never import that file from the middleware.

import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'es_session'

export type Role = 'ADMIN' | 'OPS' | 'CLIENT' | 'AUDITOR'
export const ROLES: Role[] = ['ADMIN', 'OPS', 'CLIENT', 'AUDITOR']

export interface SessionPayload {
  uid: string
  role: Role
  name: string
  clientId?: string
  auditorId?: string
}

/**
 * AUTH_SECRET must be provided in production (`openssl rand -base64 32`).
 * Dev/test fall back to a stable local secret so hot reloads keep sessions.
 */
function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET || 'es-dev-secret-a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
  return new TextEncoder().encode(s)
}

export async function signSession(p: SessionPayload, maxAgeSeconds: number): Promise<string> {
  return new SignJWT({ uid: p.uid, role: p.role, name: p.name, clientId: p.clientId, auditorId: p.auditorId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('easysourcing')
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSeconds)
    .sign(secretKey())
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: 'easysourcing' })
    if (typeof payload.uid !== 'string' || typeof payload.role !== 'string') return null
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export const SESSION_MAX_AGE = 60 * 60 * 12 // 12 hours
export const SESSION_MAX_AGE_REMEMBER = 60 * 60 * 24 * 30 // 30 days ("keep me signed in")

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

export const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 0,
}
