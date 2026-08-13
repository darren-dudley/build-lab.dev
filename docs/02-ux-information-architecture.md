# Information Architecture, Routes & User Journeys

## Navigation (persistent left nav)

```
Home
Intake
  Submit Initiative
Initiatives
  All Initiatives
  My Initiatives
Triage
  Triage Queue
Governance
  Governance Queue
  Portfolio Ranking
Delivery
  Rapid Deployment
  External FDE Pod
  Core Transformation
  Awaiting Capacity
Projects
  All Projects
Analytics
Admin
  Users · Portfolio Companies · Scoring · Investment Priority · Capacity · Taxonomies · Settings
```

Nav sections render only for roles with access (server-derived), but **every route also enforces authorization server-side** — hiding nav is UX, not security. Global search (`/` focus, `⌘K` command palette) searches initiatives, companies, requesters, sponsors, projects, tags, and descriptive text.

## Route map

| Route | Purpose | Roles |
|---|---|---|
| `/` | Public blank page (product decision) | public |
| `/login` | Credential sign-in | public |
| `/home` | Role-aware home | all authenticated |
| `/intake/new` · `/intake/[draftId]` | Multi-step branching intake with autosave | Requester+ |
| `/initiatives` | All initiatives table | Triage, Governance, Delivery, Admin |
| `/initiatives/mine` | Requester's submissions | all |
| `/initiatives/[id]` | Initiative detail (tabs: Overview, Intake, Triage, Scoring, Governance, Activity, [Project]) | varies by tab |
| `/triage` | Triage queue | Triage, Admin |
| `/triage/[id]` | Triage workspace (submission left, scoring right) | Triage, Admin |
| `/governance` | Governance queue (decision-ready view) | Governance, Admin |
| `/governance/ranking` | Portfolio ranking table | Governance, Admin |
| `/governance/compare?ids=` | 2–5 initiative comparison | Governance, Admin |
| `/delivery/rapid-deployment` | Command center | Delivery, Governance, Admin |
| `/delivery/fde-pod` · `/delivery/core-transformation` | Lane views (V1: lighter tables) | Delivery, Governance, Admin |
| `/delivery/awaiting-capacity` | Approved, unstarted queue | Delivery, Governance, Admin |
| `/projects` · `/projects/[id]` | Project list + overview (tabs: Overview, Tasks, Timeline, Updates, KPIs, Activity) | Delivery+, sponsors read |
| `/analytics` | Portfolio analytics with drill-down | Governance, Admin, leadership |
| `/notifications` | Notification center | all |
| `/admin/*` | users, companies, scoring, investment-priority, capacity, taxonomies, settings, audit | Admin |

## Primary user journeys

**1. Requester submits (target 5–7 min).** Login → Home shows "Submit Initiative" → picks request type → form branches → autosaved every step → review → submit → confirmation with visible status + what happens next → tracks at My Initiatives → answers "Needs Information" requests via comment thread on their initiative.

**2. Triage processes.** Triage Queue (default view: unscored, oldest first) → `j/k` through rows, detail panel preview → open Triage Workspace → reads submission (immutable, left) → normalizes name/summary, sets flags, scores 5 dimensions against inline rubric with rationale (right) → BC Investment Priority auto-joins from reference table (portfolio requests) → marks Ready for Governance, or requests clarification (→ Needs Information).

**3. Governance decides.** Portfolio Ranking (default: score desc) → filters/groups (by function for wave-spotting) → selects 3 for Compare → discussion in comments → Decision Panel: Approve (+ explicit human lane assignment, capacity strip visible), Approve–Awaiting Capacity, Defer (+ reconsideration date), More Info, Reject (+ rationale) → decision recorded with makers, rationale, conditions.

**4. Delivery executes.** Approved initiative → "Start Project" (human action, capacity visible) → project created from template (Rapid Deployment phases) → lead manages tasks inline (list/board/timeline) → weekly status update (Accomplished / Next / Risks / Decisions Needed / KPI update) + health with required explanation for Yellow/Red → blockers surface to command center + home.

**5. Leadership reviews.** Home answers the seven §7 questions via stat row (each drills into a filtered view) + Needs Attention / Blockers / Recently Deployed sections → Command Center manages by exception → Analytics answers "what value was created" with estimated vs. validated always distinguished.

## UX design pass (§55)

Every major screen gets a design block (user goal, primary action, hierarchy, decision context, progressive disclosure, exception/empty/loading/error states) written as a comment header in its page component **before** implementation. The interface reflects workflows, not tables.

## Intake schema (branching)

Step 0 **Request type** → drives all branching. Steps: 1 Requester & Routing (identity prefilled; +company, sponsor, function for portfolio types; specialist workflow for type A) → 2 Business Problem (problem, how it works today, who/what affected multi-select + explanation) → 3 The Ask (AI task w/ helper example, 90-day success, KPI repeater w/ "no baseline" option, value levers [portfolio] or workflow-change [specialist], effort S/M/L with plain-language explanations) → 4 Feasibility (data sources repeater — system/type/owner/access/notes, all "Unknown"-friendly; systems multi-select; prior attempts + reusability; **Time-to-Artifact** estimate with definition helper) → 5 Prioritization Signal (only-one-this-quarter Y/N/Unsure + why; forcing event date/event/consequence; outcome owner; final context) → 6 Review & Submit.

Autosave: debounced per-field to draft record; step completion markers; resumable from My Initiatives. Draft = Initiative in `Draft` status (no separate draft entity).
