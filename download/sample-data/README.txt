EasySourcing — Sample Testing Pack
==================================

Everything here is for testing the platform end-to-end on your own:
import a register, print the barcodes, stick them on objects, scan them
in the Auditor Mobile app.

FILES
-----
Meridian-Asset-Register-SAMPLE.xlsx
    12-asset register for the demo client "Meridian Manufacturing".
    Real Excel file — drag it straight into Ops Portal > Asset Register >
    "Import Register". Columns auto-detect; locations are real Meridian
    locations so they link automatically.

Meridian-Asset-Register-SAMPLE.csv
    Identical data as CSV, if you prefer the drop-a-file flow without Excel.

Meridian-Register-ROUND2-SAMPLE.xlsx / .csv
    DEDUP TEST: 3 of its 6 rows repeat Round 1 assets. After you import
    Round 1 then Round 2, the platform must report "3 imported, 3
    duplicates skipped" — upload the same file twice to see idempotent
    re-imports too.

barcodes/*.png
    Code 128 barcodes (industry standard for asset tags).
    BC-MRD-12xx = the barcodes written inside the sample registers.
    ES-MRD-000xx = codes of assets already registered in the demo data.

barcode-label-sheet.html
    Open in any browser → click "Print this sheet" → A4 at 100% scale
    (do NOT tick "fit to page" or scanners may not read them).
    Cut along the dashed borders, stick on any object.

HOW TO RUN A FULL TEST
----------------------
1.  Sign in as Admin (admin@easysourcing.in / Admin@2026).
2.  Ops Portal > Asset Register > Import Register.
3.  Pick client "Meridian Manufacturing Pvt Ltd", drop
    Meridian-Asset-Register-SAMPLE.xlsx → expect "Imported 12".
4.  Import Meridian-Register-ROUND2-SAMPLE.xlsx → expect
    "Imported 3", "3 duplicates skipped".
5.  Import the SAME file again → expect "0 imported, 6 duplicates
    skipped" (re-upload is always safe).
6.  Open barcode-label-sheet.html, print, cut, stick.
7.  Sign in as Auditor (auditor@easysourcing.in / Field@2026), open the
    scan tab and point at a printed tag — the matched asset is the one
    from your import.
8.  Check Ops Portal > Audit Trail — every import and sign-in is logged.

TEST TRICKS BUILT INTO THE SAMPLES
----------------------------------
* MRD-FA-2211 points at "Cafeteria Block C", a location Meridian does
  not have. The asset imports fine but its location stays unlinked —
  that is intentional (unknown locations are never guessed).
* MRD-FA-2210 and MRD-FA-2211 have blank Serial/Barcode — optional
  columns can be left empty.

SECURITY NOTE
-------------
The starter passwords (Admin@2026 / Ops@2026 / Client@2026 / Field@2026)
are for testing only. Change them from Ops Portal > Access & Accounts
before real deployment, and set a strong AUTH_SECRET env variable.
