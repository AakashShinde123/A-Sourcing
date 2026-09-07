#!/usr/bin/env node
/**
 * Prisma generate with automatic provider detection.
 *
 * The repo ships TWO Prisma schemas:
 *   prisma/schema.prisma           → sqlite     (local dev, db/custom.db)
 *   prisma/schema.postgres.prisma  → postgresql (Neon / any Postgres — deploys)
 *
 * Runs as the `postinstall` hook: on Vercel DATABASE_URL points at Postgres,
 * so the Postgres client is generated; locally (no env or file: URL) the
 * SQLite client is generated. Zero manual schema edits, zero deploy failures.
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

function dbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  for (const p of ['.env', 'prisma/.env']) {
    try {
      const m = readFileSync(p, 'utf8').match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m)
      if (m) return m[1].replace(/^["']|["']$/g, '')
    } catch { /* file missing — try next */ }
  }
  return ''
}

const url = dbUrl()
const isPg = /^postgres(ql)?:\/\//i.test(url)
const schema = isPg ? 'prisma/schema.postgres.prisma' : 'prisma/schema.prisma'

console.log(`[prisma-generate] DATABASE_URL ${url ? (isPg ? 'is Postgres' : 'is SQLite/file') : 'not set'} → generating client from ${schema}`)
execSync(`npx prisma generate --schema ${schema}`, { stdio: 'inherit' })
