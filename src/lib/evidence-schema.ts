import { db } from '@/lib/db'

/**
 * Photo-evidence schema guard.
 *
 * Deployments whose database predates real evidence photos lack the
 * `Evidence.image` column — but the Prisma client (generated from the current
 * schema) SELECTs that column on EVERY Evidence query, so until it exists the
 * whole platform 500s, not just photo uploads.
 *
 * Instead of demanding a manual migration, every route that touches Evidence
 * calls this once per process before querying: it adds the column in place
 * (idempotent, metadata-only DDL — instant even on large tables). When the DB
 * role may not ALTER, we degrade gracefully: callers fall back to the legacy
 * `colorSeed` channel, which the portals render identically.
 */
let ready: Promise<boolean> | null = null

export function ensureEvidenceImageColumn(): Promise<boolean> {
  ready ??= (async () => {
    // Postgres first (Neon/production), then the SQLite dialect for local dev —
    // a "duplicate column" rejection means it already exists, which is success.
    for (const stmt of [
      'ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS image TEXT',
      'ALTER TABLE "Evidence" ADD COLUMN image TEXT',
    ]) {
      try {
        await db.$executeRawUnsafe(stmt)
        return true
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (/duplicate column|already exists/i.test(msg)) return true
        // otherwise try the next dialect statement
      }
    }
    return false
  })()
  return ready
}

/** Test hook: forget the cached migration so a suite can drop the column and
 *  re-run the guard against a genuinely missing schema state. */
export function __resetEvidenceSchemaCacheForTests(): void {
  ready = null
}
