#!/usr/bin/env bun
/**
 * Switch Prisma datasource provider between local SQLite and Postgres (Neon).
 *
 *   bun scripts/use-db.ts sqlite     # local dev  (db/custom.db)
 *   bun scripts/use-db.ts postgres   # Neon / any Postgres (DATABASE_URL)
 *
 * Run `bun run db:push` afterwards to sync the schema, then paste
 * prisma/neon-users.sql into the Neon SQL Editor to (re)create login accounts.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SCHEMA = new URL('../prisma/schema.prisma', import.meta.url).pathname;
const target = process.argv[2]?.toLowerCase();

if (target !== 'sqlite' && target !== 'postgres') {
  console.error('Usage: bun scripts/use-db.ts <sqlite|postgres>');
  process.exit(1);
}

let src = readFileSync(SCHEMA, 'utf8');
const current = src.match(/provider\s*=\s*"(sqlite|postgresql)"/)?.[1];
if (!current) {
  console.error('Could not find a provider line in prisma/schema.prisma');
  process.exit(1);
}

const wanted = target === 'postgres' ? 'postgresql' : 'sqlite';
if (current === wanted) {
  console.log(`Already using ${wanted}. Nothing to do.`);
} else {
  src = src.replace(/(provider\s*=\s*")(sqlite|postgresql)(")/, `$1${wanted}$3`);
  writeFileSync(SCHEMA, src);
  console.log(`Provider switched: ${current} → ${wanted}`);
}

if (wanted === 'sqlite') {
  console.log('Next: bun run db:push   (local file db/custom.db)');
} else {
  console.log('Next: set DATABASE_URL to your Neon string, then bun run db:push');
  console.log('Then: paste prisma/neon-users.sql into Neon SQL Editor (login accounts).');
}
