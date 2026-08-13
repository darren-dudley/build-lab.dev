# Product & Application Architecture

**Product:** AI Initiative Intake, Governance & Delivery Platform
**Codename:** Pipeline (working name — rename anytime)
**Status:** Architecture approved for V1 build · 2026-08-13

## Product architecture

One application, five experience surfaces over a shared initiative database:

| Surface | Primary users | Answers |
|---|---|---|
| Intake | Requesters | "How do I submit an opportunity?" |
| Triage | Triage team | "What came in, and how does it score?" |
| Governance | Governance committee | "What should we decide to pursue?" |
| Delivery | Delivery teams | "What are we building and what's blocked?" |
| Analytics + Admin | Leadership, admins | "What value are we creating? How is the system configured?" |

Two first-class objects, never conflated:

- **Initiative** — the evaluated opportunity. Immutable intake record + triage normalization + versioned scores + governance decisions. Remains the historical decision record forever.
- **Project** — the execution record, created only by explicit human governance authorization. Holds phases, tasks, milestones, health, updates, KPIs. Permanent FK to its originating Initiative.

Core operating principle enforced in code: **the scoring engine ranks; humans decide.** There is no code path that computes, suggests, or defaults a delivery assignment (Rapid Deployment / External FDE Pod / Core Transformation). Assignment exists only as a recorded human decision. This is tested (see §58 tests in the spec).

## Technical stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router) + React + TypeScript | Spec §49; Vercel-native |
| Database | Neon Postgres (already provisioned) | `DATABASE_URL` live in all envs |
| ORM | Prisma | Spec §49; migrations + type safety |
| Styling | Tailwind CSS v4 | Spec §49 |
| Components | shadcn/ui | Mature foundation; fully ownable/customizable |
| Auth | Auth.js (NextAuth v5), Credentials provider, bcrypt hashing | Credentialed access, no public registration, session via encrypted JWT cookies; provider architecture allows enterprise SSO (SAML/OIDC) later without data-model change |
| Validation | Zod at every server boundary | Shared schemas between client forms and server actions |
| Tables | TanStack Table (headless) + shadcn table primitives | Sorting/filtering/grouping/column config for the four big tables |
| Testing | Vitest (business logic), Playwright (later, critical flows) | Scoring engine + workflow + RBAC unit-tested |
| Hosting | Vercel — this project (`build-lab-dev`), domain build-lab.dev | Auto-deploy on push to `main` |

**Public root:** `/` renders an intentionally blank page (prior product decision). Sign-in at `/login`. The application lives under authenticated routes.

## Module architecture

Business logic lives in `src/server/` modules, never in UI components. Each module exposes typed functions consumed by server components and server actions.

```
src/server/
  auth/          # session, credential verification, password policy
  rbac/          # role → permission mapping, server-side guards: requirePermission()
  workflow/      # initiative + project state machines; transition validation + recording
  intake/        # draft persistence, autosave, submission, branching schema
  triage/        # queue queries, normalization, clarification requests
  scoring/       # PURE scoring engine (no I/O) + score persistence w/ versioning
  investment-priority/  # BC reference data CRUD, versioning, effective-dating
  governance/    # decision recording, comparison, ranking queries
  capacity/      # lane settings, active counts, awaiting-capacity queries
  projects/      # conversion from initiative, phases, tasks, milestones, health, updates
  kpi/           # estimated vs validated value, measurement records
  comments/      # threaded comments + mentions
  notifications/ # in-app notification creation + queries (email adapter later)
  saved-views/   # personal view persistence per table
  analytics/     # aggregate queries for the analytics surface
  audit/         # append-only audit event writer + queries
```

Rules:

1. **Scoring engine is pure.** `computeScore(dimensions, modelVersion, bcReference?) → ScoreResult`. No database, no dates, no randomness. Persistence wraps it. Independently unit-tested.
2. **Every state transition goes through `workflow/`.** Direct status writes are forbidden; the module validates the transition, records it, and emits audit + notification events.
3. **Every mutation authorizes server-side** via `rbac.requirePermission()` inside the server action — never trust the client, never rely on hidden nav alone.
4. **Audit writes are append-only** and happen inside the same transaction as the mutation they record.

## Component architecture

```
src/components/
  ui/            # shadcn primitives (button, dialog, popover, …)
  shell/         # AppShell, SideNav, TopBar, CommandPalette, GlobalSearch, NotificationCenter
  data-table/    # ONE reusable DataTable system: server pagination, sort, filter bar,
                 # column visibility, grouping, saved-view binding, row detail panel
  initiative/    # InitiativeHeader, StatusBadge, ScoreBreakdown, FlagChips, LifecycleTabs
  intake/        # StepShell, autosave hook, branching step components, KPI repeater
  triage/        # TriageWorkspace (split view), RubricScorer, RationaleInput
  governance/    # RankingTable config, CompareGrid, DecisionPanel, CapacityStrip
  project/       # ProjectHeader, HealthBadge, PhaseRail, TaskList/Board/Timeline,
                 # StatusUpdateComposer, BlockerList
  analytics/     # chart wrappers with drill-down links
  shared/        # EmptyState, LoadingSkeleton, ErrorState, UserAvatar, DateText, Kbd
```

The **DataTable system is built once** and configured per surface (triage queue, portfolio ranking, projects, command center). This is where most of the "Linear-quality" interaction budget goes: keyboard row navigation (j/k, enter to open, esc to close panel), sticky header, dense rows, inline detail panel that preserves scroll/filter state.

## Repository structure

```
/
  docs/                  # this architecture package
  prisma/
    schema.prisma
    seed.ts
    migrations/
  src/
    app/                 # routes (see docs/02 §route map)
    components/          # see above
    server/              # see above
    lib/                 # utils, zod schemas, constants, formatting
  tests/                 # vitest: scoring, workflow, rbac, conversion, capacity
```

Single Next.js app — no monorepo. The platform is one product; splitting packages adds cost without benefit at this scale.
