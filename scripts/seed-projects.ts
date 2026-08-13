/** Seeds projects via the real startProject conversion + execution services. */
import { db } from "@/server/db";
import { startProject, setCurrentPhase, upsertTask, upsertMilestone, addProjectUpdate, updateProjectKpi } from "@/server/projects";

async function main() {
  const users = Object.fromEntries(
    (await db.user.findMany({ select: { id: true, email: true } })).map((u) => [u.email, u.id]),
  );
  const dan = users["dan.kowalski@build-lab.dev"];
  const sofia = users["sofia.rossi@build-lab.dev"];
  const leo = users["leo.tanaka@build-lab.dev"];
  const elena = users["elena.vasquez@build-lab.dev"];

  async function startFor(name: string, leadId: string, target: string) {
    const initiative = await db.initiative.findFirstOrThrow({ where: { name }, include: { project: true } });
    if (initiative.project) return null;
    return startProject({
      initiativeId: initiative.id,
      actorId: elena,
      leadId,
      targetDeploymentDate: new Date(target),
    });
  }

  // 1. QBR — active Rapid Deployment in Build, healthy, mid-flight
  const qbr = await startFor("Automated QBR deck generation", dan, "2026-09-30");
  if (qbr) {
    const phases = await db.projectPhase.findMany({ where: { projectId: qbr.id }, orderBy: { sortOrder: "asc" } });
    const build = phases.find((p) => p.name === "Build")!;
    await setCurrentPhase({ projectId: qbr.id, phaseId: build.id, actorId: dan });
    const dataPhase = phases.find((p) => p.name === "Data / Access")!;
    for (const [name, status, owner, due, phaseId] of [
      ["Confirm CRM API access", "COMPLETE", dan, "2026-08-05", dataPhase.id],
      ["Map usage-data schema", "COMPLETE", sofia, "2026-08-08", dataPhase.id],
      ["Deck template component library", "IN_PROGRESS", sofia, "2026-08-20", build.id],
      ["Narrative generation prompts", "IN_PROGRESS", dan, "2026-08-22", build.id],
      ["Support-data summarization", "NOT_STARTED", leo, "2026-08-27", build.id],
    ] as const) {
      await upsertTask({ projectId: qbr.id, actorId: dan, data: { name, status, ownerId: owner, dueDate: new Date(due), phaseId } });
    }
    await upsertMilestone({ projectId: qbr.id, data: { name: "First generated deck in front of an AM", targetDate: new Date("2026-08-29") } });
    await upsertMilestone({ projectId: qbr.id, data: { name: "Pilot with 5 accounts", targetDate: new Date("2026-09-12") } });
    await addProjectUpdate({
      projectId: qbr.id, authorId: dan, health: "GREEN",
      accomplished: "CRM + usage pipelines are live; first template renders end-to-end with real data.",
      next: "Narrative prompt tuning with two AMs; support-data summarization starts next week.",
      risks: "Support-data volume is larger than estimated; may need sampling.",
      kpiUpdate: "On track to measure prep time in pilot.",
    });
  }

  // 2. FP&A — active Rapid Deployment in User Testing, yellow w/ blocker
  const fpa = await startFor("FP&A variance narrative drafts", sofia, "2026-09-05");
  if (fpa) {
    const phases = await db.projectPhase.findMany({ where: { projectId: fpa.id }, orderBy: { sortOrder: "asc" } });
    const ut = phases.find((p) => p.name === "User Testing")!;
    await setCurrentPhase({ projectId: fpa.id, phaseId: ut.id, actorId: sofia });
    await upsertTask({ projectId: fpa.id, actorId: sofia, data: { name: "GL export automation", status: "COMPLETE", ownerId: sofia, dueDate: new Date("2026-08-01") } });
    await upsertTask({ projectId: fpa.id, actorId: sofia, data: { name: "Analyst review workflow", status: "COMPLETE", ownerId: leo, dueDate: new Date("2026-08-06") } });
    await upsertTask({
      projectId: fpa.id, actorId: sofia,
      data: { name: "August close dry run", status: "BLOCKED", ownerId: sofia, dueDate: new Date("2026-08-12"), blockerNote: "Waiting on Cobalt IT to whitelist the export service account." },
    });
    await upsertMilestone({ projectId: fpa.id, data: { name: "Dry run on August close", targetDate: new Date("2026-08-15") } });
    await addProjectUpdate({
      projectId: fpa.id, authorId: sofia, health: "YELLOW",
      healthNote: "Dry run blocked on Cobalt IT service-account approval — 5 days waiting.",
      accomplished: "Narrative quality sign-off from two analysts on July data.",
      next: "Run August close in parallel with manual process once access lands.",
      risks: "If access slips past Aug 18, we miss the August close window and slip a month.",
      decisionsNeeded: "Sponsor escalation to Cobalt IT if not resolved by Friday.",
    });
  }

  // 3. Support agent — FDE pod, Discovery, green
  const support = await startFor("Customer support agent for order status", leo, "2026-11-15");
  if (support) {
    await upsertTask({ projectId: support.id, actorId: leo, data: { name: "Shadow support team for a week", status: "IN_PROGRESS", ownerId: leo, dueDate: new Date("2026-08-22") } });
    await upsertTask({ projectId: support.id, actorId: leo, data: { name: "ERP order-lookup API assessment", status: "NOT_STARTED", ownerId: leo, dueDate: new Date("2026-08-29") } });
    await upsertMilestone({ projectId: support.id, data: { name: "Solution design review", targetDate: new Date("2026-09-05") } });
    await addProjectUpdate({
      projectId: support.id, authorId: leo, health: "GREEN",
      accomplished: "Kickoff with Clearwater support leadership; call-driver analysis started.",
      next: "Complete shadowing; draft conversation flows for top 5 intents.",
    });
  }

  // 4. A completed historical project: knowledge search — approve+start+complete quickly
  const ks = await db.initiative.findFirstOrThrow({ where: { name: "Knowledge search across SOPs" }, include: { project: true, governanceDecisions: true } });
  if (!ks.project) {
    const { recordDecision } = await import("@/server/governance");
    const { markReadyForGovernance } = await import("@/server/triage");
    if (ks.status === "TRIAGE") {
      await markReadyForGovernance({ initiativeId: ks.id, actorId: users["tara.chen@build-lab.dev"] });
      const r = await recordDecision({
        initiativeId: ks.id, actorId: elena,
        input: { decision: "APPROVE", lane: "RAPID_DEPLOYMENT", rationale: "Small, fast internal win; validates the rapid lane on a specialist build." },
      });
      if (!r.ok) throw new Error(r.errors.join("; "));
    }
    const proj = await startProject({ initiativeId: ks.id, actorId: elena, leadId: dan, targetDeploymentDate: new Date("2026-07-15") });
    const phases = await db.projectPhase.findMany({ where: { projectId: proj.id }, orderBy: { sortOrder: "asc" } });
    const complete = phases.find((p) => p.name === "Complete")!;
    await addProjectUpdate({
      projectId: proj.id, authorId: dan, health: "GREEN",
      accomplished: "Deployed to the whole specialist team; adoption at 80% weekly actives.",
      kpiUpdate: "Median time-to-answer measured at 40 seconds across 200 queries.",
    });
    await setCurrentPhase({ projectId: proj.id, phaseId: complete.id, actorId: dan });
    const kpi = await db.projectKPI.findFirst({ where: { projectId: proj.id } });
    if (kpi) {
      await updateProjectKpi({
        kpiId: kpi.id, actorId: dan,
        currentResult: "Median 40s to answer (was: minutes of searching)",
        valueType: "VALIDATED",
        measuredAt: new Date("2026-08-01"),
        methodology: "Instrumented search logs, 200-query sample over two weeks.",
      });
    }
    // Backdate for realism
    await db.project.update({ where: { id: proj.id }, data: { startedAt: new Date("2026-06-20"), completedAt: new Date("2026-08-01") } });
  }

  console.log("Projects seeded.");
  const counts = await db.project.groupBy({ by: ["lane", "status"], _count: true });
  console.log(counts.map((c) => `${c.lane} ${c.status}: ${c._count}`).join(" · "));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
