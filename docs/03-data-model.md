# Data Model, State Machines & Permissions

Postgres via Prisma. UUID PKs, `createdAt`/`updatedAt` everywhere, FKs + indexes on all lookups, soft delete (`deletedAt`) only where history requires (users, companies, initiatives, projects, comments). Append-only tables (scores, transitions, decisions, audit) are never updated or deleted.

## Entities (Prisma models)

**Identity & reference**
- `User` — email (unique), name, title, passwordHash, isActive, deletedAt
- `Role` + `UserRole` — enum-backed roles: REQUESTER, TRIAGE, GOVERNANCE, DELIVERY, ADMIN; users may hold multiple
- `PortfolioCompany` — name, sector, admin-managed, soft delete
- `Taxonomy` / `TaxonomyItem` — admin-managed lists: functions, value levers, systems, specialist workflows, tags vocabulary

**Initiative core**
- `Initiative` — requestType (SPECIALIST_SPECIALIST | SPECIALIST_PORTCO | GENERALIST_PORTCO), name, status, portfolioCompanyId?, functionId, requesterId, currentScoreId?, governance summary fields (denormalized for table perf: latestDecision, assignment), submittedAt
- `IntakeResponse` — 1:1 with Initiative; the **immutable** requester submission (structured JSON per intake schema + typed columns for filterable fields: effortEstimate, timeToArtifactValue/Unit, onlyOneAnswer, forcingEventDate). Locked at submission; drafts editable only in Draft/Needs Information status
- `Sponsor`, `BusinessOwner` — name, title, email; FK from initiative
- `InitiativeDataSource` — system, dataType, owner, accessStatus (CONFIRMED | LIKELY | UNCONFIRMED | UNKNOWN), notes
- `InitiativeSystem` — join to systems taxonomy (+ other text)
- `InitiativeKPI` — metric, baseline?, target, noBaseline flag
- `InitiativeFlag` — flagType (enum of §23 flags), note, addedById; active/resolved
- `Tag` + `InitiativeTag`

**Workflow**
- `StatusTransition` — initiativeId, fromStatus, toStatus, actorId, note, createdAt (append-only)

**Triage & scoring**
- `TriageReview` — initiativeId, reviewerId, normalizedName, normalizedProblem, normalizedAsk, internalNotes; stored separately from intake (source stays immutable)
- `ScoringModel` / `ScoringModelVersion` — versioned weights + rubric definitions (JSON: per-dimension 1–5 rubric text), modelType (PORTFOLIO | SPECIALIST), effectiveAt, createdById. Editing config = new version, never mutation
- `InitiativeScore` — initiativeId, modelVersionId, scorerId, scoredAt, compositeScore, opportunityQuality, bcPriority?, investmentPriorityReferenceId?, isCurrent flag (append-only; re-score adds a row)
- `ScoreComponent` — scoreId, dimension, value (1–5), rationale
- `InvestmentPriorityReference` — companyId, effectiveDate, version, checkSizeScore, remainingValueScore, runwayScore, calculatedPriority (avg), adminNotes, createdById (append-only per refresh)

**Governance & capacity**
- `GovernanceReview` — session notes, initiativeId, reviewerId
- `GovernanceDecision` — initiativeId, decision (APPROVE | APPROVE_AWAITING_CAPACITY | DEFER | MORE_INFO | REJECT), decidedAt, rationale, conditions, priorityNotes, reconsiderAt?, anticipatedAssignment? (label only, non-operative); `GovernanceDecisionMaker` join (multiple deciders)
- `DeliveryAssignment` — initiativeId, lane (RAPID_DEPLOYMENT | EXTERNAL_FDE_POD | CORE_TRANSFORMATION), assignedById, assignedAt, note. **Only created via explicit human action.**
- `CapacitySetting` — lane, capacity (int), admin-editable, history via audit

