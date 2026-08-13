import { FlagType, InitiativeStatus } from "@prisma/client";
import { db } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { transitionInitiative } from "@/server/workflow";

/** Triage queue: everything awaiting or in triage, plus needs-info items. */
export async function getTriageQueue() {
  return db.initiative.findMany({
    where: {
      deletedAt: null,
      status: {
        in: [
          InitiativeStatus.SUBMITTED,
          InitiativeStatus.TRIAGE,
          InitiativeStatus.NEEDS_INFORMATION,
        ],
      },
    },
    orderBy: { submittedAt: "asc" },
    include: {
      portfolioCompany: { select: { name: true } },
      function: { select: { label: true } },
      requester: { select: { name: true } },
      intakeResponse: {
        select: { timeToArtifactValue: true, timeToArtifactUnit: true, effortEstimate: true },
      },
      flags: { where: { resolvedAt: null } },
      scores: { where: { isCurrent: true }, take: 1 },
      triageReview: { select: { reviewerId: true } },
    },
  });
}

/** Normalization is stored on TriageReview — the intake record stays immutable. */
export async function saveTriageReview(params: {
  initiativeId: string;
  reviewerId: string;
  normalizedName?: string | null;
  normalizedProblem?: string | null;
  normalizedAsk?: string | null;
  internalNotes?: string | null;
}) {
  const { initiativeId, reviewerId, ...fields } = params;
  await db.$transaction(async (tx) => {
    const initiative = await tx.initiative.findUniqueOrThrow({
      where: { id: initiativeId, deletedAt: null },
      select: { status: true },
    });
    if (initiative.status === InitiativeStatus.SUBMITTED) {
      await transitionInitiative(
        { initiativeId, to: InitiativeStatus.TRIAGE, actorId: reviewerId },
        tx,
      );
    }
    await tx.triageReview.upsert({
      where: { initiativeId },
      update: { ...fields, reviewerId },
      create: { initiativeId, reviewerId, ...fields },
    });
    await writeAudit(tx, {
      actorId: reviewerId,
      action: "triage.review",
      entityType: "INITIATIVE",
      entityId: initiativeId,
      after: fields,
    });
  });
}

export async function setFlag(params: {
  initiativeId: string;
  flagType: FlagType;
  note?: string;
  actorId: string;
  active: boolean;
}) {
  const { initiativeId, flagType, note, actorId, active } = params;
  await db.$transaction(async (tx) => {
    if (active) {
      await tx.initiativeFlag.upsert({
        where: { initiativeId_flagType: { initiativeId, flagType } },
        update: { note: note ?? null, resolvedAt: null, addedById: actorId },
        create: { initiativeId, flagType, note: note ?? null, addedById: actorId },
      });
    } else {
      await tx.initiativeFlag.updateMany({
        where: { initiativeId, flagType },
        data: { resolvedAt: new Date() },
      });
    }
    await writeAudit(tx, {
      actorId,
      action: active ? "flag.set" : "flag.resolve",
      entityType: "INITIATIVE",
      entityId: initiativeId,
      after: { flagType, note: note ?? null },
    });
  });
}

/** Sends the initiative back to the requester for clarification. */
export async function requestInformation(params: {
  initiativeId: string;
  actorId: string;
  message: string;
}) {
  await db.$transaction(async (tx) => {
    await transitionInitiative(
      {
        initiativeId: params.initiativeId,
        to: InitiativeStatus.NEEDS_INFORMATION,
        actorId: params.actorId,
        note: params.message,
      },
      tx,
    );
    await tx.comment.create({
      data: {
        entityType: "INITIATIVE",
        entityId: params.initiativeId,
        authorId: params.actorId,
        body: `Information requested: ${params.message}`,
      },
    });
    const initiative = await tx.initiative.findUniqueOrThrow({
      where: { id: params.initiativeId },
      select: { requesterId: true, name: true },
    });
    if (initiative.requesterId) {
      await tx.notification.create({
        data: {
          userId: initiative.requesterId,
          type: "more_info_requested",
          title: `More information needed: ${initiative.name}`,
          body: params.message,
          entityType: "INITIATIVE",
          entityId: params.initiativeId,
        },
      });
    }
  });
}

/** Marks triage complete. Requires a current score — governance ranks on it. */
export async function markReadyForGovernance(params: {
  initiativeId: string;
  actorId: string;
}) {
  const score = await db.initiativeScore.findFirst({
    where: { initiativeId: params.initiativeId, isCurrent: true },
  });
  if (!score) {
    throw new Error("Score the initiative before marking it ready for governance");
  }
  await transitionInitiative({
    initiativeId: params.initiativeId,
    to: InitiativeStatus.READY_FOR_GOVERNANCE,
    actorId: params.actorId,
  });
}
