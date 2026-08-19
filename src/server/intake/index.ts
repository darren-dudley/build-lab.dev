import { InitiativeStatus, Prisma, RequestType } from "@prisma/client";
import { db } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { transitionInitiative } from "@/server/workflow";
import { AuthorizationError } from "@/server/rbac";
import { validateSubmission, type DraftData } from "@/lib/intake-schema";

/** Statuses in which the requester may edit intake content. */
const EDITABLE: InitiativeStatus[] = [InitiativeStatus.DRAFT, InitiativeStatus.NEEDS_INFORMATION];

/** requesterId null = public (unauthenticated) submission. */
export async function createDraft(requesterId: string | null, requestType: RequestType) {
  const initiative = await db.$transaction(async (tx) => {
    const created = await tx.initiative.create({
      data: {
        requestType,
        name: "Untitled initiative",
        requesterId,
        intakeResponse: { create: {} },
      },
    });
    await writeAudit(tx, {
      actorId: requesterId,
      action: "initiative.createDraft",
      entityType: "INITIATIVE",
      entityId: created.id,
      after: { requestType },
    });
    return created;
  });
  return initiative;
}

/**
 * Edit access: an authenticated owner, or — for public submissions
 * (requesterId null) — possession of the unguessable draft link.
 */
async function getOwnedEditable(initiativeId: string, userId: string | null) {
  const initiative = await db.initiative.findUnique({
    where: { id: initiativeId, deletedAt: null },
    include: { intakeResponse: true },
  });
  // Public path (userId null) may only touch anonymous drafts; the
  // authenticated path may only touch the caller's own initiative. Neither
  // may cross into the other's records.
  const ok =
    userId === null
      ? initiative?.requesterId == null
      : initiative?.requesterId === userId;
  if (!initiative || !ok) {
    throw new AuthorizationError("Not your initiative");
  }
  if (!EDITABLE.includes(initiative.status)) {
    throw new AuthorizationError("This initiative is no longer editable");
  }
  return initiative;
}

/**
 * Autosave: persists a partial draft. Repeating groups (KPIs, data sources,
 * systems) are replaced wholesale when present in the payload.
 */
