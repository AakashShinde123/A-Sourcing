# EasySourcing — Production Deployment Guide

**Platform:** Asset Physical Verification, Audit & Reconciliation Suite
**Stack:** Next.js 16 (App Router, standalone output) · TypeScript 5 · Tailwind CSS 4 + shadcn/ui · Prisma ORM · Bun
**Test status at time of writing:** 68 white-box + 19 black-box tests passing (87/87), ESLint clean

---

## 1. Architecture — what you are deploying

EasySourcing ships as **five deployable units** that share one REST contract.
Every unit can be built, versioned and deployed independently; today they run
inside a single Next.js server, and §7 shows how to split them out.

| Unit | Kind | Version | Deploy target | Consumes |
|---|---|---|---|---|
| **Hub** (`hub.easysourcing.in`) | Web shell | 2.1.0 | static SSR / edge | `GET /bootstrap`, `GET /registry` |
| **Operations Portal** (`ops.easysourcing.in`) | Web app | 2.1.0 | Node server / container | `GET /bootstrap`, `PATCH /exceptions`, `POST /reports` |
| **Client Portal** (`clients.easysourcing.in`) | Web app | 2.0.3 | Node server / container | `GET /bootstrap`, `POST /approvals`, `POST /reports` |
| **Auditor Mobile** (`field.easysourcing.in`) | PWA | 2.1.1 | Node server / container + PWA wrapper | `GET /bootstrap`, `POST /verify` |
| **Core API** (`api.easysourcing.in`) | Service | 2.1.4 | Node server / container | Prisma → SQLite/Postgres |

Integration rules (enforced in code review & by the module manifest):

- Modules **never import each other** — they only share `@es/shared`
  (`src/modules/shared`, `src/lib/core-logic.ts`), a versioned pure-TS kernel.
- All module↔service traffic rides **`/api/core/*`** (the single contract):
  `GET /api/core/bootstrap`, `GET /api/core/registry`, `POST /api/core/verify`,
  `PATCH /api/core/exceptions`, `POST /api/core/approvals`, `POST /api/core/reports`.
- Each module self-describes via a `manifest.ts` (`id`, semver, screens, API
  contract, deploy target). `GET /api/core/registry` serves the live manifests —
  what the Architecture map shows is exactly what is deployed.

### 1.1 Which platform? Team-size-based recommendation

An interactive version of this decision lives in the product itself:
**Platform Hub → Deploy Planner** (`src/modules/hub/DeployPlanner.tsx`).

Assumption: company is **10 people today**, growing over time. The five
deployable units (same images, same manifests, same REST contract) never
change — only **where they run** changes.

| Team size | Stage | Recommended platform | Est. infra cost | Ops burden |
|---|---|---|---|---|
| ≤ 15 (**you today: 10**) | 1 · Launch | One always-free or low-cost VM + `docker compose` + Caddy (both ship in the repo), SQLite on a mounted volume + nightly off-box backup | **₹0 free path** · ₹700–2,500/mo paid | 2–4 h/week, one person part-time |
| 16–50 | 2 · Scale | Vercel (one project per portal) + Fly.io/Railway for the Core API (2+ instances) + Neon/Supabase Postgres + R2/S3 for evidence photos | ₹5,000–12,000/mo | ≈1 h/week |
| 51+ | 3 · Expansion | AWS ECS Fargate (one service per module image) + RDS Postgres Multi-AZ + CloudFront/S3, ap-south-1 primary + DR region | ₹40,000+/mo | 0.5–1 FTE DevOps |

The short version of the migration logic (full trigger lists in the planner):

- **Starting phase (₹0): free tiers that genuinely fit Stage 1** —
  **Oracle Cloud Always Free** (ARM VM, 4 cores/24 GB, Mumbai region, free forever)
  runs the whole Docker Compose stack at zero cost; **GCP `e2-micro`** / **AWS free
  tier** are alternatives if you already hold accounts. Frontends can also sit on
  **Vercel Hobby (₹0)** while usage is small — Hobby terms are non-commercial, so
  step up to Pro ($20/seat) or the VM path when the business outgrows it. When
  SQLite is outgrown, **Neon/Supabase free Postgres (0.5 GB)** is the §4.3
  env-var swap — still ₹0. Total starting-phase bill: **₹0/month + a domain
  (~₹800/yr)**.

- **Stay on Stage 1 until downtime matters** — two teams colliding on deploys,
  `POST /verify` p95 > 2 s (SQLite write contention), or a client SLA demand.
  Do **not** start with Kubernetes at 10 people: it costs more human hours
  than the ₹2k VPS saves.