**Projects & execution**
- `Project` — initiativeId (unique FK — permanent lineage), name, lane, leadId, businessOwnerId, health (GREEN | YELLOW | RED), healthNote, currentPhaseId, targetDeploymentDate, status (ACTIVE | COMPLETED | CANCELLED), startedAt
- `ProjectMember` — projectId, userId, role
- `PhaseTemplate` / `ProjectPhase` — template: Discovery → Solution Design → Data/Access → Build → QA → User Testing → Pilot → Production → Measurement → Complete; instantiated per project, admin-editable templates
- `Task` — projectId, name, ownerId, status (NOT_STARTED | IN_PROGRESS | WAITING | BLOCKED | COMPLETE | CANCELLED), dueDate, description?, priority?, phaseId?, dependencyTaskId?, blockerNote?
- `Milestone` — projectId, name, targetDate, completedAt?, phaseId?
- `ProjectUpdate` — accomplished, next, risks, decisionsNeeded, kpiUpdate, health at time of update, authorId (chronological status history)
- `Risk`, `Decision` — lightweight project registers
- `ProjectKPI` — carried from InitiativeKPI: metric, baseline, target, currentResult?, measuredAt?, methodology?, valueType (ESTIMATED | VALIDATED), category (hours/cost/revenue/margin/productivity/other)

**Collaboration & system**
- `Comment` — polymorphic (entityType + entityId), body, authorId, mentions
- `ActivityEvent` — curated feed events (submission, score, status, decision, assignment, milestone, health, KPI) — distinct from audit
- `Notification` — userId, type, entityRef, readAt?
- `SavedView` — userId, tableKey, name, config JSON (filters/sort/grouping/columns); personal V1, shared-ready (nullable teamScope)
- `AuditEvent` — append-only: actorId, action, entityType, entityId, before/after JSON, createdAt

## Initiative state machine

```
Draft → Submitted → Triage → Ready for Governance → Governance Review → decision:
  ├─ Approved—Awaiting Capacity → Approved—Scheduled → In Delivery
  ├─ Approved—Scheduled (direct, when started immediately) → In Delivery
  ├─ Deferred (reconsiderAt → back to Ready for Governance)
  ├─ Rejected (terminal)
  └─ Needs Information → (requester responds) → Triage
In Delivery → Deployed → Measuring Impact → Completed
Any pre-delivery status → Cancelled (with rationale)
Submitted → Needs Information (triage clarification)
```

Transitions are whitelisted in `server/workflow/transitions.ts`; anything else throws. Every transition writes StatusTransition + AuditEvent + ActivityEvent and fires notification rules.

## Project state machine

Project status: ACTIVE → COMPLETED | CANCELLED. Progress granularity lives in phases (linear rail, current phase marker) and health (GREEN/YELLOW/RED; YELLOW and RED require healthNote). Initiative status mirrors coarse project progress (In Delivery → Deployed → Measuring Impact → Completed) via workflow module when the project crosses Production / Measurement / Complete phases — recorded, never silent.

## Role/permission matrix (enforced in `server/rbac`)

| Capability | REQ | TRI | GOV | DEL | ADM |
|---|---|---|---|---|---|
| Create/submit initiative, edit own draft | ✓ | ✓ | ✓ | ✓ | ✓ |
| View own initiatives + external status | ✓ | ✓ | ✓ | ✓ | ✓ |
| Respond to Needs Information | ✓ (own) | — | — | — | ✓ |
| View all initiatives, internal notes | — | ✓ | ✓ | ✓ | ✓ |
| Normalize, score, flag, request info | — | ✓ | — | — | ✓ |
| View ranking, compare, inspect scores | — | ✓ | ✓ | — | ✓ |
| Record governance decision, assign lane | — | — | ✓ | — | ✓ |
| Start project (capacity-visible) | — | — | ✓ | — | ✓ |
| Manage assigned projects/tasks/health/KPIs | — | — | — | ✓ | ✓ |
| Admin: users, companies, scoring config, BC reference, capacity, taxonomies, audit | — | — | — | — | ✓ |

External visibility: requesters see a simplified status label (e.g., "In Review" spans Triage/Ready/Governance Review), never internal notes, scores, or governance rationale.
