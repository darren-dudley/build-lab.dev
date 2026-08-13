# V1 Implementation Plan & Assumptions

## Build sequence (per spec §53)

**Phase 1 — Foundation.** Next.js 16 + TS + Tailwind v4 + shadcn/ui scaffold · Prisma schema (full data model migrated up front so later phases don't churn migrations) · Auth.js credentials + bcrypt + session · RBAC module + route guards · app shell (nav, top bar, command palette stub) · admin: users, portfolio companies · seed script v1.

**Phase 2 — Intake.** Branching multi-step form · per-step Zod validation · debounced autosave to Draft initiative · drafts resumable · submission → immutable IntakeResponse + Submitted status · My Initiatives · initiative detail (Overview + Intake tabs) · external status labels.

**Phase 3 — Triage & Scoring.** Triage queue (DataTable system built here — it is the platform's table foundation) · triage workspace (split view, rubric scorer, rationale, flags, normalization) · scoring engine + tests · scoring model versions + admin config · BC Investment Priority admin + reference versioning · score display components · clarification loop (Needs Information).

**Phase 4 — Governance.** Portfolio ranking (reuses DataTable: filters, grouping, saved views, column config) · comparison mode · governance workspace + decision panel · human-only assignment + tests · capacity settings + strip · awaiting-capacity queue.

**Phase 5 — Execution.** Start Project (conversion, carry-forward, lineage) · project overview · phase rail from template · tasks (list + board + timeline-lite) with inline editing + optimistic UI · milestones · health + required explanations · status updates · blockers.

**Phase 6 — Command Center & Analytics.** Rapid Deployment command center (exception emphasis: overdue, blocked, stale, at-risk, decision-required) · role-aware home · analytics with drill-down links · KPI tracking (estimated vs validated) · notification center.

Each phase ends: tests green → commit → push (auto-deploys to build-lab.dev).

## Testing focus (spec §58)

Vitest suites for: RBAC matrix · workflow transition whitelist (invalid transitions throw) · portfolio + specialist composite calculation (including rounding + boundary values 1s/5s) · BC average · score/reference version retention · governance decision recording · **no-auto-assignment invariant** · capacity math (approval never blocked by full lanes; no auto-start) · initiative→project conversion (carry-forward completeness, lineage, no data duplication drift).

## Consequential assumptions (decided to keep moving — all reversible)

1. **App placement:** this repo (`build-lab.dev`), deployed at build-lab.dev. Public `/` stays blank per prior decision; sign-in at `/login`. If this should instead live on a subdomain (e.g. `pipeline.build-lab.dev`) with the hub elsewhere, it's a small Vercel domain change later.
2. **Auth:** Auth.js (NextAuth v5) credentials + bcrypt, JWT session cookies. No public registration — admins create users; V1 users get an initial password set by admin (reset flow V1.x). SSO later via added provider.
3. **Roles are additive** (a user can be both Requester and Governance); every authenticated user can submit initiatives (any employee may have an idea).
4. **Rubric text** seeded as clearly-labeled drafts pending your official 1–5 rubrics; admin-editable, so supplying them later is data entry, not code.
5. **BC scale displayed 1–5** (per spec examples "4.6 / 5"); contributes 35 pts via (bc/5)×35.
6. **Specialist Opportunity Quality = composite** (no BC to separate); UI shows single Specialist Priority Score.
7. **External FDE Pod / Core Transformation lanes** get functional-but-lighter V1 views (project list + overview reuse); command-center depth is Rapid-Deployment-first per spec §33/§37.
8. **Notifications V1 = in-app only**; the notifications module writes typed events so an email adapter can subscribe later.
9. **Seed data uses fictional portfolio companies** and realistic AI use cases (QBR generation, sales-call prep, support agent, FP&A variance, contract review, marketing content, recruiting, knowledge search, churn, pricing).
10. **"Bootstrap admin"** seeded (admin@build-lab.dev) with a generated password delivered out-of-band; all other seed users get placeholder credentials for evaluation.
11. **Naming:** product surfaces call the two objects "Initiatives" and "Projects" exactly as spec'd; internal codename "Pipeline" appears nowhere in UI.
12. **Public intake (Darren, 2026-08-13, supersedes spec §4 for submission only):** submitting an initiative does NOT require login. Public flow at `/submit` — requester enters name/email in the form; anonymous drafts are editable via their unguessable link while in Draft/Needs Information. Everything else (triage, governance, delivery, admin) remains credentialed. Note for later: consider rate limiting/bot protection on the public route (e.g. Vercel BotID) before wide sharing.
