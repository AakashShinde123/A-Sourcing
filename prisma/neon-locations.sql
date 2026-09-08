-- ============================================================================
-- EasySourcing — Neon quick-start: LOCATION TREE
-- Run this in the Neon SQL editor AFTER prisma/neon-users.sql.
--
-- Why: the Ops "Locations" tab, field-scope publishing and asset linking all
-- need the location hierarchy to exist. Fresh Postgres starts empty, and the
-- register import only links assets to locations that ALREADY exist (unknown
-- names are reported, never guessed). This file creates the demo Meridian
-- Industries tree — the same tree the sample Excels in the repo use, so an
-- import of those files links 100%.
--
-- Idempotent: safe to run multiple times (ON CONFLICT DO NOTHING).
-- After running: re-import the register file in Ops → the same rows get
-- UPDATED with their location links (import is a re-sync now).
-- ============================================================================

-- Resolve the Meridian client created by neon-users.sql (or the demo seed).
WITH cid AS (
  SELECT "id" FROM "Client" WHERE "code" = 'MRD' LIMIT 1
)
INSERT INTO "Location" ("id", "clientId", "parentId", "level", "name", "code", "address", "status")
SELECT v."id", cid."id", v."parentId", v."level", v."name", v."code", v."address", 'active'
FROM cid, (VALUES
  -- ── Site 1: Chakan Plant ────────────────────────────────────────────────
  ('loc_mrd_001', NULL::text,        'site',       'Chakan Plant',          'CKN',            'MIDC Chakan Phase 2, Pune 410501'),
  ('loc_mrd_002', 'loc_mrd_001',     'building',   'Production Block A',    'CKN-A',          NULL),
  ('loc_mrd_003', 'loc_mrd_002',     'floor',      'Ground Floor',          'CKN-A-GF',       NULL),
  ('loc_mrd_004', 'loc_mrd_003',     'zone',       'CNC Machining Zone',    'CKN-A-GF-Z1',    NULL),
  ('loc_mrd_005', 'loc_mrd_004',     'department', 'Machining Department',  'CKN-A-GF-Z1-D1', NULL),
  ('loc_mrd_006', 'loc_mrd_005',     'room',       'CNC Hall 1',            'CKN-A-GF-Z1-D1-R1', NULL),
  ('loc_mrd_007', 'loc_mrd_005',     'room',       'CNC Hall 2',            'CKN-A-GF-Z1-D1-R2', NULL),
  ('loc_mrd_008', 'loc_mrd_004',     'department', 'Assembly Department',   'CKN-A-GF-Z1-D2', NULL),
  ('loc_mrd_009', 'loc_mrd_008',     'room',       'Assembly Line 1',       'CKN-A-GF-Z1-D2-R1', NULL),
  ('loc_mrd_010', 'loc_mrd_003',     'zone',       'Utilities Zone',        'CKN-A-GF-Z2',    NULL),
  ('loc_mrd_011', 'loc_mrd_010',     'department', 'Maintenance Department','CKN-A-GF-Z2-D1', NULL),
  ('loc_mrd_012', 'loc_mrd_011',     'room',       'Workshop',              'CKN-A-GF-Z2-D1-R1', NULL),
  ('loc_mrd_013', 'loc_mrd_001',     'building',   'Warehouse Block B',     'CKN-B',          NULL),
  ('loc_mrd_014', 'loc_mrd_013',     'floor',      'Ground Floor',          'CKN-B-GF',       NULL),
  ('loc_mrd_015', 'loc_mrd_014',     'zone',       'Storage Zone',          'CKN-B-GF-Z1',    NULL),
  ('loc_mrd_016', 'loc_mrd_015',     'department', 'Finished Goods Store',  'CKN-B-GF-Z1-D1', NULL),
  ('loc_mrd_017', 'loc_mrd_016',     'room',       'FG Bay 1',              'CKN-B-GF-Z1-D1-R1', NULL),
  ('loc_mrd_018', 'loc_mrd_015',     'department', 'Raw Material Store',    'CKN-B-GF-Z1-D2', NULL),
  ('loc_mrd_019', 'loc_mrd_018',     'room',       'RM Bay',                'CKN-B-GF-Z1-D2-R1', NULL),
  -- ── Site 2: Hinjewadi Office ───────────────────────────────────────────
  ('loc_mrd_020', NULL::text,        'site',       'Hinjewadi Office',      'HNJ',            'Rajiv Gandhi Infotech Park, Phase 1, Pune 411057'),
  ('loc_mrd_021', 'loc_mrd_020',     'building',   'Office Tower',          'HNJ-T1',         NULL),
  ('loc_mrd_022', 'loc_mrd_021',     'floor',      '3rd Floor',             'HNJ-T1-L3',      NULL),
  ('loc_mrd_023', 'loc_mrd_022',     'zone',       'Engineering Zone',      'HNJ-T1-L3-Z1',   NULL),
  ('loc_mrd_024', 'loc_mrd_023',     'department', 'Design Department',     'HNJ-T1-L3-Z1-D1', NULL),
  ('loc_mrd_025', 'loc_mrd_024',     'room',       'Design Studio',         'HNJ-T1-L3-Z1-D1-R1', NULL),
  ('loc_mrd_026', 'loc_mrd_023',     'department', 'IT Department',         'HNJ-T1-L3-Z1-D2', NULL),
  ('loc_mrd_027', 'loc_mrd_026',     'room',       'Server Room',           'HNJ-T1-L3-Z1-D2-R1', NULL)
) AS v("id", "parentId", "level", "name", "code", "address")
ON CONFLICT ("id") DO NOTHING;

-- Verify: should return 27
SELECT COUNT(*) AS location_count FROM "Location" WHERE "clientId" = (SELECT "id" FROM "Client" WHERE "code" = 'MRD' LIMIT 1);
