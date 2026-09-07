-- ============================================================
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
    ('usr_admin_seed01','admin@easysourcing.in','$2b$12$qtOK978EyYzy.2IJC7xUSu4XIcZ59SG.grLY6Qw4O4VtigeYkTnYO','Platform Admin','ADMIN', NULL, NULL, true, NULL, now())
  , ('usr_ops_seed01','ops@easysourcing.in','$2b$12$1KDA5vuZBUliDkj1rOfvye3rQOf8Alxx99rrAfYiGM4N/tn9OPxCG','Meera Rangan','OPS', NULL, NULL, true, NULL, now())
  , ('usr_client_seed01','client@easysourcing.in','$2b$12$HcSyYgNaEpZdMR90UDRpbOkFY6cp5FUO/nucbS.tnBf0QAkeoXIVq','Kavita Deshpande','CLIENT', cid, NULL, true, NULL, now())
  , ('usr_auditor_seed01','auditor@easysourcing.in','$2b$12$U74SqToBFy7XOsLuxzS1YOBsLVoBgSK9/R/lHB3JtkcEynawiAjIK','Arjun Mehta','AUDITOR', NULL, aid, true, NULL, now())
  ON CONFLICT ("email") DO UPDATE
    SET "passwordHash" = EXCLUDED."passwordHash"
      , "name"   = EXCLUDED."name"
      , "role"   = EXCLUDED."role"
      , "active" = true;
END $$;

-- 4) Verify: you should see the four rows, all active
SELECT "email", "name", "role", "active", "createdAt" FROM "User" ORDER BY "createdAt";
