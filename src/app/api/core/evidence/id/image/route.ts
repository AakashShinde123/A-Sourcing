import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/core/evidence/[id]/image — stream a captured field photo.
 *
 * Evidence rows store the photo as a compact JPEG data URL (`Evidence.image`).
 * Portals reference this endpoint from <img> tags instead of bootstrap shipping
 * megabytes of base64 — same-origin cookies authorize the request automatically.
 *
 * Legacy self-heal: rows written by the old build kept the whole data URL in
 * `colorSeed`. When we meet one, we serve it AND migrate the row in place
 * (image = payload, colorSeed = a plain seed) — existing Neon data is repaired
 * on first view with zero manual SQL.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(req, ['ADMIN', 'OPS', 'CLIENT', 'AUDITOR'])
  if (!session) return NextResponse.json({ error: 'Sign in to view evidence' }, { status: 403 })

  const { id } = await params
  const ev = await db.evidence.findUnique({ where: { id } })
  if (!ev) return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
  // Client accounts only ever see their own evidence (404, not 403 — no existence leak).
  if (session.role === 'CLIENT' && ev.clientId !== session.clientId) {
    return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
  }

  // Pick the payload: proper column first, legacy colorSeed second.
  let payload = ev.image
  if (!payload && ev.colorSeed.startsWith('data:image/')) {
    payload = ev.colorSeed
    // Opportunistic one-time repair — idempotent, single row, invisible to users.
    await db.evidence.update({ where: { id: ev.id }, data: { image: payload, colorSeed: 'emerald' } })
  }
  if (!payload) return NextResponse.json({ error: 'This evidence has no photo' }, { status: 404 })

  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/s.exec(payload)
  if (!m) return NextResponse.json({ error: 'Evidence photo is unreadable' }, { status: 404 })

  const bytes = Buffer.from(m[2], 'base64')
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': m[1],
      'Content-Length': String(bytes.length),
      // Evidence is immutable — browsers may cache it for the session lifetime.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  })
}
