-- ─────────────────────────────────────────────────────────────────────
-- EasySourcing — one-time schema catch-up: REAL evidence photos
-- Paste into Neon Console → SQL Editor and run. Idempotent (safe to re-run).
--
-- Adds the Evidence.image column that stores each field photo (compact JPEG).
-- Also rescues rows written by the old build (photo data stuck inside
-- colorSeed) so every photo taken before this update shows up too.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS image TEXT;

UPDATE "Evidence"
SET image = "colorSeed", "colorSeed" = 'emerald'
WHERE image IS NULL AND "colorSeed" LIKE 'data:image/%';

-- Verify: should return the number of photos now stored
SELECT COUNT(*) AS photos_in_db FROM "Evidence" WHERE image IS NOT NULL;
