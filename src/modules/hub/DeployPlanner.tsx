'use client'

// Hub · Deploy Planner — team-size-aware platform recommendation.
// Answers: "We are 10 people today and will expand — where does each
// standalone module actually run at each stage of growth?"
// Pure static data + one slider; no API calls needed by design.

import React, { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Rocket, Users, TrendingUp, AlertTriangle, Wallet, Clock,
  MoveRight, CircleDot, ServerCog, BadgeCheck, Compass, Sparkles,
} from 'lucide-react'
import { useES } from '../shared/store'
import { MODULE_ICONS, ACCENT_CLS } from '../shared/ModuleSwitcher'
import type { AccentKey, IconKey } from '../shared/module-contract'

type StageId = 'launch' | 'scale' | 'expansion'

interface UnitPlacement {
  id: string
  name: string
  iconKey: IconKey
  accent: AccentKey
  host: string
  detail: string
}

interface StackRow {
  label: string
  value: string
  why: string
}

interface Stage {
  id: StageId
  n: number
  name: string
  range: string
  min: number
  max: number
  headline: string
  accent: AccentKey
  cost: string
  costBasis: string
  ops: string
  stack: StackRow[]
  /** zero-cost starting paths (starting phase) */
  free?: { label: string; detail: string }[]
  units: UnitPlacement[]
  triggers: string[]
  avoid: { what: string; why: string }
}

const TEAM_TODAY = 10

