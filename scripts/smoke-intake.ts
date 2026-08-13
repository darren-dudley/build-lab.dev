/** Smoke test of intake service against the live dev DB. Cleans up after itself. */
import { createDraft, saveDraft, submitInitiative, loadDraftData } from "@/server/intake";
import { db } from "@/server/db";

async function main() {
  const requester = await db.user.findUniqueOrThrow({ where: { email: "maya.johnson@build-lab.dev" } });
  const company = await db.portfolioCompany.findFirstOrThrow({ where: { name: "Meridian Logistics" } });
  const fn = await db.taxonomyItem.findFirstOrThrow({ where: { kind: "FUNCTION", label: "Sales" } });

  // 1. Create draft
  const draft = await createDraft(requester.id, "SPECIALIST_PORTCO");
  console.log("draft created:", draft.status === "DRAFT" ? "OK" : "FAIL");

  // 2. Incomplete submit must fail with missing list
  let res = await submitInitiative(draft.id, requester.id);
  console.log("incomplete submit blocked:", !res.ok && res.missing.length > 5 ? "OK" : "FAIL");

  // 3. Autosave in two partial passes (simulates debounced saves)
  await saveDraft(draft.id, requester.id, {
    name: "SMOKE TEST — QBR automation",
    portfolioCompanyId: company.id,
    functionId: fn.id,
    sponsorName: "Jane Sponsor",
    businessProblem: "Manual QBR prep takes 6 hours per account.",
    currentProcess: "AEs assemble decks by hand from CRM exports.",
  });
  await saveDraft(draft.id, requester.id, {
    aiTask: "Generate first-pass QBR decks from CRM + usage data.",
    successDefinition: "80% of QBR decks start from a generated draft.",
    effortEstimate: "MEDIUM",
    timeToArtifactValue: 3,
    timeToArtifactUnit: "WEEKS",
    onlyOneAnswer: "YES",
    outcomeOwnerName: "VP Sales",
    kpis: [{ metric: "Hours per QBR", baseline: "6", target: "1.5", noBaseline: false }],
    dataSources: [{ system: "Salesforce", dataType: "CRM records", owner: null, accessStatus: "LIKELY", notes: null }],
  });
  const loaded = await loadDraftData(draft.id);
  console.log("autosave roundtrip:", loaded.name?.includes("QBR") && loaded.kpis?.length === 1 ? "OK" : "FAIL");

  // 4. Complete submit succeeds
  res = await submitInitiative(draft.id, requester.id);
  console.log("submit:", res.ok ? "OK" : `FAIL ${JSON.stringify(res)}`);

  const after = await db.initiative.findUniqueOrThrow({
    where: { id: draft.id },
    include: { intakeResponse: true, statusTransitions: true },
  });
  console.log("status SUBMITTED:", after.status === "SUBMITTED" ? "OK" : "FAIL");
  console.log("submittedAt set:", after.submittedAt ? "OK" : "FAIL");
  console.log("intake locked:", after.intakeResponse?.lockedAt ? "OK" : "FAIL");
  console.log("transition recorded:", after.statusTransitions.length === 1 ? "OK" : "FAIL");

  // 5. Editing after submission must be rejected
  let blocked = false;
  try {
    await saveDraft(draft.id, requester.id, { name: "tamper" });
  } catch {
    blocked = true;
  }
  console.log("post-submit edit blocked:", blocked ? "OK" : "FAIL");

  // 6. Wrong-user access must be rejected
  const other = await db.user.findUniqueOrThrow({ where: { email: "sam.patel@build-lab.dev" } });
  const draft2 = await createDraft(requester.id, "SPECIALIST_SPECIALIST");
  let blocked2 = false;
  try {
    await saveDraft(draft2.id, other.id, { name: "not mine" });
  } catch {
    blocked2 = true;
  }
  console.log("cross-user edit blocked:", blocked2 ? "OK" : "FAIL");

  // Cleanup
  for (const id of [draft.id, draft2.id]) {
    await db.statusTransition.deleteMany({ where: { initiativeId: id } });
    await db.activityEvent.deleteMany({ where: { initiativeId: id } });
    await db.auditEvent.deleteMany({ where: { entityId: id } });
    await db.initiativeKPI.deleteMany({ where: { initiativeId: id } });
    await db.initiativeDataSource.deleteMany({ where: { initiativeId: id } });
    await db.initiativeSystem.deleteMany({ where: { initiativeId: id } });
    await db.sponsor.deleteMany({ where: { initiativeId: id } });
    await db.intakeResponse.deleteMany({ where: { initiativeId: id } });
    await db.initiative.delete({ where: { id } });
  }
  console.log("cleanup: done");
}

main().finally(() => db.$disconnect());
