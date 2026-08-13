# Scoring Engine & Governance Workflow Specification

## Principles

1. **Data informs. Scoring creates consistency. Humans decide.**
2. The engine is a pure, deterministic, independently tested TypeScript module.
3. Configuration (weights, rubrics) is data, not code — stored in `ScoringModelVersion`.
4. Historical scores are immutable. Config changes create new versions; re-scoring adds new score rows referencing the new version while retaining the old.
5. The engine never outputs, suggests, or defaults a delivery lane.

## Models

### Portfolio model (requests involving a portfolio company)

Composite = 100 points = **65 Opportunity Quality + 35 BC Investment Priority**.

| Dimension | Weight (pts) |
|---|---|
| Business Impact | 17 |
| Time-to-Artifact | 17 |
| Data Friction / Feasibility | 13 |
| Sponsorship & Pull-through | 9 |
| Strategic Fit / Repeatability | 9 |
| BC Investment Priority | 35 |

### Specialist model (Specialist → Specialist Build)

No BC component. Composite = 100 points.

| Dimension | Weight (pts) |
|---|---|
| Business Impact | 27 |
| Time-to-Artifact | 27 |
| Data Friction / Feasibility | 20 |
| Sponsorship & Pull-through | 13 |
| Strategic Fit / Repeatability | 13 |

Score type is **always labeled** (`Portfolio Priority Score` vs `Specialist Priority Score`) — same views may contain both, but the badge/type column never disappears, and the UI copy never implies cross-type economic equivalence.

## Calculation

Each dimension scored 1–5 by triage with required short rationale.

```
dimensionPoints(d)   = (value_d / 5) × weight_d
opportunityQuality   = round( Σ operational dimensionPoints / 65 × 100 )   // portfolio
                     = composite                                            // specialist (identity)
bcPriority           = (checkSize + remainingValue + runway) / 3            // 1–5, simple average, no hidden multipliers
composite (portfolio)= round( Σ operational dimensionPoints + (bcPriority / 5) × 35 )
composite (specialist)= round( Σ dimensionPoints )
```

Display (portfolio): **Portfolio Priority Score 87/100** → Opportunity Quality 82/100 → BC Investment Priority 4.6/5 → per-dimension breakdown with rubric + rationale. Fully inspectable: the score detail view shows the arithmetic, the model version, the scorer, the date, and the BC reference version.

Rounding: half-up to integer for composite/OQ; BC priority displayed to 1 decimal.

## Rubrics

Each dimension has a 1–5 rubric stored as text in the model version (JSON). **Seed rubrics are placeholders marked `DRAFT — pending official rubric`** (the real rubric arrives later per spec §20) and are admin-editable without code changes. Rubric text renders inline in the triage scorer via popover — reviewers never memorize.

## BC Investment Priority reference data

Admin-maintained, refreshed ~quarterly. Per company per refresh: checkSizeScore, remainingValueScore, runwayScore (1–5 each), effectiveDate, version, notes. Scoring joins the reference row **current at scoring time** and stores its ID on the score — the reference version used is permanently retained. Requesters never see or supply BC data.

## Score versioning rules

- `InitiativeScore` rows are append-only; the latest carries `isCurrent`.
- Admin "Re-score with current model" (later V1.x): creates new score rows for selected active initiatives; history preserved and viewable ("Scored 82 on model v2 · previously 78 on v1").
- Weight or rubric edits create a new `ScoringModelVersion`; existing scores keep pointing at the version that produced them.

## Governance workflow

Inputs surfaced per initiative (glanceable in the queue, expandable to full evidence): identity (name, company/specialist, function), concise problem + proposed AI task (triage-normalized), scores (composite, OQ, BC, dimensions), Time-to-Artifact, requester effort estimate, key flags, sponsor, forcing event, current decision state.

Decisions (explicit, recorded, auditable):

| Decision | Required | Effect |
|---|---|---|
| **Approve** | human lane assignment (RD / FDE / Core) | status → Approved—Scheduled; project may be started |
| **Approve — Awaiting Capacity** | — (optional anticipated-lane label, non-operative) | status → Approved—Awaiting Capacity |
| **Defer** | rationale; optional reconsiderAt | status → Deferred; reminder at reconsideration date |
| **More Information Required** | what's needed | status → Needs Information; requester/triage notified |
| **Reject** | rationale (required) | status → Rejected |

Recorded: decision, date, maker(s), rationale, assignment, conditions, priority notes.

**Hard invariants (unit-tested):** no code path creates a `DeliveryAssignment` without a human actor ID from a governance-permitted role; no "recommended lane" is computed anywhere; capacity changes never auto-start work — starting a project is always a human action taken with the capacity strip visible (lane Active n / Capacity m, admin-configurable limits). Capacity full does not block approval — it routes to Awaiting Capacity, keeping scoring undistorted.