- **Stage 2 splits frontends from the API and buys managed services** — each
  portal becomes its own Vercel project from the same monorepo; the
  SQLite→Postgres move is exactly the §4.3 one-env-var swap.
- **Stage 3 adds cloud and regions, not code boundaries** — the five container
  images deploy as five independent services; no microservice rewrite is
  needed because the module boundaries already exist.

The rule that keeps all three stages cheap: modules never import each other —
moving house means changing only the `deploy.target` in each manifest.

---

## 2. Prerequisites

| Tool | Version | Why |
|---|---|---|
| Bun | ≥ 1.1 | runtime, package manager, test runner |
| Node.js | ≥ 20 (installed by the `oven/bun` image) | Next standalone server runs on Node |
| Docker | ≥ 24 | container path (optional but recommended) |
| SQLite | bundled | default datastore — zero-setup |
| PostgreSQL | ≥ 14 | optional production datastore (§4.3) |

---

## 3. Environment variables

| Variable | Required | Example | Notes |
|---|---|---|---|
| `DATABASE_URL` | **yes** | `file:/data/custom.db` | Prisma URL. SQLite path must live on a **persistent volume**. For Postgres: `postgresql://user:pass@host:5432/easysourcing` |
| `NODE_ENV` | yes (prod) | `production` | disables Prisma global-caching dev behaviour |
| `PORT` | no | `3000` | standalone server port |
| `HOSTNAME` | no | `0.0.0.0` | bind address (set in the Dockerfile) |
| `PRISMA_LOG_SILENT` | no | `1` | set in prod to silence per-query logging |
| `AUTH_SECRET` | **yes (prod)** | `openssl rand -base64 32` | Signing key for session JWTs. If omitted, a fixed dev fallback is used — NEVER ship that to production. Rotating it instantly invalidates every active session. |
| `DATABASE_URL` at build time | no | `file:/tmp/build.db` | Prisma generate needs *a* value; the Dockerfile sets one |

Create `.env.production` (never commit it):

```bash
NODE_ENV=production
DATABASE_URL=file:/data/custom.db
AUTH_SECRET=$(openssl rand -base64 32)
PRISMA_LOG_SILENT=1
```

---

## 4. Database

### 4.1 Schema push (SQLite, first boot)

The standalone Docker entrypoint runs `prisma db push --skip-generate`
automatically against `DATABASE_URL`. For manual setup:

```bash
bun install --frozen-lockfile
bunx prisma generate
bunx prisma db push          # creates tables from prisma/schema.prisma
```

### 4.2 Demo data (optional)

```bash
bun prisma/seed.ts           # realistic 5-client, 165-asset demo world
```

> ⚠️ Never seed a real production environment — the seed overwrites demo
> entities with deterministic codes (`aud_1`, `ES-MRD-*`, …).

### 4.3 Switching to PostgreSQL (recommended for real production)

SQLite is perfect for demos and single-node pilots, but for multi-instance
production switch the datasource:

