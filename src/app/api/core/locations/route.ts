import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** Site → room, the fixed depth chain of the location hierarchy. */
const LEVELS = ['site', 'building', 'floor', 'zone', 'department', 'room'] as const
type Level = (typeof LEVELS)[number]

const nextLevel = (parent: Level | null): Level => {
  if (!parent) return 'site'
  const i = LEVELS.indexOf(parent)
  return LEVELS[Math.min(i + 1, LEVELS.length - 1)]
}

const str = (v: unknown): string | null => {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/** GPS sanity: lat ∈ [-90,90], lng ∈ [-180,180] — absent keys leave values untouched. */
function parseGps(body: Record<string, unknown>): { lat: number | null; lng: number | null; has: boolean } | { error: string } {
  const hasLat = body.gpsLat !== undefined
  const hasLng = body.gpsLng !== undefined
  const lat = hasLat ? num(body.gpsLat) : null
  const lng = hasLng ? num(body.gpsLng) : null
  if (Number.isNaN(lat) || Number.isNaN(lng)) return { error: 'gpsLat/gpsLng must be numbers' }
  if (lat !== null && (lat < -90 || lat > 90)) return { error: 'gpsLat must be between -90 and 90' }
  if (lng !== null && (lng < -180 || lng > 180)) return { error: 'gpsLng must be between -180 and 180' }
  return { lat, lng, has: hasLat || hasLng }
}

/**
 * /api/core/locations — in-app location tree management (no SQL needed).
 *
 * POST   create a node      { clientId, name, code?, parentId?, level?, address?, gpsLat?, gpsLng? }
 * PATCH  update a node      { id, name?, code?, parentId?, level?, address?, gpsLat?, gpsLng? }
 * DELETE ?id=               remove a leaf node (no children, no assets)
 *
 * Guards that keep the tree honest:
 *  - parent must belong to the same client; reparenting can never create a cycle
 *  - level defaults to the next step under the parent (root → site)
 *  - codes stay unique inside a client when provided (auto-generated from the name otherwise)
 *  - a node with children or linked assets cannot be deleted
 * RBAC: ADMIN/OPS only — the register's structure is an ops workflow.
 */
export async function POST(req: NextRequest) {
  const actor = await requireRole(req, ['ADMIN', 'OPS'])
  if (!actor) return NextResponse.json({ error: 'Only operations accounts can manage locations' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const clientId = str(body.clientId)
  const name = str(body.name)
  if (!clientId || !name) return NextResponse.json({ error: 'clientId and name are required' }, { status: 400 })

  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) return NextResponse.json({ error: 'clientId not found' }, { status: 404 })

  const parentId = str(body.parentId)
  let parent: { id: string; level: Level } | null = null
  if (parentId) {
    const p = await db.location.findUnique({ where: { id: parentId } })
    if (!p) return NextResponse.json({ error: 'parentId not found' }, { status: 404 })
    if (p.clientId !== clientId) {
      return NextResponse.json({ error: 'Parent location belongs to a different client' }, { status: 400 })
    }
    parent = { id: p.id, level: p.level as Level }
  }

  const requestedLevel = str(body.level)
  const level = (requestedLevel ?? nextLevel(parent?.level ?? null)) as Level
  if (!LEVELS.includes(level)) {
    return NextResponse.json({ error: `level must be one of: ${LEVELS.join(', ')}` }, { status: 400 })
  }
  if (parent && LEVELS.indexOf(level) <= LEVELS.indexOf(parent.level)) {
    return NextResponse.json({ error: `A ${level} cannot sit inside a ${parent.level} — pick a deeper level` }, { status: 400 })
  }

  const code = str(body.code)
  if (code) {
    const clash = await db.location.findFirst({ where: { clientId, code } })
    if (clash) return NextResponse.json({ error: `Code “${code}” is already used by ${clash.name} for this client` }, { status: 409 })
  }

  const gps = parseGps(body)
  if ('error' in gps) return NextResponse.json({ error: gps.error }, { status: 400 })

  const created = await db.location.create({
    data: {
      clientId, parentId: parent?.id ?? null, level, name,
      code: code ?? name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 24),
      address: str(body.address),
      gpsLat: gps.lat, gpsLng: gps.lng,
    },
  })

  await db.auditLog.create({
    data: {
      actor: actor.name, role: 'access', action: 'LOCATION_CREATED', entity: 'Location', entityRef: created.id,
      detail: `${created.level} “${created.name}”${parent ? ` under a ${parent.level}` : ' (top level)'}${created.gpsLat != null ? ` · GPS ${created.gpsLat.toFixed(5)}, ${created.gpsLng?.toFixed(5)}` : ''}`,
    },
  })

  return NextResponse.json({ location: created }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const actor = await requireRole(req, ['ADMIN', 'OPS'])
  if (!actor) return NextResponse.json({ error: 'Only operations accounts can manage locations' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const id = str(body.id)
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const existing = await db.location.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Location not found' }, { status: 404 })

  const data: { name?: string; code?: string; level?: Level; parentId?: string | null; address?: string | null; gpsLat?: number | null; gpsLng?: number | null } = {}

  const name = str(body.name)
  if (name && name !== existing.name) data.name = name

  const code = str(body.code)
  if (code && code !== existing.code) {
    const clash = await db.location.findFirst({ where: { clientId: existing.clientId, code } })
    if (clash && clash.id !== id) return NextResponse.json({ error: `Code “${code}” is already used by ${clash.name} for this client` }, { status: 409 })
    data.code = code
  }

  if (body.parentId !== undefined) {
    const parentId = str(body.parentId)
    if (parentId === id) return NextResponse.json({ error: 'A location cannot be its own parent' }, { status: 400 })
    if (parentId) {
      let cur = await db.location.findUnique({ where: { id: parentId } })
      if (!cur) return NextResponse.json({ error: 'parentId not found' }, { status: 404 })
      if (cur.clientId !== existing.clientId) {
        return NextResponse.json({ error: 'Parent location belongs to a different client' }, { status: 400 })
      }
      // cycle guard: walk up from the new parent — must never reach the node itself
      let guard = 0
      while (cur && guard++ < 20) {
        if (cur.id === id) return NextResponse.json({ error: 'Moving a location under its own subtree would create a loop' }, { status: 400 })
        cur = cur.parentId ? await db.location.findUnique({ where: { id: cur.parentId } }) : null
      }
      data.parentId = parentId
    } else {
      data.parentId = null
    }
  }

  if (body.address !== undefined) data.address = str(body.address)

  const gps = parseGps(body)
  if ('error' in gps) return NextResponse.json({ error: gps.error }, { status: 400 })
  if (gps.has) {
    // PATCH pairs: send both or neither — a lone coordinate would corrupt the fix
    if (gps.has && ((body.gpsLat !== undefined && body.gpsLng === undefined) || (body.gpsLng !== undefined && body.gpsLat === undefined))) {
      return NextResponse.json({ error: 'Send gpsLat and gpsLng together' }, { status: 400 })
    }
    data.gpsLat = gps.lat
    data.gpsLng = gps.lng
  }

  const requestedLevel = str(body.level)
  if (requestedLevel) {
    if (!LEVELS.includes(requestedLevel as Level)) {
      return NextResponse.json({ error: `level must be one of: ${LEVELS.join(', ')}` }, { status: 400 })
    }
    data.level = requestedLevel as Level
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const updated = await db.location.update({ where: { id }, data })

  await db.auditLog.create({
    data: {
      actor: actor.name, role: 'access', action: 'LOCATION_UPDATED', entity: 'Location', entityRef: id,
      detail: `“${updated.name}” updated (${Object.keys(data).join(', ')})${updated.gpsLat != null ? ` · GPS ${updated.gpsLat.toFixed(5)}, ${updated.gpsLng?.toFixed(5)}` : ''}`,
    },
  })

  return NextResponse.json({ location: updated })
}

export async function DELETE(req: NextRequest) {
  const actor = await requireRole(req, ['ADMIN', 'OPS'])
  if (!actor) return NextResponse.json({ error: 'Only operations accounts can manage locations' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Provide ?id=locationId' }, { status: 400 })

  const existing = await db.location.findUnique({
    where: { id },
    include: { _count: { select: { children: true, assets: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Location not found' }, { status: 404 })

  if (existing._count.children > 0) {
    return NextResponse.json({ error: `“${existing.name}” still has ${existing._count.children} sub-location(s) — delete or move them first` }, { status: 409 })
  }
  if (existing._count.assets > 0) {
    return NextResponse.json({ error: `“${existing.name}” still holds ${existing._count.assets} asset(s) — move them to another location first` }, { status: 409 })
  }

  await db.location.delete({ where: { id } })
  await db.auditLog.create({
    data: {
      actor: actor.name, role: 'access', action: 'LOCATION_DELETED', entity: 'Location', entityRef: id,
      detail: `${existing.level} “${existing.name}” deleted`,
    },
  })

  return NextResponse.json({ deleted: id })
}