const STAGES: Stage[] = [
  {
    id: 'launch',
    n: 1,
    name: 'Launch',
    range: 'up to ~15 people',
    min: 0,
    max: 15,
    headline: 'Start at ₹0 on Vercel + Neon. No server, no bills.',
    accent: 'emerald',
    cost: '₹0 / month',
    costBasis: 'One Vercel Hobby project hosts all five modules (they are surfaces of one Next.js app) + Neon free Postgres (0.5 GB). Optional custom domain is the only cost (~₹800/yr).',
    ops: '≈0 h/week · deploys are `git push` — Vercel builds, hosts and auto-HTTPS everything',
    free: [
      { label: 'Vercel Hobby — ₹0, one project hosts everything', detail: 'All five modules run as one Next.js deployment on Vercel’s free tier: Hub, Ops, Client, Auditor PWA and the Core API routes. Deploys happen automatically on every git push.' },
      { label: 'Neon Postgres free tier — ₹0, already wired', detail: 'Your database already runs on Neon (0.5 GB free, serverless, autosuspend). The SQLite→Postgres move is the §4.3/§4.4 env-var + one-word provider swap — zero code changes.' },
      { label: 'Prefer your own box? Oracle Cloud Always Free — ₹0 forever', detail: 'Always-free ARM VM (4 cores · 24 GB RAM, Mumbai) runs the whole Docker Compose stack from this repo (Caddy + containers). The “own your infrastructure” alternative when you outgrow Hobby terms.' },
      { label: 'GCP e2-micro / AWS free tier — ₹0 for 12+ months', detail: 'Small VM alternatives if your company already holds accounts there. Enough for a pilot; smaller than the Oracle box.' },
    ],
    stack: [
      { label: 'Host', value: 'Vercel Hobby — one project, all five modules', why: 'The modules are surfaces of a single Next.js app sharing /api/core/*, so one free project serves hub + portals + field PWA + API. Custom domains map per module later.' },
      { label: 'Database', value: 'Neon Postgres free tier (0.5 GB, autosuspend)', why: 'Serverless Postgres with zero idle cost. Connection is one DATABASE_URL env var; schema sync is `bun run db:push` + the neon-users.sql starter accounts script.' },
      { label: 'TLS / domains', value: 'Vercel-issued HTTPS on *.vercel.app from minute one', why: 'The Auditor PWA needs HTTPS for camera scanning and install-to-home-screen — a deployed URL gives both with zero config. Attach easysourcing.in subdomains when ready.' },
      { label: 'CI/CD', value: 'git push → Vercel build (prisma generate + next build)', why: 'Every push to the main branch deploys production; every PR gets a preview URL. No pipelines to build or servers to patch.' },
      { label: 'Sessions', value: 'AUTH_SECRET env var (rotate any time)', why: 'Cookie sessions are signed with AUTH_SECRET — set it once in Vercel → Settings → Environment Variables. Rotating it instantly signs out every device.' },
      { label: 'Monitoring', value: '/api/core/registry + external uptime ping', why: 'The discovery endpoint already reports health, uptime and latency — point any free pinger (UptimeRobot) at it.' },
    ],
    units: [
      { id: 'hub', name: 'Platform Hub', iconKey: 'qr-code', accent: 'violet', host: 'Vercel', detail: 'your-app.vercel.app' },
      { id: 'ops-portal', name: 'Operations Portal', iconKey: 'layout-dashboard', accent: 'emerald', host: 'Vercel', detail: 'same URL · Ops login' },
      { id: 'client-portal', name: 'Client Portal', iconKey: 'building-2', accent: 'amber', host: 'Vercel', detail: 'same URL · Client login' },
      { id: 'auditor-mobile', name: 'Auditor Mobile', iconKey: 'scan-line', accent: 'teal', host: 'Vercel (PWA)', detail: 'same URL · install to phone' },
      { id: 'core-api', name: 'Core API + Neon', iconKey: 'boxes', accent: 'violet', host: 'Vercel routes + Neon', detail: '/api/core/* · Postgres' },
    ],
    triggers: [
      'The business starts billing clients on the platform — Vercel Hobby terms are non-commercial, so step up to Pro ($20/seat) or the Oracle free VM',
      'Verification batches feel slow: p95 of POST /api/core/verify climbs past ~2s (Neon free compute is small — scale the branch or move to the VM path)',
      'A client contract asks for an uptime SLA, staging environment or access-controlled deploys',
      'The company crosses ~15 people and more than one squad pushes to the same pipeline',
    ],
    avoid: { what: 'Kubernetes, service mesh, multi-account AWS', why: 'At 10 people nobody has spare hours to be a platform team. K8s costs more in human time than any bill you are avoiding — and the module manifest system means you can adopt heavier infra later without rewrites.' },
  },
  {
    id: 'scale',
    n: 2,
    name: 'Scale',
    range: '~16 – 50 people',
    min: 16,
    max: 50,
    headline: 'Split frontends from the API. Buy managed, not more servers.',
    accent: 'violet',
    cost: '₹5,000 – ₹12,000 / month',
    costBasis: 'Vercel per-portal + Fly.io/Railway API (2 instances) + managed Postgres + Sentry. Priced per seat & usage.',
    ops: '≈1 h/week · the platforms absorb the pager, deploys are PR-driven',
    stack: [
      { label: 'Frontends', value: 'Vercel — one project per portal, same monorepo', why: 'Each portal is its own Vercel project with its own domain, preview deploy per PR and instant rollback. Hobby tier is free, Pro is per-seat.' },
      { label: 'Core API', value: 'Fly.io or Railway — 2+ instances behind their edge', why: 'The API is stateless; scale it horizontally and get zero-downtime deploys without owning any servers.' },
      { label: 'Database', value: 'Neon / Supabase Postgres (serverless)', why: 'Branching gives every feature a staging DB, PITR gives audit-grade backups. Swapping SQLite→Postgres is one DATABASE_URL change — the schema already supports it (§4.3 of the guide).' },
      { label: 'Files', value: 'Cloudflare R2 / S3 for evidence photos', why: 'Photo + GPS evidence grows linearly with audits — object storage with lifecycle rules keeps the DB lean.' },
      { label: 'CI/CD', value: 'GitHub Actions matrix per module manifest', why: 'One workflow per deployable unit, gated on the manifest version — modules keep shipping independently.' },
      { label: 'Observability', value: 'Sentry + Better Stack uptime + Vercel analytics', why: 'Error tracking on /api/core/* and the portals, all on free-to-small paid tiers.' },
    ],
    units: [
      { id: 'hub', name: 'Platform Hub', iconKey: 'qr-code', accent: 'violet', host: 'Vercel', detail: 'hub.easysourcing.in' },
      { id: 'ops-portal', name: 'Operations Portal', iconKey: 'layout-dashboard', accent: 'emerald', host: 'Vercel', detail: 'ops.easysourcing.in' },
      { id: 'client-portal', name: 'Client Portal', iconKey: 'building-2', accent: 'amber', host: 'Vercel', detail: 'clients.easysourcing.in' },
      { id: 'auditor-mobile', name: 'Auditor Mobile', iconKey: 'scan-line', accent: 'teal', host: 'Vercel (PWA)', detail: 'field.easysourcing.in' },
      { id: 'core-api', name: 'Core API + Postgres', iconKey: 'boxes', accent: 'violet', host: 'Fly.io ×2 + Neon', detail: 'api.easysourcing.in' },
    ],
    triggers: [
      'Compliance or enterprise clients ask where data lives, and want audit-grade access logs',
      'Auditors work from multiple regions and complain about latency to one box',
      'You are hiring DevOps/SRE as a role rather than a hat someone wears',
      'Database connections or instance size are the conversation instead of product work',
    ],
    avoid: { what: 'Self-managed EC2 fleet / DIY Postgres replicas', why: 'Your differentiator is the verification workflow, not database administration. Managed Postgres costs less per month than the on-call hours it replaces.' },
  },
  {
    id: 'expansion',
    n: 3,
    name: 'Expansion',
    range: '51+ people',
    min: 51,
    max: 999,
    headline: 'One cloud, regions where your auditors are, real on-call.',
    accent: 'amber',
    cost: '₹40,000 – ₹1,50,000+ / month',
    costBasis: 'ECS Fargate tasks + RDS Multi-AZ + S3 + CloudFront + observability. Scales with audit volume, not headcount.',
    ops: '0.5–1 FTE dedicated DevOps/SRE',
    stack: [
      { label: 'Runtime', value: 'AWS ECS Fargate — one task definition per module image', why: 'The five container images deploy as five independent services. EKS only if a platform team actually exists to run it.' },
      { label: 'Database', value: 'RDS Postgres Multi-AZ + read replica', why: 'Automatic failover and a replica for heavy report/aggregate reads without touching the write path.' },
      { label: 'Edge & files', value: 'CloudFront + S3 with lifecycle rules', why: 'Evidence photos tier to infrequent-access storage; CloudFront caches portal assets near field teams.' },
      { label: 'Regions', value: 'ap-south-1 (Mumbai) primary + secondary region', why: 'Field teams in India get single-digit latency; DR runs warm in the secondary region.' },
      { label: 'Security', value: 'IAM Identity Center SSO · Secrets Manager · private subnets', why: 'Enterprise clients audit your access model — SSO + secrets rotation checks that box early.' },
      { label: 'Observability', value: 'OpenTelemetry traces on /api/core/* → Grafana Cloud / Datadog', why: 'The REST contract is small; tracing every contract call gives end-to-end visibility across modules.' },
    ],
    units: [
      { id: 'hub', name: 'Platform Hub', iconKey: 'qr-code', accent: 'violet', host: 'ECS Fargate', detail: 'own service + CloudFront' },
      { id: 'ops-portal', name: 'Operations Portal', iconKey: 'layout-dashboard', accent: 'emerald', host: 'ECS Fargate', detail: 'own service' },
      { id: 'client-portal', name: 'Client Portal', iconKey: 'building-2', accent: 'amber', host: 'ECS Fargate', detail: 'own service' },
      { id: 'auditor-mobile', name: 'Auditor Mobile', iconKey: 'scan-line', accent: 'teal', host: 'ECS Fargate', detail: 'PWA + offline sync' },
      { id: 'core-api', name: 'Core API + RDS', iconKey: 'boxes', accent: 'violet', host: 'ECS + RDS Multi-AZ', detail: 'api.easysourcing.in' },
    ],
    triggers: [
      'You are past 50 engineers and multiple product squads own the modules end-to-end',
      'Enterprise procurement demands region pinning, DR drills and SOC-2-style controls',
      'A single region outage is a board-level conversation',
    ],
    avoid: { what: 'A microservice-everything rewrite', why: 'The modules already deploy separately — expansion adds clouds and regions, not new code boundaries. Keep the same manifests and REST contract.' },
  },
]

