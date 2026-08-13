/** Smoke test: public (unauthenticated) intake flow. Cleans up after itself. */
import { createDraft, saveDraft, submitInitiative } from "@/server/intake";
import { db } from "@/server/db";

async function main() {
  const fn = await db.taxonomyItem.findFirstOrThrow({ where: { kind: "FUNCTION", label: "Finance" } });
  const company = await db.portfolioCompany.findFirstOrThrow({ where: { name: "Clearwater Foods" } });

  // Anonymous draft
  const draft = await createDraft(null, "GENERALIST_PORTCO");
  console.log("anonymous draft:", draft.requesterId === null ? "OK" : "FAIL");

  // Fill everything EXCEPT requester identity
  await saveDraft(draft.id, null, {
    name: "PUBLIC SMOKE — variance analysis",
    portfolioCompanyId: company.id,
    functionId: fn.id,
    sponsorName: "Sam Sponsor",
    businessProblem: "Monthly variance narratives take 3 days.",
    currentProcess: "Analysts build them by hand in Excel.",
    aiTask: "Draft variance narratives from GL exports.",
    successDefinition: "Narratives drafted in under an hour.",
    effortEstimate: "SMALL",
    timeToArtifactValue: 2,
    timeToArtifactUnit: "WEEKS",
    onlyOneAnswer: "UNSURE",
    outcomeOwnerName: "CFO",
    kpis: [{ metric: "Days to close narrative", baseline: "3", target: "0.5", noBaseline: false }],
  });

  // Submit without identity must fail, listing name + email
  let res = await submitInitiative(draft.id, null);
  console.log(
    "identity required:",
    !res.ok && res.missing.some((m) => m.includes("name")) && res.missing.some((m) => m.includes("email"))
      ? "OK"
      : `FAIL ${JSON.stringify(res)}`,
  );

  // Provide identity → submit succeeds
  await saveDraft(draft.id, null, { requesterName: "Pat Public", requesterEmail: "pat@example.com" });
  res = await submitInitiative(draft.id, null);
  console.log("public submit:", res.ok ? "OK" : `FAIL ${JSON.stringify(res)}`);

  const after = await db.initiative.findUniqueOrThrow({
    where: { id: draft.id },
    include: { statusTransitions: true },
  });
  console.log("status SUBMITTED:", after.status === "SUBMITTED" ? "OK" : "FAIL");
  console.log("contact stored:", after.requesterName === "Pat Public" && after.requesterEmail === "pat@example.com" ? "OK" : "FAIL");
  console.log("transition actor null:", after.statusTransitions[0]?.actorId === null ? "OK" : "FAIL");

  // Post-submit public edit must be blocked
  let blocked = false;
  try {
    await saveDraft(draft.id, null, { name: "tamper" });
  } catch {
    blocked = true;
  }
  console.log("post-submit edit blocked:", blocked ? "OK" : "FAIL");

  // Cleanup
  await db.statusTransition.deleteMany({ where: { initiativeId: draft.id } });
  await db.activityEvent.deleteMany({ where: { initiativeId: draft.id } });
  await db.auditEvent.deleteMany({ where: { entityId: draft.id } });
  await db.initiativeKPI.deleteMany({ where: { initiativeId: draft.id } });
  await db.sponsor.deleteMany({ where: { initiativeId: draft.id } });
  await db.intakeResponse.deleteMany({ where: { initiativeId: draft.id } });
  await db.initiative.delete({ where: { id: draft.id } });
  console.log("cleanup: done");
}

main().finally(() => db.$disconnect());
