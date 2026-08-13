import { InitiativeStatus, Prisma, ScoringModelType, type ScoreDimension } from "@prisma/client";
import { db } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { transitionInitiative } from "@/server/workflow";
import { computeScore, type DimensionScores, type Weights } from "./engine";

export { computeBcPriority, computeScore, DIMENSIONS, ScoringError } from "./engine";
export type { Dimension, DimensionScores, ScoreResult, Weights } from "./engine";

export function modelTypeFor(requestType: string): ScoringModelType {
  return requestType === "SPECIALIST_SPECIALIST"
    ? ScoringModelType.SPECIALIST
    : ScoringModelType.PORTFOLIO;
}

export async function getCurrentModelVersion(modelType: ScoringModelType) {
  const version = await db.scoringModelVersion.findFirst({
    where: { model: { modelType } },
    orderBy: { version: "desc" },
  });
  if (!version) throw new Error(`No scoring model version for ${modelType}`);
  return version;
}

/** Latest BC reference row for a company — the version joined at scoring time. */
export async function getCurrentInvestmentReference(companyId: string) {
  return db.investmentPriorityReference.findFirst({
    where: { companyId },
    orderBy: [{ effectiveDate: "desc" }, { version: "desc" }],
  });
}

export type ComponentInput = {
  dimension: ScoreDimension;
  value: number;
  rationale?: string;
};

/**
 * Persists a new score (append-only): previous scores keep their rows and
 * model/reference versions; only the isCurrent flag moves. Auto-advances
 * SUBMITTED → TRIAGE, since scoring is a triage act.
 */
export async function scoreInitiative(params: {
  initiativeId: string;
  scorerId: string;
  components: ComponentInput[];
}) {
  const initiative = await db.initiative.findUniqueOrThrow({
    where: { id: params.initiativeId, deletedAt: null },
    select: { id: true, status: true, requestType: true, portfolioCompanyId: true },
  });

  const modelType = modelTypeFor(initiative.requestType);
  const version = await getCurrentModelVersion(modelType);
  const weights = version.weights as Weights;

  const dimensions = Object.fromEntries(
    params.components.map((c) => [c.dimension, c.value]),
  ) as DimensionScores;

  let bcPriority: number | undefined;
  let referenceId: string | undefined;
  if (modelType === ScoringModelType.PORTFOLIO) {
    if (!initiative.portfolioCompanyId) {
      throw new Error("Portfolio-model initiative has no portfolio company");
    }
    const ref = await getCurrentInvestmentReference(initiative.portfolioCompanyId);
    if (!ref) {
      throw new Error(
        "No BC Investment Priority reference data for this company — an administrator must add it before scoring",
      );
    }
    bcPriority = ref.calculatedPriority;
    referenceId = ref.id;
  }

  const result = computeScore({ modelType, weights, dimensions, bcPriority });

  const score = await db.$transaction(async (tx) => {
    if (initiative.status === InitiativeStatus.SUBMITTED) {
      await transitionInitiative(
        { initiativeId: initiative.id, to: InitiativeStatus.TRIAGE, actorId: params.scorerId },
        tx,
      );
    }
    await tx.initiativeScore.updateMany({
      where: { initiativeId: initiative.id, isCurrent: true },
      data: { isCurrent: false },
    });
    const created = await tx.initiativeScore.create({
      data: {
        initiativeId: initiative.id,
        modelVersionId: version.id,
        scorerId: params.scorerId,
        compositeScore: result.composite,
        opportunityQuality: result.opportunityQuality,
        bcPriority: result.bcPriority ?? null,
        investmentPriorityReferenceId: referenceId ?? null,
        components: {
          create: params.components.map((c) => ({
            dimension: c.dimension,
            value: c.value,
            rationale: c.rationale ?? null,
          })),
        },
      },
      include: { components: true },
    });
    await writeAudit(tx, {
      actorId: params.scorerId,
      action: "score.create",
      entityType: "INITIATIVE",
      entityId: initiative.id,
      after: {
        composite: result.composite,
        opportunityQuality: result.opportunityQuality,
        bcPriority: result.bcPriority ?? null,
        modelVersionId: version.id,
        referenceId: referenceId ?? null,
      } as Prisma.InputJsonValue,
    });
    await tx.activityEvent.create({
      data: {
        initiativeId: initiative.id,
        actorId: params.scorerId,
        eventType: "score_change",
        summary: `Scored ${result.composite}/100 (model v${version.version})`,
      },
    });
    return created;
  });

  return { score, result };
}