function autoStageFor(team: number): Stage {
  return STAGES.find((s) => team >= s.min && team <= s.max) ?? STAGES[STAGES.length - 1]
}

const UNIT_BASE: Record<string, { name: string; iconKey: IconKey; accent: AccentKey }> = {
  'hub': { name: 'Platform Hub', iconKey: 'qr-code', accent: 'violet' },
  'ops-portal': { name: 'Operations Portal', iconKey: 'layout-dashboard', accent: 'emerald' },
  'client-portal': { name: 'Client Portal', iconKey: 'building-2', accent: 'amber' },
  'auditor-mobile': { name: 'Auditor Mobile', iconKey: 'scan-line', accent: 'teal' },
  'core-api': { name: 'Core API', iconKey: 'boxes', accent: 'violet' },
}

/* stage accent → active-card treatment (vivid on light) */
const STAGE_ACTIVE: Record<StageId, string> = {
  launch: 'bg-gradient-to-b from-emerald-50 to-white ring-2 ring-emerald-500/50 shadow-[0_20px_48px_-16px_rgba(5,150,105,0.35)]',
  scale: 'bg-gradient-to-b from-violet-50 to-white ring-2 ring-violet-500/50 shadow-[0_20px_48px_-16px_rgba(139,92,246,0.35)]',
  expansion: 'bg-gradient-to-b from-amber-50 to-white ring-2 ring-amber-500/50 shadow-[0_20px_48px_-16px_rgba(234,88,12,0.35)]',
}
const STAGE_GRAD: Record<StageId, string> = {
  launch: 'from-emerald-400 to-teal-600',
  scale: 'from-violet-400 to-fuchsia-600',
  expansion: 'from-amber-400 to-orange-500',
}

