// Generates prisma/neon-users.sql + download/neon-users.sql — a ready-to-paste
// SQL script for the Neon SQL Editor that creates the four starter login
// accounts (bcrypt(12) hashes pre-computed with the project's own bcryptjs,
// so login verification matches exactly). Self-verifies every hash before
// writing the file. Idempotent SQL: safe to re-run, refreshes starter passwords.
//
// Run from project root:  bun scripts/gen_neon_users_sql.ts
import bcrypt from 'bcryptjs'
import { writeFileSync } from 'node:fs'

const ACCOUNTS = [
  { id: 'usr_admin_seed01', email: 'admin@easysourcing.in', pw: 'Admin@2026', name: 'Platform Admin', role: 'ADMIN' },
  { id: 'usr_ops_seed01', email: 'ops@easysourcing.in', pw: 'Ops@2026', name: 'Meera Rangan', role: 'OPS' },
  { id: 'usr_client_seed01', email: 'client@easysourcing.in', pw: 'Client@2026', name: 'Kavita Deshpande', role: 'CLIENT' },
  { id: 'usr_auditor_seed01', email: 'auditor@easysourcing.in', pw: 'Field@2026', name: 'Arjun Mehta', role: 'AUDITOR' },
]

const hashes: Record<string, string> = {}
for (const a of ACCOUNTS) {
  const h = await bcrypt.hash(a.pw, 12)
  if (!(await bcrypt.compare(a.pw, h))) throw new Error('self-check FAILED for ' + a.email)
  hashes[a.email] = h
  console.log('ok', a.email.padEnd(28), a.pw.padEnd(12), h)
}

const VALUES = '    ' + ACCOUNTS.map((a) =>
  `('${a.id}','${a.email}','${hashes[a.email]}','${a.name}','${a.role}', ` +
  `${a.role === 'CLIENT' ? 'cid' : 'NULL'}, ${a.role === 'AUDITOR' ? 'aid' : 'NULL'}, true, NULL, now())`,
).join('\n  , ')

const sql = `-- ============================================================
-- EasySourcing -- create the team login accounts (Neon / PostgreSQL)
--
-- WHY: a fresh Postgres has the tables but ZERO users, so every login
-- answers "Invalid email or password". This script inserts the four
-- starter accounts (bcrypt cost-12 hashes already filled in) plus the
-- two anchor rows the CLIENT / AUDITOR links need.
--
-- HOW:  Neon Console -> your project -> "SQL Editor" -> paste ALL of
--       this -> Run.  (Or: psql "$DATABASE_URL" -f neon-users.sql)
--
-- Safe to re-run: it never duplicates and re-asserts the starter
-- passwords below. Change them afterwards in Ops Portal -> Access.
--
--   admin@easysourcing.in    ->  Admin@2026    (ADMIN)
--   ops@easysourcing.in      ->  Ops@2026      (OPS)
--   client@easysourcing.in   ->  Client@2026   (CLIENT, Meridian only)
--   auditor@easysourcing.in  ->  Field@2026    (AUDITOR, Arjun only)
-- ============================================================
DO $$
DECLARE
  cid text;
  aid text;
BEGIN
  -- 1) Client anchor for the CLIENT login (skipped if demo seed already made it)
  SELECT "id" INTO cid FROM "Client" WHERE "code" = 'MRD' LIMIT 1;
  IF cid IS NULL THEN
    INSERT INTO "Client" ("id","code","name","industry","status","contact","email","phone","city","since","colorSeed")
    VALUES ('cl_mrd_seed01','MRD','Meridian Industries Pvt Ltd','Manufacturing','active',
            'Rohit Sharma','rohit@meridian.example','+91 98200 11223','Mumbai',
            now() - interval '900 days','emerald')
    RETURNING "id" INTO cid;
  END IF;

  -- 2) Field-team anchor for the AUDITOR login
  SELECT "id" INTO aid FROM "Auditor" WHERE "email" = 'arjun.m@easysourcing.in' LIMIT 1;
  IF aid IS NULL THEN
    INSERT INTO "Auditor" ("id","name","email","phone","employeeCode","status","city","colorSeed")
    VALUES ('aud_arjun_seed01','Arjun Mehta','arjun.m@easysourcing.in','+91 98100 22334',
            'ES-FLD-004','available','Pune','teal')
    RETURNING "id" INTO aid;
  END IF;

  -- 3) The four login accounts (emails are lowercased by the login route)
  INSERT INTO "User" ("id","email","passwordHash","name","role","clientId","auditorId","active","lastLoginAt","createdAt")
  VALUES
${VALUES}
  ON CONFLICT ("email") DO UPDATE
    SET "passwordHash" = EXCLUDED."passwordHash"
      , "name"   = EXCLUDED."name"
      , "role"   = EXCLUDED."role"
      , "active" = true;
END $$;

-- 4) Verify: you should see the four rows, all active
SELECT "email", "name", "role", "active", "createdAt" FROM "User" ORDER BY "createdAt";
`

writeFileSync('prisma/neon-users.sql', sql)
writeFileSync('download/neon-users.sql', sql)
console.log('\nwrote prisma/neon-users.sql and download/neon-users.sql')
