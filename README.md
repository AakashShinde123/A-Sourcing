# EasySourcing — Asset Verification & Audit Platform

Procurement / physical-asset-audit platform: import an asset register, run field
verification with a scan-first mobile app, reconcile exceptions, and share live
progress with clients. **Five deployable surfaces, one codebase:**

| Surface | Who | What |
|---|---|---|
| Platform Hub | everyone | Module launcher, architecture & deploy planner |
| Operations Portal | OPS / ADMIN | Clients, auditors, register import, audit planning, field-team assignment, exceptions, approvals, reports |
| Client Portal | CLIENT | Live audit progress, asset register, exceptions, reports |
| Auditor Mobile (PWA) | AUDITOR | Install-to-home-screen app — camera QR/barcode scan, manual lookup, offline queue, GPS + photo evidence, **new-asset discovery with instant ES code + printable QR tag** |
| Core API | — | `/api/core/*` — team-only, session-authenticated, RBAC-guarded |

## Quick start (local)

```bash
bun install                # installs deps + prisma generate
bun run db:push            # create SQLite db/custom.db from prisma/schema.prisma
bun prisma/seed.ts         # demo clients, auditors, audits, assets
bun prisma/seed-users.ts   # team login accounts (below)
bun run dev                # http://localhost:3000
```

## Starter accounts (team-only — no public signup)

| Role | Email | Password |
|---|---|---|
| ADMIN | admin@easysourcing.in | Admin@2026 |
| OPS | ops@easysourcing.in | Ops@2026 |
| CLIENT | client@easysourcing.in | Client@2026 |
| AUDITOR | auditor@easysourcing.in | Field@2026 |

## Deploy free (Vercel + Neon)

Step-by-step, click-by-click: **[DEPLOYMENT.md](./DEPLOYMENT.md)** — §1.2 takes
you from zero to a live HTTPS URL on ₹0/month (Vercel Hobby + Neon Postgres),
§1.3 covers installing the Auditor app on a phone.

```bash
# switch Prisma to Postgres for production
bun scripts/use-db.ts postgres
bun run db:push:pg
# then run prisma/neon-users.sql in the Neon SQL editor to create the accounts
```

## Field workflow in 30 seconds

1. **Ops** → Asset Register → Import (sample Excels in `scripts/` output) → print QR labels
2. **Ops** → Audits → open project → *Assign field team* (member + location scope)
3. **Auditor** (phone) → login → scan / manual-lookup / discovery; works offline, syncs later
4. **Ops & Client** → exceptions, approvals, reports update live

## Tests

```bash
# whitebox (isolated DB copy)
cp db/custom.db db/test.db && DATABASE_URL=file:$PWD/db/test.db PRISMA_LOG_SILENT=1 bun test tests/whitebox/ && rm -f db/test.db
# blackbox (needs dev server on :3000)
PRISMA_LOG_SILENT=1 bun test tests/blackbox/
```

177 tests (136 whitebox + 41 blackbox) — RBAC, auth lockout, import idempotency,
verify engine, discovery code allocation, label sheets, latency budget.
