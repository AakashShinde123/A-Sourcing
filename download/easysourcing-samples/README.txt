EasySourcing — Sample Test Kit
==============================

Everything here works against the seeded demo data (client: Meridian
Manufacturing Pvt Ltd, code MRD). Import flow lives in:
  Ops Portal → Assets → "Import Register"
  (Client Portal has the same button, locked to the client's own scope)

WHAT'S INSIDE
-------------
sample-asset-register-fresh.xlsx      10 clean asset rows — the happy path
sample-asset-register-fresh.csv       same 10 rows as a plain ERP CSV export
sample-asset-register-dedup-check.xlsx 4 rows re-uploaded + 2 brand-new rows
sample-asset-register-errors.xlsx     3 broken rows + 2 valid rows
barcodes/qr/*.png                     QR codes (phone camera)
barcodes/code128/*.png                Code128 barcodes (laser scanner)
barcodes/printable-labels.pdf         A4 sheet — print, cut, stick on test assets

RECOMMENDED TEST SCRIPT
-----------------------
1. Sign in as admin@easysourcing.in / Admin@2026  (see note below)
2. Ops Portal → Assets → Import Register
3. Pick client "Meridian Manufacturing", drop sample-asset-register-fresh.xlsx
   → preview shows "10 valid, headers mapped automatically"
   → Import → 10 imported · 0 duplicates · 0 rejected
   → asset codes ES-MRD-00090…00099 are allocated automatically
4. Import the SAME file again (or the dedup-check file)
   → previously seen Asset IDs are skipped as duplicates (idempotent, no
   double registration). dedup-check.xlsx adds 2 new assets.
5. Drop sample-asset-register-errors.xlsx
   → 3 rows are rejected with reasons (missing Particulars / Group / Asset ID),
   2 valid rows import. Nothing partial ever lands silently.
6. Barcodes: print barcodes/printable-labels.pdf at 100% scale (do NOT use
   fit-to-page — scanners are scale-sensitive). The Tag column in the Excel
   files matches these labels, so after import you can search the tag
   (e.g. MRD-TAG-1001) and the asset appears. ES-MRD-00043 / ES-MRD-00089
   labels match assets that exist out of the box.
7. Open the Auditor portal (auditor@easysourcing.in / Field@2026) → Search tab
   → type MRD-TAG-1001 or scan/enter the tag → verify → save.
   Every step lands in Ops → Audit Trail.

HEADER ALIASES (why the Excel looks odd)
----------------------------------------
The files deliberately use real-ERP column names — Asset ID, Particulars,
Group, Brand, Model No, Serial No, Tag, Floor, Holder — the importer maps
them automatically. Your client's own exports will work the same way.

LOCATION MATCHING
-----------------
Location names are matched case-insensitively against the client's location
tree (e.g. "CNC Hall 1", "Warehouse Block B", "Server Room" link cleanly;
"Annex Shed" in the fresh file is unknown on purpose → asset still imports,
just without a location link).

NOTE ON PASSWORDS
-----------------
Starter logins (also shown on the login screen):
  admin@easysourcing.in    Admin@2026     (ADMIN — full access + accounts)
  ops@easysourcing.in      Ops@2026       (OPS  — operations portal)
  client@easysourcing.in   Client@2026    (CLIENT — Meridian data only)
  auditor@easysourcing.in  Field@2026     (AUDITOR — mobile field app)
Change them in Ops Portal → Access & Accounts before real use.
