# ─────────────────────────────────────────────────────────────────────────────
# EasySourcing — production image (multi-stage, standalone Next.js output)
# Build:  docker build -t easysourcing:latest .
# Run:    docker run -p 3000:3000 --env-file .env.production easysourcing:latest
# ─────────────────────────────────────────────────────────────────────────────

# ── 1._deps: install with a reproducible lockfile ───────────────────────────
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production=false

# ── 2. build: compile the standalone server ─────────────────────────────────
FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL is only needed at RUNTIME (prisma reads env lazily), but the
# generator requires a value at build time — point it at a throwaway file.
ENV DATABASE_URL="file:/tmp/build.db"
RUN bunx prisma generate \
 && bun run build

# ── 3. run: minimal runtime image ────────────────────────────────────────────
FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 app && adduser --system --uid 1001 app

# Standalone server + static assets + public dir
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

# Prisma: schema (migrations/db push) + query engine binary
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/node_modules/prisma ./node_modules/prisma
COPY --from=build --chown=app:app /app/node_modules/@prisma ./node_modules/@prisma

# Persistent state dir for the SQLite file (mount a volume here!)
RUN mkdir -p /data && chown app:app /data
VOLUME ["/data"]

USER app
EXPOSE 3000

# Apply schema, then serve. For SQLite: set DATABASE_URL=file:/data/custom.db
# For Postgres: swap the entrypoint to `node prisma/migrate deploy` flow.
CMD ["sh", "-c", "bunx prisma db push --skip-generate --accept-data-loss || true; node server.js"]