export async function saveDraft(initiativeId: string, userId: string | null, data: DraftData) {
  const existing = await getOwnedEditable(initiativeId, userId);

  await db.$transaction(async (tx) => {
    // Initiative-level fields
    const initiativeData: Prisma.InitiativeUpdateInput = {};
    if (data.name !== undefined) initiativeData.name = data.name || "Untitled initiative";
    // Requester contact is only writable on public submissions
    if (existing.requesterId == null) {
      if (data.requesterName !== undefined) initiativeData.requesterName = data.requesterName;
      if (data.requesterEmail !== undefined) initiativeData.requesterEmail = data.requesterEmail;
    }
    if (data.portfolioCompanyId !== undefined) {
      initiativeData.portfolioCompany = data.portfolioCompanyId
        ? { connect: { id: data.portfolioCompanyId } }
        : { disconnect: true };
    }
    if (data.functionId !== undefined) {
      initiativeData.function = data.functionId
        ? { connect: { id: data.functionId } }
        : { disconnect: true };
    }
    if (Object.keys(initiativeData).length > 0) {
      await tx.initiative.update({ where: { id: initiativeId }, data: initiativeData });
    }

    // Sponsor
    if (data.sponsorName !== undefined) {
      if (data.sponsorName) {
        await tx.sponsor.upsert({
          where: { initiativeId },
          update: { name: data.sponsorName, title: data.sponsorTitle ?? null, email: data.sponsorEmail ?? null },
          create: { initiativeId, name: data.sponsorName, title: data.sponsorTitle ?? null, email: data.sponsorEmail ?? null },
        });
      } else {
        await tx.sponsor.deleteMany({ where: { initiativeId } });
      }
    }

    // Intake response columns
    const ir: Prisma.IntakeResponseUpdateInput = {};
    const map: [keyof DraftData, keyof Prisma.IntakeResponseUpdateInput][] = [
      ["businessProblem", "businessProblem"],
      ["currentProcess", "currentProcess"],
      ["aiTask", "aiTask"],
      ["successDefinition", "successDefinition"],
      ["effortEstimate", "effortEstimate"],
      ["priorAttempts", "priorAttempts"],
      ["priorAttemptsDetail", "priorAttemptsDetail"],
      ["timeToArtifactValue", "timeToArtifactValue"],
      ["timeToArtifactUnit", "timeToArtifactUnit"],
      ["budgetRange", "budgetRange"],
      ["onlyOneAnswer", "onlyOneAnswer"],
      ["onlyOneWhy", "onlyOneWhy"],
      ["forcingEvent", "forcingEvent"],
      ["forcingConsequence", "forcingConsequence"],
      ["outcomeOwnerName", "outcomeOwnerName"],
      ["outcomeOwnerTitle", "outcomeOwnerTitle"],
      ["finalContext", "finalContext"],
      ["specialistWorkflow", "specialistWorkflow"],
    ];
    for (const [from, to] of map) {
      if (data[from] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ir as any)[to] = data[from];
      }
    }
    if (data.noBaselineExists !== undefined) ir.noBaselineExists = data.noBaselineExists;
    if (data.affected !== undefined) ir.affected = (data.affected ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    if (data.valueCreation !== undefined) ir.valueCreation = (data.valueCreation ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    if (data.stepProgress !== undefined) ir.stepProgress = data.stepProgress as Prisma.InputJsonValue;
    if (data.forcingEventDate !== undefined) {
      ir.forcingEventDate = data.forcingEventDate ? new Date(data.forcingEventDate) : null;
    }
    if (Object.keys(ir).length > 0) {
      await tx.intakeResponse.update({ where: { initiativeId }, data: ir });
    }

    // Repeating groups — replace wholesale when present
    if (data.kpis !== undefined) {
      await tx.initiativeKPI.deleteMany({ where: { initiativeId } });
      if (data.kpis.length > 0) {
        await tx.initiativeKPI.createMany({
          data: data.kpis.map((k) => ({
            initiativeId,
            metric: k.metric,
            baseline: k.baseline ?? null,
            target: k.target ?? null,
            noBaseline: k.noBaseline ?? false,
          })),
        });
      }
    }
    if (data.dataSources !== undefined) {
      await tx.initiativeDataSource.deleteMany({ where: { initiativeId } });
      if (data.dataSources.length > 0) {
        await tx.initiativeDataSource.createMany({
          data: data.dataSources.map((s) => ({
            initiativeId,
            system: s.system,
            dataType: s.dataType ?? null,
            owner: s.owner ?? null,
            accessStatus: s.accessStatus,
            notes: s.notes ?? null,
          })),
        });
      }
    }
    if (data.systems !== undefined) {
      await tx.initiativeSystem.deleteMany({ where: { initiativeId } });
      if (data.systems.length > 0) {
        await tx.initiativeSystem.createMany({
          data: data.systems.map((s) =>
            s.startsWith("other:")
              ? { initiativeId, otherLabel: s.slice(6) }
              : { initiativeId, systemId: s },
          ),
        });
      }
    }
  });
}

/** Validates completeness, locks the intake record, and submits. */
export async function submitInitiative(initiativeId: string, userId: string | null) {
  const initiative = await getOwnedEditable(initiativeId, userId);
  const draft = await loadDraftData(initiativeId);
  const missing = validateSubmission(initiative.requestType, draft, {
    anonymous: initiative.requesterId == null,
  });
  if (missing.length > 0) return { ok: false as const, missing };

  await db.$transaction(async (tx) => {
    await tx.intakeResponse.update({
      where: { initiativeId },
      data: { lockedAt: new Date() },
    });
    await transitionInitiative(
      { initiativeId, to: InitiativeStatus.SUBMITTED, actorId: userId },
      tx,
    );
    await tx.activityEvent.create({
      data: {
        initiativeId,
        actorId: userId,
        eventType: "submission",
        summary: "Initiative submitted",
      },
    });
  });
  return { ok: true as const };
}

/** Loads draft state in the DraftData shape the form consumes. */
export async function loadDraftData(initiativeId: string): Promise<DraftData> {
  const i = await db.initiative.findUniqueOrThrow({
    where: { id: initiativeId },
    include: {
      intakeResponse: true,
      sponsor: true,
      kpis: true,
      dataSources: true,
      systems: true,
    },
  });
  const r = i.intakeResponse;
  return {
    requesterName: i.requesterName,
    requesterEmail: i.requesterEmail,
    name: i.name === "Untitled initiative" ? "" : i.name,
    portfolioCompanyId: i.portfolioCompanyId,
    functionId: i.functionId,
    specialistWorkflow: r?.specialistWorkflow ?? null,
    sponsorName: i.sponsor?.name ?? null,
    sponsorTitle: i.sponsor?.title ?? null,
    sponsorEmail: i.sponsor?.email ?? null,
    businessProblem: r?.businessProblem ?? null,
    currentProcess: r?.currentProcess ?? null,
    affected: (r?.affected as DraftData["affected"]) ?? null,
    aiTask: r?.aiTask ?? null,
    successDefinition: r?.successDefinition ?? null,
    kpis: i.kpis.map((k) => ({
      metric: k.metric,
      baseline: k.baseline,
      target: k.target,
      noBaseline: k.noBaseline,
    })),
    noBaselineExists: (r?.noBaselineExists ?? false) || i.kpis.some((k) => k.noBaseline),
    valueCreation: (r?.valueCreation as DraftData["valueCreation"]) ?? null,
    effortEstimate: r?.effortEstimate ?? null,
    dataSources: i.dataSources.map((s) => ({
      system: s.system,
      dataType: s.dataType,
      owner: s.owner,
      accessStatus: s.accessStatus,
      notes: s.notes,
    })),
    systems: i.systems.map((s) => (s.systemId ? s.systemId : `other:${s.otherLabel ?? ""}`)),
    priorAttempts: (r?.priorAttempts as DraftData["priorAttempts"]) ?? null,
    priorAttemptsDetail: r?.priorAttemptsDetail ?? null,
    timeToArtifactValue: r?.timeToArtifactValue ?? null,
    timeToArtifactUnit: (r?.timeToArtifactUnit as DraftData["timeToArtifactUnit"]) ?? null,
    budgetRange: (r?.budgetRange as DraftData["budgetRange"]) ?? null,
    onlyOneAnswer: (r?.onlyOneAnswer as DraftData["onlyOneAnswer"]) ?? null,
    onlyOneWhy: r?.onlyOneWhy ?? null,
    forcingEventDate: r?.forcingEventDate?.toISOString().slice(0, 10) ?? null,
    forcingEvent: r?.forcingEvent ?? null,
    forcingConsequence: r?.forcingConsequence ?? null,
    outcomeOwnerName: r?.outcomeOwnerName ?? null,
    outcomeOwnerTitle: r?.outcomeOwnerTitle ?? null,
    finalContext: r?.finalContext ?? null,
    stepProgress: (r?.stepProgress as Record<string, boolean>) ?? {},
  };
}