export function DeployPlanner() {
  const { setSurface } = useES()
  const [team, setTeam] = useState(TEAM_TODAY)
  const [pinned, setPinned] = useState<StageId | null>(null)

  const autoStage = useMemo(() => autoStageFor(team), [team])
  const stage = useMemo(
    () => STAGES.find((s) => s.id === pinned) ?? autoStage,
    [pinned, autoStage],
  )
  const a = ACCENT_CLS[stage.accent]

  return (
    <div className="relative isolate min-h-screen overflow-x-clip bg-[#f7f6fb] text-zinc-900">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="bg-aurora-violet noise absolute inset-0" />
      </div>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-violet-100/80 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSurface('landing')} aria-label="Back to hub"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50 hover:ring-violet-300">
              <ArrowLeft className="h-4 w-4 text-zinc-600" />
            </button>
            <div>
              <div className="font-display text-[13px] font-bold tracking-tight">Deployment Planner</div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-violet-500">Where each standalone module runs, by team size</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200 sm:inline-flex">
              <Users className="h-3 w-3 text-violet-500" /> {team} {team === 1 ? 'person' : 'people'} · {stage.name} stage
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-600 shadow-[0_6px_16px_-6px_rgba(147,51,234,0.6)]">
              <Rocket className="h-3.5 w-3.5 text-white" />
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 lg:px-6">
        {/* Intro + slider */}
        <div className="pt-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-violet-700 shadow-[0_8px_28px_-10px_rgba(139,92,246,0.5)] ring-1 ring-violet-200">
            <Compass className="h-3.5 w-3.5" /> Sized for today · ready for tomorrow
          </div>
          <h1 className="font-display mt-4 max-w-3xl text-2xl font-bold tracking-tight sm:text-[2rem] sm:leading-tight">
            You are {TEAM_TODAY} people now. Drag the slider — <span className="text-gradient-violet">the platform plan changes before you do.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
            The five deployable units never change — same images, same manifests, same REST contract.
            Only <span className="font-semibold text-zinc-900">where they run</span> changes. That is the point of the
            standalone-but-connected architecture: growth is an ops decision, not a rewrite.
          </p>

          {/* Slider card */}
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-[0_20px_50px_-24px_rgba(139,92,246,0.4)] ring-1 ring-violet-500/15 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Team size (people building &amp; running the platform)</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-bold tabular-nums tracking-tight text-zinc-900">{team}</span>
                  <span className="text-[12px] text-zinc-500">members in the company</span>
                  {team === TEAM_TODAY && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-500/25">you · today</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-zinc-600">
                <TrendingUp className="h-3.5 w-3.5 text-violet-500" />
                auto-recommends <span className="font-bold text-zinc-900">{autoStage.name}</span>
              </div>
            </div>
            <input
              type="range"
              min={2}
              max={120}
              step={1}
              value={team}
              onChange={(e) => { const v = Number(e.target.value); setTeam(v); setPinned(null) }}
              aria-label="Team size"
              className="mt-5 w-full accent-violet-600"
            />
            {/* tick marks at true linear positions for 15 / 50 (scale 2→120) */}
            <div className="relative mt-1 h-4 text-[9.5px] font-semibold uppercase tracking-wider text-zinc-400">
              <span className="absolute left-0">2</span>
              <span className="absolute -translate-x-1/2" style={{ left: `${((15 - 2) / 118) * 100}%` }}>15</span>
              <span className="absolute -translate-x-1/2" style={{ left: `${((50 - 2) / 118) * 100}%` }}>50</span>
              <span className="absolute right-0">120+</span>
            </div>
          </div>
        </div>

        {/* Stage cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {STAGES.map((s) => {
            const sa = ACCENT_CLS[s.accent]
            const active = s.id === stage.id
            const auto = s.id === autoStage.id
            return (
              <button key={s.id} onClick={() => setPinned(s.id)} aria-pressed={active}
                className={cn(
                  'relative flex flex-col rounded-2xl p-5 text-left transition-all duration-300',
                  active
                    ? STAGE_ACTIVE[s.id]
                    : 'bg-white shadow-sm ring-1 ring-zinc-900/[0.06] hover:-translate-y-1 hover:shadow-[0_16px_40px_-16px_rgba(6,78,59,0.25)]',
                )}>
                <div className="flex items-center justify-between">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl font-mono text-[13px] font-bold text-white shadow-md bg-gradient-to-br', STAGE_GRAD[s.id])}>{s.n}</span>
                  <span className="flex items-center gap-1.5">
                    {auto && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-600 ring-1 ring-zinc-200">fits you</span>
                    )}
                    {active && <BadgeCheck className={cn('h-4.5 w-4.5', sa.text)} />}
                  </span>
                </div>
                <div className="font-display mt-3 text-[15px] font-bold tracking-tight text-zinc-900">{s.name}</div>
                <div className="text-[11px] font-medium text-zinc-500">{s.range}</div>
                <p className="mt-2 flex-1 text-[12px] leading-relaxed text-zinc-600">{s.headline}</p>
                <div className="mt-3 flex items-center gap-1.5 border-t border-zinc-100 pt-2.5 text-[11px] font-bold text-zinc-800">
                  <Wallet className={cn('h-3.5 w-3.5', sa.text)} /> {s.cost}
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail — selected stage */}
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {/* Stack */}
          <div className="rounded-2xl bg-white p-5 shadow-[0_16px_44px_-20px_rgba(6,78,59,0.25)] ring-1 ring-zinc-900/[0.06] lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Stage {stage.n} · the stack</div>
                <h2 className="font-display mt-1 text-lg font-bold tracking-tight">{stage.headline}</h2>
              </div>
              <span className={cn('rounded-full px-3 py-1 text-[11px] font-bold ring-1', a.soft, a.text, a.ring)}>{stage.cost}</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {stage.stack.map((row) => (
                <div key={row.label} className="rounded-xl bg-gradient-to-b from-zinc-50 to-white p-4 ring-1 ring-zinc-200/70">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{row.label}</div>
                  <div className="mt-1 text-[13px] font-semibold text-zinc-900">{row.value}</div>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-zinc-500">{row.why}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-zinc-50 px-4 py-3 text-[12px] ring-1 ring-zinc-200/70">
              <span className="flex items-center gap-2 text-zinc-700"><Wallet className={cn('h-3.5 w-3.5', a.text)} /> <span className="font-semibold text-zinc-500">basis:</span> {stage.costBasis}</span>
              <span className="flex items-center gap-2 text-zinc-700"><Clock className="h-3.5 w-3.5 text-zinc-400" /> <span className="font-semibold text-zinc-500">ops:</span> {stage.ops}</span>
            </div>
            {stage.free && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Starting phase? Start at ₹0 — free tiers that fit this stage
                </div>
                <div className="mt-2.5 grid gap-2 md:grid-cols-2">
                  {stage.free.map((f) => (
                    <div key={f.label} className="rounded-lg bg-white/90 p-3 ring-1 ring-emerald-200/70">
                      <div className="text-[12px] font-bold text-emerald-900">{f.label}</div>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-600">{f.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Migration triggers + avoid */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-900/[0.06]">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                <MoveRight className="h-3.5 w-3.5" /> Move to stage {stage.n + 1} when…
              </div>
              <ul className="mt-3 space-y-2.5">
                {stage.triggers.map((t) => (
                  <li key={t} className="flex gap-2.5 text-[12px] leading-relaxed text-zinc-600">
                    <CircleDot className={cn('mt-0.5 h-3 w-3 shrink-0', a.text)} /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/60 p-5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" /> Do not skip ahead
              </div>
              <div className="mt-2 text-[13px] font-bold text-amber-900">{stage.avoid.what}</div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-amber-800/80">{stage.avoid.why}</p>
            </div>
          </div>
        </div>

        {/* Unit placement table */}
        <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-[0_16px_44px_-20px_rgba(6,78,59,0.25)] ring-1 ring-zinc-900/[0.06]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-gradient-to-r from-violet-50/60 to-transparent px-5 py-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Stage {stage.n} placement</div>
              <h2 className="font-display mt-0.5 text-[15px] font-bold tracking-tight">Where each of the five deployable units runs</h2>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[10.5px] font-bold text-violet-700 ring-1 ring-violet-500/20">
              <ServerCog className="h-3.5 w-3.5" /> same images · same manifest · same contract
            </span>
          </div>
          <ul className="divide-y divide-zinc-100">
            {stage.units.map((u) => {
              const Icon = MODULE_ICONS[u.iconKey]
              const ua = ACCENT_CLS[u.accent]
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-violet-50/40">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-md bg-gradient-to-br', ua.solid)}>
                    <Icon className="h-4.5 w-4.5 text-white" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-zinc-900">{u.name}</div>
                    <div className="truncate font-mono text-[10.5px] text-zinc-500">{u.detail}</div>
                  </div>
                  <span className="rounded-full bg-gradient-to-r from-zinc-100 to-zinc-50 px-3 py-1 text-[11px] font-bold text-zinc-700 ring-1 ring-zinc-200">{u.host}</span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="mt-8 flex flex-col items-center gap-1 text-center text-[10.5px] text-zinc-500">
          <span>Prices are indicative list prices at time of writing (INR, incl. typical $→₹ conversion) — always check the provider&apos;s current pricing page.</span>
          <span>Switching stages redeploys the same module images — no code changes, only <span className="font-mono text-zinc-600">deploy targets</span> in the manifests move.</span>
        </div>
      </main>
    </div>
  )
}
