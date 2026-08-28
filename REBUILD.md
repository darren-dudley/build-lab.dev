# BCP Build Lab — Rebuild Blueprint

A single, self-contained document for standing up **BCP Build Lab** again: on a new
domain, on a new machine, or in a fresh account. It is written so that another
engineer (or another Claude) can work from **this file alone**, though the fastest,
most faithful path is to bring the repository with it.

> **Product:** BCP Build Lab — a B2B platform for managing AI initiatives from intake
> through triage, scoring, governance, human assignment, execution, and value
> measurement. Live at build-lab.dev.

---

## 0. How to use this document

There are two ways to "rebuild," and they are not equal:

| Path | What you get | Fidelity | Use when |
|---|---|---|---|
| **A. Redeploy the repo** (§1) | The exact same application on new infrastructure and a new domain | 100% identical | You have the git repo (recommended, always) |
| **B. Regenerate from spec** (§2–§10) | A fresh implementation built from this specification | Approximates the app; behavior will drift | The repo is genuinely unavailable |

**Always prefer Path A.** The code is the source of truth. This document's spec
sections are complete enough to *rebuild from scratch*, but a from-spec rebuild will
produce different code and subtle behavior differences. The scoring math, data model,
state machine, and RBAC matrix below are exact; UI polish and edge-case handling are
not fully captured by any prose spec.

If you are handing this to another Claude, see **§11 "Handoff prompt."**

---

## 1. Path A — Redeploy the existing app

### 1.1 Prerequisites

