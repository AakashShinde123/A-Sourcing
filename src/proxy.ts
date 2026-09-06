import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

// @es/core · proxy — the platform's single gatekeeper (Next.js 16 proxy, the
// successor of middleware).
//  1. Security headers on every response (frames, sniffing, referrer, permissions).
//  2. CSRF: mutating cross-origin API calls are rejected (cookie is sameSite=lax —
//     this is the explicit second layer for non-browser clients).
//  3. Authentication: every /api/core/* request needs a valid session JWT.
//     /api/auth/* stays public (login itself must be reachable when signed out).

const PUBLIC_API = new Set(['/api/auth/login', '/api/auth/logout', '/api/auth/me'])

function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()')
  return res
}

function jsonError(status: number, error: string): NextResponse {
  return withSecurityHeaders(NextResponse.json({ error }, { status }))
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isApi = pathname.startsWith('/api/')

  // ── CSRF guard: cross-origin mutations are never accepted ──
  if (isApi && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.get('origin')
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.get('host')) {
          return jsonError(403, 'Cross-origin request rejected')
        }
      } catch {
        return jsonError(403, 'Invalid origin header')
      }
    }
  }

  // ── Authentication gate for the Core API ──
  if (pathname.startsWith('/api/core/')) {
    const token = req.cookies.get(SESSION_COOKIE)?.value
    const session = token ? await verifySessionToken(token) : null
    if (!session) return jsonError(401, 'Authentication required — sign in to the platform')
    return withSecurityHeaders(NextResponse.next())
  }

  if (isApi && !PUBLIC_API.has(pathname) && pathname.startsWith('/api/auth/')) {
    // future /api/auth/* additions default to protected
    const token = req.cookies.get(SESSION_COOKIE)?.value
    const session = token ? await verifySessionToken(token) : null
    if (!session) return jsonError(401, 'Authentication required')
    return withSecurityHeaders(NextResponse.next())
  }

  return withSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
