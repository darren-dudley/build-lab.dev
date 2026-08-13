/** Seeds governance decisions via the real service. Idempotent by decision presence. */
import { db } from "@/server/db";
import { recordDecision } from "@/server/governance";

const DECISIONS = [
  {
    name: "Automated QBR deck generation",
    input: { decision: "APPROVE", lane: "RAPID_DEPLOYMENT", rationale: "Highest composite in portfolio; fast artifact; strong sponsor pull. Classic rapid-deployment shape." },
  },
  {
    name: "FP&A variance narrative drafts",
    input: { decision: "APPROVE", lane: "RAPID_DEPLOYMENT", rationale: "Small, fast, high-frequency workflow with clean data access." },
  },
  {
    name: "Customer support agent for order status",
    input: { decision: "APPROVE", lane: "EXTERNAL_FDE_POD", rationale: "High impact but integration-heavy (ERP + carrier APIs); needs dedicated FDE attention.", conditions: "Carrier API contract must be countersigned before build starts." },
  },
  {
    name: "Contract review acceleration",
    input: { decision: "APPROVE_AWAITING_CAPACITY", anticipatedLane: "CORE_TRANSFORMATION", rationale: "Worth doing; security review and legal change management make it a larger engagement than current capacity allows." },
  },
  {
    name: "Churn-risk identification for key accounts",
    input: { decision: "DEFER", rationale: "Data access unconfirmed and no measurement baseline; revisit once billing export ownership is resolved.", reconsiderAt: new Date("2026-11-01") },
  },
  {
    name: "Marketing content localization pipeline",
    input: { decision: "REJECT", rationale: "CMO has selected an off-the-shelf localization tool; duplicate spend." },
  },
] as const;

async function main() {
  const elena = await db.user.findUniqueOrThrow({ where: { email: "elena.vasquez@build-lab.dev" } });
  const james = await db.user.findUniqueOrThrow({ where: { email: "james.okafor@build-lab.dev" } });

  let recorded = 0;
  for (const d of DECISIONS) {
    const initiative = await db.initiative.findFirst({
      where: { name: d.name },
      include: { governanceDecisions: { where: { isCurrent: true } } },
    });
    if (!initiative) { console.warn(`missing: ${d.name}`); continue; }
    if (initiative.governanceDecisions.length > 0) continue;

    const result = await recordDecision({
      initiativeId: initiative.id,
      actorId: elena.id,
      makerIds: [james.id],
      input: { ...d.input, reconsiderAt: "reconsiderAt" in d.input ? d.input.reconsiderAt : null },
    });
    if (!result.ok) throw new Error(`${d.name}: ${result.errors.join("; ")}`);
    recorded++;
  }
  console.log(`Recorded ${recorded} governance decisions.`);

  // Invariant checks
  const assignments = await db.deliveryAssignment.findMany({ include: { assignedBy: true } });
  const allHuman = assignments.every((a) => a.assignedById);
  console.log("all assignments have a human assigner:", allHuman ? "OK" : "FAIL");
  const awaiting = await db.initiative.count({ where: { status: "APPROVED_AWAITING_CAPACITY", deliveryAssignment: { isNot: null } } });
  console.log("awaiting-capacity has no assignment:", awaiting === 0 ? "OK" : "FAIL");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