- Node.js 20+ and npm
- A [Neon](https://neon.tech) account (Postgres) — free tier is sufficient
- A [Vercel](https://vercel.com) account (hosting) — or any Node host
- The target domain (if not reusing build-lab.dev)
- Optional: an [Anthropic API key](https://console.anthropic.com) — only the
  "Draft with AI" triage helper uses it; the app runs fine without it.

### 1.2 Get the code

```bash
git clone https://github.com/darren-dudley/build-lab.dev.git
cd build-lab.dev
npm install          # runs `prisma generate` via postinstall
```

### 1.3 Provision the database (Neon)

1. Create a Neon project. The free tier is plenty.
2. From the dashboard, copy **two** connection strings:
   - The **pooled** string (host contains `-pooler`) → `DATABASE_URL` (runtime)
   - The **direct** string (host without `-pooler`) → `DIRECT_DATABASE_URL` (migrations)

Prisma 7 here is configured in `prisma.config.ts` (not in the schema). The CLI
(migrate/seed/studio) uses `DIRECT_DATABASE_URL`; the runtime client uses
`DATABASE_URL` through `@prisma/adapter-neon` in `src/server/db.ts`.

### 1.4 Environment variables

Copy the template and fill it in:

```bash
cp .env.example .env.local
```

| Variable | Required | How to get it |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon **pooled** string (host has `-pooler`) |
| `DIRECT_DATABASE_URL` | ✅ | Neon **direct** string (no `-pooler`) |
| `AUTH_SECRET` | ✅ | `openssl rand -base64 32` |
| `SEED_PASSWORD` | ✅ (to seed) | Any password; applied to all seeded users |
| `ANTHROPIC_API_KEY` | ⬜ optional | Your own key; only the AI-draft button needs it |
| `VERCEL_OIDC_TOKEN` | auto | Written by `vercel link` / `vercel env pull` — never set by hand |

`.env.local` is gitignored and must never be committed. **Do not reuse production
secrets on a new deployment** — generate a fresh `AUTH_SECRET` and use a fresh
database.

### 1.5 Create the schema and seed

```bash
npm run db:migrate     # dev: apply migrations to your database (prisma migrate dev)
# or, against a provisioned prod DB:
npm run db:deploy      # prisma migrate deploy (no dev prompts)

npm run db:seed        # idempotent foundation seed (see §9)
```

The seed **requires `SEED_PASSWORD`** and is safe to re-run (it upserts). It creates
scoring models, capacity settings, phase templates, taxonomies, and an admin user.
See §9 for exactly what is foundation vs. demo data.

### 1.6 Run locally

```bash
npm run dev            # http://localhost:3000
```

Sign in at `/login` with `admin@build-lab.dev` and the `SEED_PASSWORD` you chose.
The public root `/` is intentionally blank (a product decision); the app lives behind
`/login`, and public intake is at `/submit`.

### 1.7 Deploy to Vercel + point the domain

1. Import the repo as a Vercel project (framework auto-detected as Next.js).
2. Add the environment variables from §1.4 in **Project → Settings → Environment
   Variables** (Production + Preview). Use the pooled `DATABASE_URL` for runtime.
3. Set the build to run migrations against the production DB. Either run
   `npm run db:deploy` once from your machine against the prod `DIRECT_DATABASE_URL`,
   or add it to the build. Then run `npm run db:seed` once against prod.
4. Add your domain in **Project → Settings → Domains** and follow the DNS
   instructions. Production auto-deploys on push to `main`.

### 1.8 Verify

- Load the domain root (blank page renders) and `/login`.
- Sign in as admin; the shell and left nav appear.
- Submit a test initiative at `/submit`; confirm it lands in Triage.
- Run `npm test` — the scoring, workflow, and RBAC suites should pass (27 tests).
- **Delete any test submissions** before going live (they are real DB rows).

### 1.9 Operational notes (carry these forward)

- **Vercel BotID** protects `/login` and `/submit`. Automated/browser tests must type
  at human pace or they are blocked. It is a dependency (`botid`), wired in the app.
- **Auto-deploy from `main`** means the live site changes on every merge. Prefer PRs +
  Vercel preview URLs over direct pushes to `main` (see `docs/onboarding.md`).
- **Next.js 16 writes an agent-instructions block into `CLAUDE.md`** on `next dev`
  (see `node_modules/next/dist/server/lib/generate-agent-files.js`). Committing it with
  your work keeps the tree clean.

---

## 2. Path B — Product spec: principles & architecture

Everything from here down is the consolidated specification, code-grounded as of the
current `main`. Where the older `docs/01`–`05` disagree with the code, **the code wins**
and the difference is flagged. Known discrepancies are collected in §12.

### 2.1 Non-negotiable product principles

1. **Initiatives and Projects are distinct objects, never conflated.**
   - **Initiative** = the evaluated opportunity. Immutable intake record + triage
     normalization + versioned scores + governance decisions. The permanent decision
     record.
   - **Project** = the execution record, created *only* by explicit human governance
     authorization. Holds phases, tasks, milestones, health, updates, KPIs. Permanent
     FK to its originating Initiative.
2. **Scoring ranks; humans decide.** No code path computes, suggests, or defaults a
   delivery-lane assignment (Rapid Deployment / External FDE Pod / Core
   Transformation). Assignment exists only as a recorded human decision. **This is
   unit-tested** and enforced in the scoring engine header.
3. **Intake responses are immutable after submission.** Triage normalization is stored
   separately (`TriageReview`) so the requester's words are never overwritten.
4. **Scores, governance decisions, transitions, and audit events are append-only.**
   Never silently overwrite historical records; supersede with `isCurrent` flags.
5. **All authorization is server-side** via `src/server/rbac` `requirePermission()`.
   Hiding nav is UX, not security.

### 2.2 Technical stack (exact versions from package.json)

| Concern | Choice |
|---|---|
| Framework | Next.js **16.3.0** (App Router), React **19.2.8** |
| Language | TypeScript 5 |
| Database | Neon Postgres via `@neondatabase/serverless` 1.1 |
| ORM | Prisma **7.9.1** (`@prisma/client` + `@prisma/adapter-neon`); config in `prisma.config.ts` |
| Auth | Auth.js / NextAuth **5.0.0-beta.32**, Credentials provider, `bcryptjs` hashing |
| Styling | Tailwind CSS **v4** (`@tailwindcss/postcss`) |
| Components | shadcn/ui (`radix-ui`, `lucide-react`, `cmdk`, `sonner`, `next-themes`) |
| Tables | `@tanstack/react-table` |
| Validation | Zod **4** at every server boundary (shared client/server schemas) |
| AI (optional) | `ai` (Vercel AI SDK) + `@ai-sdk/anthropic` — triage draft helper only |
| Bot defense | `botid` (Vercel BotID) on `/login` and `/submit` |
| Testing | Vitest 4 (business logic) |
| Hosting | Vercel, auto-deploy on push to `main` |

Single Next.js app — **no monorepo**.

### 2.3 Module architecture (actual `src/server/` tree)

Business logic lives in `src/server/<module>/`, **never** in UI components. Each module
exposes typed functions consumed by server components and server actions.

```
src/server/
  auth/          # index.ts (session, credential verification), rate-limit.ts (brute-force lock)
  rbac/          # index.ts (requirePermission/requireSession), permissions.ts (matrix)
  workflow/      # index.ts (transition + record), transitions.ts (ALLOWED_TRANSITIONS whitelist + labels)
  intake/        # index.ts (draft/submit + validateSubmission wrap), actions.ts, public-actions.ts
  triage/        # index.ts, actions.ts (queue, normalization, clarification)
  scoring/       # engine.ts (PURE, no I/O), index.ts (persistence + versioning)
  governance/    # index.ts, actions.ts, decision-rules.ts
  projects/      # index.ts, actions.ts (conversion, phases, tasks, milestones, health, updates)
  admin/         # actions.ts, more-actions.ts, bc-derive.ts (users, companies, scoring, BC ref, capacity, taxonomies)
  ai/            # suggest-scores.ts (optional Anthropic-backed triage draft)
  comments/      # actions.ts (threaded comments + mentions)
  saved-views/   # actions.ts (per-user table config)
  search/        # actions.ts (global search)
  audit/         # index.ts (append-only audit writer)
  db.ts          # Prisma client via Neon adapter (pooled DATABASE_URL)
```

Rules:
1. **The scoring engine is pure.** `computeScore(...)` takes dimensions + model version
   (+ BC reference for portfolio) and returns a result. No database, no dates, no
   randomness. Persistence in `scoring/index.ts` wraps it. Independently unit-tested.
2. **Every state transition goes through `workflow/`.** Direct status writes are
   forbidden; the module validates against the whitelist, records a `StatusTransition`,
   and emits audit + activity events in the same transaction.
3. **Every mutation authorizes server-side** via `rbac.requirePermission()` inside the
   server action.
4. **Audit writes are append-only** and happen in the same transaction as the mutation
   they record.

> **[DOC≠CODE]** The older `docs/01` lists aspirational modules (`investment-priority/`,
> `capacity/`, `kpi/`, `notifications/`, `analytics/`) as separate folders. In the code
> these live inside `admin/`, `projects/`, and shared queries. Follow the tree above.

---

## 3. Data model (Prisma — the real schema)

Postgres, UUID PKs, `createdAt`/`updatedAt` throughout, soft delete (`deletedAt`) on
User, PortfolioCompany, Initiative, Project, Comment. **40 models.**

### 3.1 Models (name — purpose)

**Identity & reference**
1. **User** — identity: email (unique), name, title, passwordHash, isActive, lastLoginAt, loginCount, deletedAt.
2. **LoginAttempt** — durable brute-force throttle keyed by unique email (failedCount, lockedUntil). *(In code, not in docs.)*
3. **UserRole** — user↔RoleType join; `@@unique([userId, role])`. Users may hold multiple roles.
4. **PortfolioCompany** — name (unique), sector, fundNumber, equityCheckUsd, valueUsd, exitedAt, notes.
5. **TaxonomyItem** — admin-managed vocab keyed by `kind`; `@@unique([kind, label])`.

**Initiative & intake**
6. **Initiative** — core request: requestType, name, status, requesterId?/Name?/Email?, portfolioCompanyId?, functionId?, submittedAt.
7. **IntakeResponse** — 1:1 immutable submission (typed columns + JSON payloads); `lockedAt`; editable only in DRAFT/NEEDS_INFORMATION.
8. **Sponsor** — 1:1 (name, title, email, confirmed).
9. **BusinessOwner** — 1:1 (name, title, email).
10. **InitiativeDataSource** — feasibility rows (system, dataType, owner, accessStatus, notes).
11. **InitiativeSystem** — join to SYSTEM taxonomy (+ otherLabel).
12. **InitiativeKPI** — proposed KPI (metric, baseline, target, noBaseline).
13. **InitiativeFlag** — triage flag; `@@unique([initiativeId, flagType])`; addedById, resolvedAt.
14. **InitiativeTag** — join to TAG taxonomy; `@@unique([initiativeId, tagId])`.
15. **StatusTransition** — append-only workflow history (fromStatus, toStatus, actorId?, note).
16. **TriageReview** — 1:1 normalization (normalizedName/Problem/Ask, internalNotes). Separate so IntakeResponse stays immutable.

**Scoring & governance**
17. **ScoringModel** — one per modelType (`modelType @unique`).
18. **ScoringModelVersion** — versioned weights(JSON) + rubrics(JSON); `@@unique([modelId, version])`; never mutated.
19. **InvestmentPriorityReference** — append-only quarterly BC priority per company (checkSizeScore, remainingValueScore, runwayScore 1–5, calculatedPriority, version); `@@unique([companyId, version])`.
20. **InitiativeScore** — append-only; compositeScore (0–100), opportunityQuality (0–100), bcPriority? (1–5), refs modelVersion + investmentPriorityReference; isCurrent.
21. **ScoreComponent** — per-dimension (value 1–5, rationale); `@@unique([scoreId, dimension])`.
22. **GovernanceDecision** — decision, rationale, conditions, priorityNotes, reconsiderAt?, anticipatedLane? (label-only), isCurrent.
23. **GovernanceDecisionMaker** — decision↔user join; `@@unique([decisionId, userId])`.
24. **DeliveryAssignment** — 1:1 lane assignment; created **only** by explicit human governance action (lane, assignedById, note).
25. **CapacitySetting** — per-lane capacity int (`lane @unique`).
26. **PhaseTemplate** — per-lane phase template (`@@unique([lane, sortOrder])`).

**Delivery / project**
27. **Project** — 1:1 with Initiative (unique lineage); name, lane, status, leadId?, health, healthNote, currentPhaseId?, targetDeploymentDate, startedAt, completedAt.
28. **ProjectMember** — project↔user (role?); `@@unique([projectId, userId])`.
29. **ProjectPhase** — instantiated phase; `@@unique([projectId, sortOrder])`.
30. **Task** — status, owner?, dueDate, priority?, phaseId?, self-relation dependency, blockerNote, sortOrder.
31. **Milestone** — targetDate, completedAt, phaseId?.
32. **ProjectUpdate** — accomplished, next, risks, decisionsNeeded, kpiUpdate, healthAtTime.
33. **Risk** — title, detail, severity, status (default "OPEN").
34. **Decision** — title, detail, decidedAt.
35. **ProjectKPI** — carried from InitiativeKPI; currentResult, measuredAt, methodology, valueType, category, numericValue.

**Cross-cutting**
36. **Comment** — polymorphic (entityType + entityId), body, mentions(JSON), deletedAt.
37. **ActivityEvent** — curated feed (initiativeId?/projectId?/actorId?, eventType, summary, meta).
38. **Notification** — user notification (type, title, body, entityRef, readAt).
39. **SavedView** — per-user table config (tableKey, name, config JSON, teamScope?).
40. **AuditEvent** — append-only audit (actorId?, action, entityType, entityId, before/after JSON).

### 3.2 Enums (verbatim values)

- **RoleType**: `REQUESTER, TRIAGE, GOVERNANCE, DELIVERY, ADMIN`
- **TaxonomyKind**: `FUNCTION, VALUE_LEVER, SYSTEM, SPECIALIST_WORKFLOW, TAG`
- **RequestType**: `SPECIALIST_SPECIALIST, SPECIALIST_PORTCO, GENERALIST_PORTCO`
- **InitiativeStatus**: `DRAFT, SUBMITTED, NEEDS_INFORMATION, TRIAGE, READY_FOR_GOVERNANCE, GOVERNANCE_REVIEW, APPROVED_AWAITING_CAPACITY, APPROVED_SCHEDULED, IN_DELIVERY, DEPLOYED, MEASURING_IMPACT, COMPLETED, DEFERRED, REJECTED, CANCELLED`
- **EffortEstimate**: `SMALL, MEDIUM, LARGE`
- **DataAccessStatus**: `CONFIRMED, LIKELY, UNCONFIRMED, UNKNOWN`
- **FlagType**: `SENSITIVE_DATA, SECURITY_REVIEW_REQUIRED, DATA_ACCESS_UNCONFIRMED, SPONSOR_UNCONFIRMED, THIRD_PARTY_DEPENDENCY, SIGNIFICANT_CHANGE_MANAGEMENT, EXISTING_REUSABLE_SOLUTION, SIMILAR_REQUESTS_EXIST, EXECUTIVE_DEADLINE, MEASUREMENT_BASELINE_MISSING`
- **ScoringModelType**: `PORTFOLIO, SPECIALIST`
- **ScoreDimension**: `BUSINESS_IMPACT, TIME_TO_ARTIFACT, DATA_FEASIBILITY, SPONSORSHIP, STRATEGIC_FIT`
- **GovernanceDecisionType**: `APPROVE, APPROVE_AWAITING_CAPACITY, DEFER, MORE_INFORMATION, REJECT`
- **DeliveryLane**: `RAPID_DEPLOYMENT, EXTERNAL_FDE_POD, CORE_TRANSFORMATION`
- **ProjectStatus**: `ACTIVE, COMPLETED, CANCELLED`
- **ProjectHealth**: `GREEN, YELLOW, RED`
- **TaskStatus**: `NOT_STARTED, IN_PROGRESS, WAITING, BLOCKED, COMPLETE, CANCELLED`
- **KpiValueType**: `ESTIMATED, VALIDATED`
- **KpiCategory**: `HOURS_SAVED, COST_SAVINGS, REVENUE_IMPACT, MARGIN_IMPACT, PRODUCTIVITY, OTHER`
- **EntityType**: `INITIATIVE, PROJECT, TASK`

---

## 4. State machines

### 4.1 Initiative — the enforced transition whitelist

Source of truth: `src/server/workflow/transitions.ts` (`ALLOWED_TRANSITIONS`). Any
transition not listed **throws**; there is no other path to change status.
`canTransition(from, to)` is a membership test.

```
DRAFT                       → SUBMITTED, CANCELLED
SUBMITTED                   → TRIAGE, NEEDS_INFORMATION, CANCELLED
NEEDS_INFORMATION           → SUBMITTED, TRIAGE, CANCELLED
TRIAGE                      → READY_FOR_GOVERNANCE, NEEDS_INFORMATION, CANCELLED
READY_FOR_GOVERNANCE        → GOVERNANCE_REVIEW, TRIAGE, CANCELLED
GOVERNANCE_REVIEW           → APPROVED_AWAITING_CAPACITY, APPROVED_SCHEDULED, DEFERRED,
                              REJECTED, NEEDS_INFORMATION, READY_FOR_GOVERNANCE, CANCELLED
APPROVED_AWAITING_CAPACITY  → APPROVED_SCHEDULED, DEFERRED, CANCELLED
APPROVED_SCHEDULED          → IN_DELIVERY, APPROVED_AWAITING_CAPACITY, CANCELLED
IN_DELIVERY                 → DEPLOYED, CANCELLED
DEPLOYED                    → MEASURING_IMPACT, COMPLETED
MEASURING_IMPACT            → COMPLETED
COMPLETED                   → (terminal)
DEFERRED                    → READY_FOR_GOVERNANCE, REJECTED, CANCELLED
REJECTED                    → (terminal)
CANCELLED                   → (terminal)
```

Note `CANCELLED` is only reachable from pre-delivery and the two approved-but-unstarted
states, not from IN_DELIVERY onward.

Two label maps also live in `transitions.ts`:
- **`externalStatusLabel`** (requester-facing) collapses TRIAGE / READY_FOR_GOVERNANCE /
  GOVERNANCE_REVIEW → "In Review"; APPROVED_AWAITING_CAPACITY / APPROVED_SCHEDULED →
  "Approved"; REJECTED → "Not Pursued".
- **`statusLabel`** (internal) — full descriptive labels.

### 4.2 Project

`ProjectStatus`: `ACTIVE → COMPLETED | CANCELLED`. There is **no** code-enforced
project-status whitelist (unlike Initiative). Progress granularity lives in
`ProjectPhase` (linear rail, `currentPhaseId`) and `ProjectHealth`
(GREEN/YELLOW/RED; YELLOW/RED require a `healthNote`, enforced in the service layer).
Initiative status mirrors coarse project progress (IN_DELIVERY → DEPLOYED →
MEASURING_IMPACT → COMPLETED) through the workflow module.

---

## 5. RBAC — roles & permission matrix

Source: `src/server/rbac/permissions.ts`. Roles: `REQUESTER, TRIAGE, GOVERNANCE,
DELIVERY, ADMIN` (a user may hold several). `ALL` = all five.

| Permission key | Allowed roles |
|---|---|
| `initiative.create` | ALL |
| `initiative.viewOwn` | ALL |
| `initiative.respondInfo` | ALL (ownership-checked in service) |
| `initiative.viewAll` | TRIAGE, GOVERNANCE, DELIVERY, ADMIN |
| `initiative.viewInternal` | TRIAGE, GOVERNANCE, ADMIN |
| `triage.review` | TRIAGE, ADMIN |
| `triage.score` | TRIAGE, ADMIN |
| `triage.flag` | TRIAGE, ADMIN |
| `triage.requestInfo` | TRIAGE, ADMIN |
| `governance.viewRanking` | TRIAGE, GOVERNANCE, ADMIN |
| `governance.decide` | GOVERNANCE, ADMIN |
| `governance.assignLane` | GOVERNANCE, ADMIN |
| `project.start` | GOVERNANCE, ADMIN |
| `project.view` | DELIVERY, GOVERNANCE, TRIAGE, ADMIN |
| `project.manage` | DELIVERY, ADMIN |
| `admin.users` | ADMIN |
| `admin.companies` | ADMIN |
| `admin.scoring` | ADMIN |
| `admin.investmentPriority` | ADMIN |
| `admin.capacity` | ADMIN |
| `admin.taxonomies` | ADMIN |
| `admin.audit` | ADMIN |

Enforcement: `hasPermission(roles, permission)` = any role ∈ `PERMISSIONS[permission]`.
`requireSession()` throws if no `session.user.id`. `requirePermission(permission)`
throws `Missing permission: {permission}` if not held.

---

## 6. Scoring engine (exact spec)

Source of truth: `src/server/scoring/engine.ts` (pure) + `index.ts` (persistence).

### 6.1 Two models and their exact weights

**Portfolio Priority Score** — composite of 100 = 65 operational + 35 BC:

| Dimension | Points |
|---|---|
| BUSINESS_IMPACT | 17 |
| TIME_TO_ARTIFACT | 17 |
| DATA_FEASIBILITY | 13 |
| SPONSORSHIP | 9 |
| STRATEGIC_FIT | 9 |
| BC_INVESTMENT_PRIORITY | 35 |

**Specialist Priority Score** — composite of 100, no BC component:

| Dimension | Points |
|---|---|
| BUSINESS_IMPACT | 27 |
| TIME_TO_ARTIFACT | 27 |
| DATA_FEASIBILITY | 20 |
| SPONSORSHIP | 13 |
| STRATEGIC_FIT | 13 |

`modelTypeFor(requestType)`: `SPECIALIST_SPECIALIST → SPECIALIST`; everything else →
`PORTFOLIO`.

### 6.2 Exact arithmetic (from engine.ts)

Each dimension value is a number in **[1, 5]** (else `ScoringError`).

```
operationalWeight = Σ weights[d]                 // portfolio 65, specialist 100
bcWeight          = weights.BC_INVESTMENT_PRIORITY ?? 0
operationalPoints = Σ over d of (dimensions[d] / 5) * weights[d]

PORTFOLIO:
  bcPoints           = (bcPriority / 5) * bcWeight          // bcWeight = 35
  composite          = Math.round(operationalPoints + bcPoints)
  opportunityQuality = Math.round((operationalPoints / operationalWeight) * 100)  // /65*100

SPECIALIST:
  composite          = Math.round(operationalPoints)
  opportunityQuality = composite                            // identity
```

**Invariants (all throw `ScoringError`):**
- Every dimension value ∈ [1,5]; every dimension weight defined.
- PORTFOLIO: `bcWeight > 0` **and** `bcPriority` defined **and** `bcPriority ∈ [1,5]`.
- SPECIALIST: must **not** carry a `BC_INVESTMENT_PRIORITY` weight and must **not**
  receive a `bcPriority`.
- `operationalWeight + bcWeight` must equal exactly **100**.

### 6.3 BC Investment Priority (the 3-input figure)

`computeBcPriority(checkSize, remainingValue, runway)` — each input a number in [1,5]:

```
calculatedPriority = Math.round(((checkSize + remainingValue + runway) / 3) * 100) / 100
```

A **simple average of three 1–5 scores**, rounded to 2 decimals. No hidden multipliers.

> **[NOT IN CODE]** Earlier product notes referenced a *fund-vintage → runway* mapping
> (e.g. Fund XIV = 5). **No such lookup exists in the code.** `runwayScore` is entered
> directly by an administrator as part of `InvestmentPriorityReference`. If a rebuild
> spec calls for auto-deriving runway from vintage, that is new work, not existing
> behavior.

### 6.4 Score versioning & side effects (from index.ts)

- `scoreInitiative()` is **append-only**: it sets prior `isCurrent=true` rows to false,
  then creates a new `InitiativeScore` + `ScoreComponent` rows.
- Model version = highest `version` for the model (`getCurrentModelVersion`).
- Portfolio scoring requires `portfolioCompanyId` and joins the latest
  `InvestmentPriorityReference` for that company (ordered by effectiveDate desc, version
  desc). If none exists, it throws. It stores `bcPriority = ref.calculatedPriority` and
  permanently pins `investmentPriorityReferenceId = ref.id`.
- All in one `$transaction`: if status is SUBMITTED, auto-advance SUBMITTED → TRIAGE
  (scoring is a triage act); write `AuditEvent` `score.create`; write `ActivityEvent`
  `score_change` = `Scored {composite}/100 (model v{version})`.
- Editing weights/rubrics creates a **new** `ScoringModelVersion`; existing scores keep
  pointing at the version that produced them.

### 6.5 Rubrics

Current rubrics are **placeholder drafts** (seed `draftRubric`), keyed "1"–"5" and
marked `DRAFT — pending official rubric`. Only anchors 1 and 5 carry dimension-specific
text; 2–4 are generic. Low/high anchors:

| Dimension | "1" | "5" |
|---|---|---|
| BUSINESS_IMPACT | minimal measurable outcome | transformative, company-level outcome |
| TIME_TO_ARTIFACT | 6+ months to a usable artifact | usable artifact within days to 2 weeks |
| DATA_FEASIBILITY | data inaccessible, fragmented, or unavailable | data accessible, clean, and confirmed |
| SPONSORSHIP | no clear owner or sponsor | committed executive sponsor and engaged owner |
| STRATEGIC_FIT | one-off with no reuse potential | core strategic use case, highly repeatable |

The engine **never** computes, suggests, or defaults a delivery lane.

---

## 7. Intake schema

Source: `src/lib/intake-schema.ts` (shared client + server; the single source of truth
for validation). The 6-step branching form is `src/components/intake/intake-form.tsx`,
consumed by `/intake/new` (authenticated) and `/submit` (public).

### 7.1 Request types

- `SPECIALIST_SPECIALIST` — "Specialist — Specialist Build"
- `SPECIALIST_PORTCO` — "Specialist — Portfolio Company Build"
- `GENERALIST_PORTCO` — "Generalist — Portfolio Company Build"
- `isPortfolioType(t)` = true for the two `*_PORTCO` types.

### 7.2 Steps (branching)

- **Step 0 — Request type** drives all branching.
- **Step 1 — Basics/Routing**: initiative name; requester name/email (public); for
  portfolio types: portfolio company + sponsor (name/title/email) + function; for
  specialist type: specialist workflow.
- **Step 2 — Business Problem**: business problem; how it works today
  (`currentProcess`); who/what affected (multi-select + explanation).
- **Step 3 — The Ask**: AI task; 90-day success definition; KPI repeater (+ "no
  baseline" option); value levers [portfolio] or workflow-change [specialist]; effort
  S/M/L.
- **Step 4 — Feasibility**: data-source repeater; systems multi-select; prior attempts
  + reusability; Time-to-Artifact (value + unit); rough budget range.
- **Step 5 — Prioritization Signal**: only-one-this-quarter Y/N/Unsure + why; forcing
  event date/event/consequence; outcome owner; final context.
- **Step 6 — Review & Submit.**

Autosave is debounced per field to the draft. A draft **is** an Initiative in `DRAFT`
status (no separate draft entity). Steps are resumable from "My Initiatives."

### 7.3 `draftDataSchema` fields (all optional; autosave accepts partial)

`requesterName`, `requesterEmail`, `name`, `portfolioCompanyId` (uuid), `functionId`
(uuid), `specialistWorkflow`, `sponsorName`, `sponsorTitle`, `sponsorEmail`,
`businessProblem`, `currentProcess`, `affected {selections[], explanation?}`, `aiTask`,
`successDefinition`, `kpis[]` (each: `metric` required, baseline?, target?, noBaseline),
`noBaselineExists`, `valueCreation {levers[], explanation?}`, `effortEstimate`
(SMALL|MEDIUM|LARGE), `dataSources[]` (each: `system` required, dataType?, owner?,
accessStatus default UNKNOWN, notes?), `systems[]` (taxonomy IDs or `"other:<label>"`),
`priorAttempts` (NO|INTERNAL|VENDOR|CONSULTANT|MULTIPLE|UNKNOWN), `priorAttemptsDetail`,
`timeToArtifactValue` (positive int), `timeToArtifactUnit` (DAYS|WEEKS|MONTHS),
`budgetRange` (UNSURE|UNDER_50K|B50_150K|B150_500K|OVER_500K), `onlyOneAnswer`
(YES|NO|UNSURE), `onlyOneWhy`, `forcingEventDate` (ISO), `forcingEvent`,
`forcingConsequence`, `outcomeOwnerName`, `outcomeOwnerTitle`, `finalContext`,
`stepProgress` (Record<string,boolean>).

### 7.4 `validateSubmission` — required fields (current, minimal core)

Returns an array of missing-field labels. **Core only** — everything else is optional
context that helps triage but never blocks a submission:

- If `opts.anonymous` (public `/submit`): `requesterName` → "Your name";
  `requesterEmail` matching `/.+@.+\..+/` → "Your email".
- Always: `name` → "Initiative name"; `businessProblem` → "The business problem or
  challenge"; `aiTask` → "What you want AI to do".
- If `isPortfolioType(requestType)`: `portfolioCompanyId` → "Portfolio company"
  (required because scoring joins its BC investment priority).

Sponsor, function, KPIs, effort, data sources, TTA, and the whole prioritization signal
are **optional** at submit. The form marks each optional field with an "(optional)"
label so core vs. optional is visible.

---

## 8. Routes & navigation

### 8.1 Persistent left nav

```
Home
Intake → Submit Initiative
Initiatives → All Initiatives · My Initiatives
Triage → Triage Queue
Governance → Governance Queue · Portfolio Ranking
Delivery → Rapid Deployment · External FDE Pod · Core Transformation · Awaiting Capacity
Projects → All Projects
Analytics
Admin → Users · Portfolio Companies · Scoring · Investment Priority · Capacity · Taxonomies · Settings
```

Nav sections render only for roles with access, but **every route also enforces authz
server-side.** Global search: `/` to focus, `⌘K` command palette.

### 8.2 Route map

| Route | Purpose | Roles |
|---|---|---|
| `/` | Public blank page (product decision) | public |
| `/login` | Credential sign-in | public |
| `/submit`, `/submit/[id]` | Public intake (BotID-protected) | public |
| `/home` | Role-aware home | all authenticated |
| `/intake/new`, `/intake/[id]` | Authenticated multi-step intake w/ autosave | Requester+ |
| `/initiatives` | All initiatives table | Triage, Governance, Delivery, Admin |
| `/initiatives/mine` | Requester's submissions | all |
| `/initiatives/[id]` | Detail (tabs: Overview, Intake, Triage, Scoring, Governance, Activity, [Project]) | varies |
| `/triage`, `/triage/[id]` | Queue + workspace (submission left, scoring right) | Triage, Admin |
| `/governance` | Decision-ready queue | Governance, Admin |
| `/governance/ranking` | Portfolio ranking table | Governance, Admin |
| `/governance/compare?ids=` | 2–5 initiative comparison | Governance, Admin |
| `/delivery/rapid-deployment` | Command center | Delivery, Governance, Admin |
| `/delivery/fde-pod`, `/delivery/core-transformation` | Lane views | Delivery, Governance, Admin |
| `/delivery/awaiting-capacity` | Approved, unstarted queue | Delivery, Governance, Admin |
| `/projects`, `/projects/[id]` | List + overview (tabs: Overview, Tasks, Timeline, Updates, KPIs, Activity) | Delivery+, sponsors read |
| `/analytics` | Portfolio analytics | Governance, Admin, leadership |
| `/notifications` | Notification center | all |
| `/admin/*` | users, companies, scoring, investment-priority, capacity, taxonomies, settings, audit | Admin |

---

## 9. Seed contents (`prisma/seed.ts`)

Idempotent (upserts on natural unique keys), uses the Neon adapter + `DATABASE_URL`,
and **requires `SEED_PASSWORD`** (throws if missing). All seeded users share a bcrypt
hash (cost 10) of `SEED_PASSWORD`.

### 9.1 Foundation (needed to run the app)

- **Scoring models + v1 versions** — the exact weights in §6.1; rubrics = draft
  placeholders; version 1 authored by the admin user.
- **Capacity settings** — `RAPID_DEPLOYMENT=10, EXTERNAL_FDE_POD=5,
  CORE_TRANSFORMATION=3`.
- **Phase templates** — all three lanes get the same 10 phases: `Discovery, Solution
  Design, Data / Access, Build, QA, User Testing, Pilot, Production, Measurement,
  Complete` (sortOrder 0–9).
- **Taxonomies** (`TaxonomyItem`):
  - FUNCTION (11): Sales, Marketing, Finance, Operations, HR / People, Product,
    Technology / Engineering, Customer Service, Legal / Compliance, Procurement, Other.
  - SPECIALIST_WORKFLOW (9): Artificial Intelligence, Cyber Security, Digital, Finance,
    IT, Marketing, Operations, Sales & GTM, Talent & Recruiting.
  - SYSTEM (20): Salesforce, HubSpot, NetSuite, QuickBooks, SAP, Oracle, Workday, ADP,
    Zendesk, ServiceNow, Microsoft 365, Google Workspace, Slack, Snowflake, Tableau,
    Power BI, Shopify, Stripe, Notion, Airtable.
  - VALUE_LEVER (10): Revenue, Cost, Margin, Productivity, Customer Experience, Quality,
    Risk, Speed, Strategic Capability, Other.
  - TAG (11): PMC automation, Sales-call preparation, Financial variance analysis,
    Customer-service agent, Document generation, Knowledge search, Churn prediction,
    Pricing analysis, Contract review, Content generation, Recruiting workflow.
- **Admin user** — `admin@build-lab.dev` (Alex Admin, roles ADMIN + REQUESTER); used as
  `createdById` for reference + scoring version rows.

### 9.2 Demo data (illustrative; safe to omit for a clean launch)

- **13 demo users** (each also REQUESTER) across TRIAGE / GOVERNANCE / DELIVERY /
  REQUESTER roles.
- **10 portfolio companies** with BC reference v1 `[checkSize, remaining, runway]`
  (effectiveDate 2026-07-01, version 1, calculatedPriority = the 3-input average).

The seed does **not** create initiatives or projects. For a production launch, seed the
foundation, then remove/deactivate demo users and companies (or trim the demo blocks
from `seed.ts`).

---

## 10. Testing & commands

```bash
npm run dev        # local dev server
npm run build      # production build (run before pushing)
npm test           # Vitest: scoring, workflow, RBAC (27 tests)
npm run db:migrate # apply migrations to your dev DB (prisma migrate dev)
npm run db:deploy  # apply migrations to a provisioned DB (no prompts)
npm run db:seed    # (re)seed — requires SEED_PASSWORD
```

The scoring engine's purity and the "scoring never assigns a lane" principle are
covered by unit tests. Keep those green — they encode the non-negotiables.

---

## 11. Handoff prompt (for another Claude)

Paste something like this when you want an AI agent to do the rebuild:

> I want to stand up an application called **BCP Build Lab** on a new domain. The
> repository is at `https://github.com/darren-dudley/build-lab.dev` and contains a
> file `REBUILD.md` that is the complete blueprint. **Read `REBUILD.md` and
> `CLAUDE.md` first**, then follow **Path A** (redeploy the existing repo): provision a
> new Neon Postgres database and a Vercel project, set the environment variables it
> lists, run the migrations and the seed, and deploy. Do not push to `main` on the
> original repo. When you finish, verify by signing in as the seeded admin and
> submitting a test initiative, then delete the test data. The non-negotiable product
> principles are in §2.1 and `CLAUDE.md` — honor them (especially: scoring ranks,
> humans decide; intake is immutable; scores/decisions/audit are append-only; all
> authorization is server-side).

If the repo is genuinely unavailable, tell the agent to rebuild from **Path B** (§2–§10)
and warn that the result will approximate, not reproduce, the original — the scoring
math, data model, state machine, and RBAC matrix here are exact, but UI and edge-case
behavior are not fully specified by prose.

---

## 12. Known discrepancies & gotchas

Carry these into any rebuild:

1. **`docs/03` lists models that do not exist in code:** a `Role` table (code uses the
   `RoleType` enum + `UserRole` join, no table), a separate `Taxonomy` table (code:
   `TaxonomyItem` only), `GovernanceReview`, denormalized
   `Initiative.currentScoreId`/decision/assignment summary fields, and
   `Project.businessOwnerId`. **None exist.** Code additionally has `LoginAttempt`
   (not in docs). Trust `prisma/schema.prisma`.
2. **No fund-vintage → runway mapping exists.** `runwayScore` is admin-entered 1–5
   (§6.3).
3. **`GovernanceDecisionType` is `MORE_INFORMATION`** in code (docs abbreviate it
   `MORE_INFO`).
4. **The "anticipated lane" field is `GovernanceDecision.anticipatedLane`** (docs call
   it `anticipatedAssignment`); it is label-only and never drives assignment.
5. **`CANCELLED` is not reachable once delivery starts** (IN_DELIVERY onward) — encode
   the whitelist in §4.1 exactly.
6. **Public root `/` is intentionally blank** — a product decision, not a missing page.
7. **Vercel BotID guards `/login` and `/submit`** — automated testing must type at human
   pace.
8. **Prisma 7 is configured in `prisma.config.ts`**, not in the schema; the CLI uses
   `DIRECT_DATABASE_URL`, the runtime uses the pooled `DATABASE_URL` via the Neon
   adapter.
9. **Next.js 16 rewrites an agent block into `CLAUDE.md`** on `next dev`; commit it with
   your work to keep the tree clean.

---

*This blueprint reflects `main` as of the current build. If the schema, scoring weights,
or transition whitelist change, update §3, §6, and §4 — those three sections are the
ones a rebuild depends on most.*
