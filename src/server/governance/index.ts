import { InitiativeStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { transitionInitiative } from "@/server/workflow";
import {
  DECISION_TARGET_STATUS,
  validateDecision,
  type DecisionInput,
} from "./decision-rules";

export { validateDecision } from "./decision-rules";

/** Initiatives awaiting a governance decision. */
export async function getGovernanceQueue() {
  return db.initiative.findMany({
    where: {
      deletedAt: null,
      status: { in: [InitiativeStatus.READY_FOR_GOVERNANCE, InitiativeStatus.GOVERNANCE_REVIEW] },
    },
    orderBy: [{ submittedAt: "asc" }],
    include: rankingInclude,
  });
}

const rankingInclude = {
  portfolioCompany: { select: { name: true } },
  function: { select: { label: true } },
  sponsor: { select: { name: true, title: true } },
  intakeResponse: {
    select: {
      timeToArtifactValue: true, timeToArtifactUnit: true, effortEstimate: true,
      budgetRange: true, forcingEvent: true, forcingEventDate: true,
    },
  },
  triageReview: { select: { normalizedProblem: true, normalizedAsk: true } },
  flags: { where: { resolvedAt: null } },
  scores: {
    where: { isCurrent: true },
    take: 1,
    include: { components: true, modelVersion: { select: { version: true } } },
  },
  governanceDecisions: { where: { isCurrent: true }, take: 1 },
  deliveryAssignment: true,
} satisfies Prisma.InitiativeInclude;

/** Every scored initiative — the ranked portfolio. */
export async function getRankedPortfolio() {
  const rows = await db.initiative.findMany({
    where: { deletedAt: null, scores: { some: { isCurrent: true } } },
    include: rankingInclude,
  });
  return rows.sort(
    (a, b) => (b.scores[0]?.compositeScore ?? 0) - (a.scores[0]?.compositeScore ?? 0),
  );
}

export type RankedInitiative = Awaited<ReturnType<typeof getRankedPortfolio>>[number];

/**
 * Records an explicit human governance decision. Validates via pure rules,
 * chains the READY → GOVERNANCE_REVIEW transition when needed, creates the
 * DeliveryAssignment ONLY for APPROVE, and never starts execution.
 */
export async function recordDecision(params: {
  initiativeId: string;
  actorId: string;
  makerIds?: string[];
  input: DecisionInput & { conditions?: string; priorityNotes?: string; infoMessage?: string };
}) {
  const { initiativeId, actorId, input } = params;
  const errors = validateDecision(input);
  if (errors.length > 0) return { ok: false as const, errors };

  const makerIds = [...new Set([actorId, ...(params.makerIds ?? [])])];

  await db.$transaction(async (tx) => {
    const initiative = await tx.initiative.findUniqueOrThrow({
      where: { id: initiativeId, deletedAt: null },
      select: { id: true, status: true, name: true },
    });

    if (initiative.status === InitiativeStatus.READY_FOR_GOVERNANCE) {
      await transitionInitiative(
        { initiativeId, to: InitiativeStatus.GOVERNANCE_REVIEW, actorId },
        tx,
      );
    }

    await tx.governanceDecision.updateMany({
      where: { initiativeId, isCurrent: true },
      data: { isCurrent: false },
    });
    const decision = await tx.governanceDecision.create({
      data: {
        initiativeId,
        decision: input.decision,
        rationale: input.rationale ?? null,
        conditions: input.conditions ?? null,
        priorityNotes: input.priorityNotes ?? null,
        reconsiderAt: input.reconsiderAt ?? null,
        anticipatedLane: input.anticipatedLane ?? null,
        makers: { create: makerIds.map((userId) => ({ userId })) },
      },
    });

    if (input.decision === "APPROVE") {
      // The ONLY place a DeliveryAssignment is created — always by a human.
      await tx.deliveryAssignment.upsert({
        where: { initiativeId },
        update: { lane: input.lane!, assignedById: actorId, assignedAt: new Date() },
        create: { initiativeId, lane: input.lane!, assignedById: actorId },
      });
    }

    await transitionInitiative(
      {
        initiativeId,
        to: DECISION_TARGET_STATUS[input.decision] as InitiativeStatus,
        actorId,
        note: input.decision === "MORE_INFORMATION" ? input.infoMessage : input.rationale ?? undefined,
      },
      tx,
    );

    await writeAudit(tx, {
      actorId,
      action: "governance.decide",
      entityType: "INITIATIVE",
      entityId: initiativeId,
      after: {
        decision: input.decision,
        lane: input.lane ?? null,
        anticipatedLane: input.anticipatedLane ?? null,
        rationale: input.rationale ?? null,
        makers: makerIds,
      },
    });
    await tx.activityEvent.create({
      data: {
        initiativeId,
        actorId,
        eventType: "governance_decision",
        summary: `Governance decision: ${input.decision.replaceAll("_", " ").toLowerCase()}${input.lane ? ` → ${input.lane.replaceAll("_", " ").toLowerCase()}` : ""}`,
      },
    });

    return decision;
  });

  return { ok: true as const };
}

/** Capacity by lane: configured limit vs. count of active projects. */
export async function getCapacity() {
  const [settings, activeCounts] = await Promise.all([
    db.capacitySetting.findMany(),
    db.project.groupBy({
      by: ["lane"],
      where: { status: "ACTIVE", deletedAt: null },
      _count: true,
    }),
  ]);
  return settings.map((s) => ({
    lane: s.lane,
    capacity: s.capacity,
    active: activeCounts.find((a) => a.lane === s.lane)?._count ?? 0,
  }));
}
