# BCP Build Lab

A production B2B platform for managing AI initiatives end to end: intake → triage →
scoring → governance → human assignment → delivery → value measurement.

- **Live:** https://build-lab.dev (auto-deploys from `main`)
- **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui ·
  Prisma 7 · Neon Postgres · Auth.js v5 (credentials)

The public root `/` is intentionally blank (a product decision). The application lives
behind `/login`; public intake is at `/submit`.

## Core principles

- **Initiatives** (evaluated opportunities) and **Projects** (approved execution) are
  distinct objects, never conflated.
- **Scoring ranks; humans decide.** No code path assigns a delivery lane; assignment is
  only ever a recorded human decision (unit-tested).
- Intake responses are immutable after submission; scores, decisions, transitions, and
  audit events are append-only; all authorization is server-side.

## Get started

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL, DIRECT_DATABASE_URL, AUTH_SECRET, SEED_PASSWORD
npm run db:migrate
npm run db:seed
npm run dev                  # http://localhost:3000  (sign in as admin@build-lab.dev)
```

## Documentation

| Doc | What it covers |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Product principles, stack, conventions, non-negotiables |
| [REBUILD.md](REBUILD.md) | **Self-contained blueprint** to redeploy or rebuild the whole app on a new domain/system |
| [docs/onboarding.md](docs/onboarding.md) | New-developer setup (own dev database, PR workflow) |
| [docs/01-architecture.md](docs/01-architecture.md) | Product & application architecture |
| [docs/02-ux-information-architecture.md](docs/02-ux-information-architecture.md) | Routes, navigation, user journeys, intake schema |
| [docs/03-data-model.md](docs/03-data-model.md) | Data model, state machines, permissions |
| [docs/04-scoring-and-governance.md](docs/04-scoring-and-governance.md) | Scoring engine & governance workflow |
| [docs/05-implementation-plan.md](docs/05-implementation-plan.md) | Build sequence & logged assumptions |

> Where the `docs/01`–`05` narrative and the code disagree, the code is the source of
> truth. `REBUILD.md` §12 lists the known discrepancies.

## Commands

```bash
npm run dev        # local dev server
npm run build      # production build
npm test           # Vitest: scoring, workflow, RBAC
npm run db:migrate # apply migrations (dev)
npm run db:deploy  # apply migrations (provisioned DB, no prompts)
npm run db:seed    # (re)seed — requires SEED_PASSWORD
```