1. Edit `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Regenerate + migrate:
   ```bash
   bunx prisma migrate dev --name init_pg
   ```
3. Point `DATABASE_URL` at your Postgres instance. No application code changes
   are needed — all queries are portable Prisma.

### 4.4 Backups

- **SQLite:** stop-the-world copy or `sqlite3 .backup` of the volume path
  (`/data/custom.db`), e.g. nightly cron + S3 upload.
- **Postgres:** `pg_dump` nightly, PITR via your provider.

The whole audit trail lives in this database — treat it as financial records.

### 4.5 Login accounts & sessions (the platform is team-only)

The whole platform sits behind sign-in. There is no public view — unauthenticated
visitors see the login screen only, and every `/api/core/*` call without a valid
session answers `401`.

**Create the starter team accounts (once, after schema push):**

```bash
bun prisma/seed-users.ts
```

| Account | Email | Starter password | Role | Sees |
|---|---|---|---|---|
| Platform Admin | `admin@easysourcing.in` | `Admin@2026` | ADMIN | everything + Access & Accounts |
| Operations | `ops@easysourcing.in` | `Ops@2026` | OPS | ops portal (no Access view) |
| Client — Meridian | `client@easysourcing.in` | `Client@2026` | CLIENT | Meridian's data ONLY |
| Field — Arjun | `auditor@easysourcing.in` | `Field@2026` | AUDITOR | own assignments in the mobile PWA |

**Change these starter passwords before real use** — Ops Portal → *Access & Accounts*
→ reset-password (admin only). More accounts are created the same way; CLIENT
accounts must be linked to a client, AUDITOR accounts to a field team member —
that link is what scopes their data access server-side.

**How sessions are protected (all server-side, no config needed):**

- Passwords hashed with **bcrypt cost 12**; policy: ≥ 8 chars, letter + number.
- Session = **HS256-signed JWT in an httpOnly SameSite=Lax cookie** — 12 h, or
  30 days with "keep me signed in". Logout / deactivation kills access
  immediately (`/api/auth/me` re-checks the DB every request).
- **Brute force:** 5 failed attempts per email+IP → 15 min lockout; 100
  attempts per IP / 15 min (spray guard). All outcomes land in the audit log.
- **CSRF:** cross-origin mutations rejected by the proxy (Origin/host check),
  cookie is SameSite — two independent layers.
- **RBAC (server-side, not just hidden UI):** CLIENT sessions receive ONLY
  their client's data from `/api/core/bootstrap` and can never call ops
  endpoints; AUDITOR sessions see only their assignments and their verifications
  are attributed to their session identity (payload `auditorId` is ignored);
  exception lifecycle / reports / register import / team & client management
  require ADMIN/OPS; removing a client requires ADMIN.
- Security headers on every response: `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, strict `Referrer-Policy`, locked-down
  `Permissions-Policy`.

---

## 5. Build & run

### 5.1 Bare metal / VM

```bash
bun install --frozen-lockfile
bun run lint                       # gate: must be clean
bunx prisma generate && bunx prisma db push
bun run build                      # standalone output → .next/standalone
DATABASE_URL=file:/data/custom.db NODE_ENV=production \
  node .next/standalone/server.js  # listens on :3000
```

`package.json` also provides `bun run start` (wraps the same server with logs).

### 5.2 Docker (recommended)

```bash
docker build -t easysourcing:latest .
docker run -d --name easysourcing \
  -p 3000:3000 \
  --env-file .env.production \
  -v easysourcing-data:/data \
  --restart unless-stopped \
  easysourcing:latest
```

### 5.3 Docker Compose (app + optional Caddy gateway)

```bash
docker compose --env-file .env.production up -d                 # app only
docker compose --profile gateway --env-file .env.production up -d  # + Caddy :80/:443
```

Health: `curl http://localhost:3000/api/core/registry` →
`{"service":{"status":"healthy", ...}}`. The compose healthcheck polls this
every 30 s.

---

## 6. Reverse proxy / TLS

Any L7 proxy works. Terminate TLS and forward to `:3000`:

- **Caddy** — a `Caddyfile` ships with the repo (sandbox pattern). For a single
  domain:
  ```
  easysourcing.example.com {
    reverse_proxy localhost:3000
  }
  ```
- **Nginx** — standard `proxy_pass http://127.0.0.1:3000;` with
  `X-Forwarded-For/Proto` headers.
- **Cloud** — put the service behind ALB/Cloud Run/App Router's native output;
  no code changes required.

---

## 7. Splitting the modules into standalone services

The codebase is already partitioned for separation; splitting is an ops
exercise, not a rewrite:

1. **Core API first.** Move `src/app/api/core/**` + `src/lib/{db,core-logic}.ts`
   into its own service (or keep them in the same repo and deploy a second
   instance that only serves `/api/core`). Point it at shared Postgres.
2. **Point the front-ends at it.** Each portal's data layer uses a single
   constant — `API_BASE` in `src/modules/shared/store.tsx`. Change it from
   `/api/core` to `https://api.easysourcing.in/core` (or inject at build time)
   and each portal becomes deployable on its own hostname.
3. **Per-module images.** Every module declares its own `manifest.ts` with
   version + deploy target + container image (`registry.es/<module>:<semver>`).
   CI builds one image per module, tagging the manifest version.
4. **In-sandbox / single-port pattern.** While iterating locally, side-car
   services stay reachable through the Caddy gateway using
   `?XTransformPort=<port>` on relative URLs (see `Caddyfile`) — e.g.
   `io('/?XTransformPort=3030')` for a websocket mini-service.
5. **Version contract, don't break it.** Bump `@es/shared` semver when the
   shared types change; `GET /api/core/registry` publishes every deployed
   version so drift is observable at runtime.

---

## 8. CI/CD pipeline (suggested)

```yaml
# .github/workflows/ci.yml (sketch)
name: ci
on: [push]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run lint
      - name: white-box (isolated DB copy)
        run: |
          cp db/custom.db db/test.db || true
          DATABASE_URL=file:$PWD/db/test.db PRISMA_LOG_SILENT=1 bun test tests/whitebox/
      - name: build & boot
        run: |
          bunx prisma generate && bunx prisma db push
          bun run build &
          sleep 8
      - name: black-box (live HTTP)
        run: PRISMA_LOG_SILENT=1 bun test tests/blackbox/
```

Promotion gate: lint clean + 87/87 tests green + registry endpoint healthy on
the booted container → build image → tag with module manifest semver → deploy.

---

## 9. Monitoring & operations

- **Liveness/readiness:** `GET /api/core/registry` — returns
  `service.status: healthy | degraded` (degraded = DB unreachable),
  `uptimeSeconds`, `latencyMs`, live row counts and all module manifests.
  Wire it to your LB health check and uptime monitor.
- **Logs:** the app logs to stdout (Next standalone + Prisma). Ship with your
  standard collector; set `PRISMA_LOG_SILENT=1` in prod to avoid query spam.
- **Audit trail:** every state change (verifications, lifecycle moves,
  approvals, reports) appends an `AuditLog` row — query it for compliance
  forensics; it is append-only by design.
- **Backups:** §4.4 — nightly, tested restores.
- **Key metrics to alert on:** registry status != healthy, bootstrap p95
  latency (> 1.5 s budget), 5xx rate on `/api/core/*`, DB disk usage
  (SQLite volume) / connection saturation (Postgres).

---

## 10. Security hardening checklist (implemented + to-dos)

**Implemented during production-hardening pass:**

- ✅ Server-side input validation on every write endpoint (`src/lib/core-logic.ts`)
  — unknown results/decisions/actions are rejected `400`, never persisted.
- ✅ Exception lifecycle is a real state machine — illegal transitions `409`.
- ✅ Idempotent sync engine — replays (`skipped`) and parallel retry races
  (`P2002` → duplicate) can never double-apply an operation.
- ✅ Per-operation batch isolation — one bad op can't 500 the whole batch;
  partial results are reported per-item.
- ✅ Error responses are always JSON — no stack traces or HTML error pages leak.
- ✅ Fuzz-tested: SQL-ish strings, oversized payloads (20 KB), unicode, null
  bodies, wrong types — all degrade to clean 4xx.
- ✅ **Authentication built in** — bcrypt(12) passwords, signed httpOnly session
  cookies, brute-force lockouts, account deactivation, full login audit trail
  (§4.5). The app renders a login screen until signed in.
- ✅ **Role-gated API (RBAC)** — CLIENT scoped to own client data, AUDITOR to
  own work with session-forced identity, ops writes team-only, client removal
  admin-only; enforced in every route handler, not just the UI.

**Recommended before internet-facing production:**

- [ ] Set a strong `AUTH_SECRET` env var (§3) — the dev fallback is for local only.
- [ ] Change the four starter passwords from Ops Portal → Access & Accounts.
- [ ] Enforce HTTPS/HSTS at the proxy; add CSP headers for the portals.
- [ ] Rate-limit `POST /api/core/verify` at the edge when exposed publicly
      (the in-app RBAC already requires a field-team session).

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `registry` returns `degraded` | DB unreachable / wrong `DATABASE_URL` | check volume mount, path, credentials |
| `P1003` / `Error: Cannot find module '@prisma/client'` | client not generated in image | ensure `bunx prisma generate` ran (Dockerfile does) |
| Empty portals after deploy | DB pushed but not seeded | run `bun prisma/seed.ts` (demo only) |
| Sync returns `applied: 0, rejected: N` | mobile ops failed reference validation | inspect `items[].error` — usually stale audit/asset ids on device |
| `409 Illegal transition` from UI automation | lifecycle action replayed on moved exception | expected — the state machine rejected a stale click |
| Port already bound | previous standalone server running | `pkill -f 'server.js'` or change `PORT` |
| Docker: DB resets on restart | SQLite file not on a volume | mount `-v easysourcing-data:/data` and use `file:/data/custom.db` |

---

## 12. Rollback

1. Images are tagged with the module manifest semver — redeploy the previous
   tag (`docker run easysourcing:2.1.3`).
2. The REST contract is additive-only by policy; an older front-end keeps
   working against a newer Core API.
3. For data-level rollback, restore the nightly backup (§4.4) — verification
   events are idempotent (`operationId`), so re-syncing a device after restore
   replays cleanly without duplicates.
