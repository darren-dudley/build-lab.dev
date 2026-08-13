# BCP Build Lab (build-lab.dev)

## What this is

Product name: **BCP Build Lab**. A production-quality B2B platform for managing AI initiatives from intake through triage, scoring, governance, human assignment, execution, and value measurement. Full product spec lives in the conversation history; the distilled architecture is in `docs/01`–`docs/05` — **read those before making structural changes.**

- **Repo:** https://github.com/darren-dudley/build-lab.dev · **Live:** https://build-lab.dev (auto-deploys from `main`)
- **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Prisma 7 (config in `prisma.config.ts`, not schema) · Neon Postgres · Auth.js v5 credentials
- **Public `/` is intentionally blank** (product decision). The app lives behind `/login`; public intake at `/submit`.
- **Brand:** palette pulled from baincapital.com (navy #152D48, paper #FEFCF5, blue ramp #1E5E94/#0779BF/#ABCAE9/#B2DEFF); Schibsted Grotesk UI face; mono `score-figure` class for score readouts. Status colors stay semantic — never reuse brand blues for health/flags.

## Non-negotiable product principles

- **Initiatives** (evaluated opportunities) and **Projects** (approved execution) are distinct objects — never conflate.
- **Scoring ranks; humans decide.** No code path may compute, suggest, or default a delivery-lane assignment (Rapid Deployment / External FDE Pod / Core Transformation). This is unit-tested.
- Intake responses are immutable after submission; triage normalization is stored separately.
- Scores, governance decisions, transitions, and audit events are append-only. Never silently overwrite historical records.
- All authorization is server-side via `src/server/rbac` `requirePermission()` — nav hiding is UX, not security.

## Conventions

- Business logic lives in `src/server/<module>/` — never in UI components.
- All state changes go through `src/server/workflow` (transition whitelist).
- The scoring engine (`src/server/scoring`) is pure — no I/O, no dates; persistence wraps it.
- Env: `.env.local` (gitignored) — `DATABASE_URL` (Neon pooler, runtime), `DIRECT_DATABASE_URL` (migrations), `AUTH_SECRET`, `SEED_PASSWORD`.
- DB workflow: `npm run db:migrate` (dev), `npm run db:seed` (idempotent), `npm run test` (Vitest).
- Prisma CLI reads `prisma.config.ts` (Prisma 7 style); runtime client uses `@prisma/adapter-neon` in `src/server/db.ts`.

## Build state

Phase 1 (foundation: schema, auth, RBAC, shell, seed) complete. Phases 2–6 per `docs/05-implementation-plan.md`. Consequential assumptions are logged there — check them before reversing course.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
