/**
 * Pure scoring engine — no I/O, no dates, no randomness (docs/04).
 *
 * Portfolio composite (100) = operational dimensions (65) + BC priority (35).
 * Specialist composite (100) = operational dimensions only.
 *
 * The engine ranks. It NEVER computes, suggests, or defaults a delivery lane.
 */

export const DIMENSIONS = [
  "BUSINESS_IMPACT",
  "TIME_TO_ARTIFACT",
  "DATA_FEASIBILITY",
  "SPONSORSHIP",
  "STRATEGIC_FIT",
] as const;

export type Dimension = (typeof DIMENSIONS)[number];
export type DimensionScores = Record<Dimension, number>;
export type Weights = Partial<Record<Dimension | "BC_INVESTMENT_PRIORITY", number>>;

export class ScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoringError";
  }
}

/** BC Investment Priority = simple average of the three 1–5 inputs. No hidden multipliers. */
export function computeBcPriority(
  checkSize: number,
  remainingValue: number,
  runway: number,
): number {
  for (const [label, v] of [
    ["checkSize", checkSize],
    ["remainingValue", remainingValue],
    ["runway", runway],
  ] as const) {
    if (typeof v !== "number" || v < 1 || v > 5) {
      throw new ScoringError(`BC input ${label} must be between 1 and 5, got ${v}`);
    }
  }
  return Math.round(((checkSize + remainingValue + runway) / 3) * 100) / 100;
}

export type ScoreResult = {
  /** 0–100 integer */
  composite: number;
  /** 0–100 integer. For specialist models this equals composite. */
  opportunityQuality: number;
  /** 1–5, portfolio only */
  bcPriority?: number;
};

export function computeScore(input: {
  modelType: "PORTFOLIO" | "SPECIALIST";
  weights: Weights;
  dimensions: DimensionScores;
  bcPriority?: number;
}): ScoreResult {
  const { modelType, weights, dimensions, bcPriority } = input;

  // Validate dimension values
  for (const d of DIMENSIONS) {
    const v = dimensions[d];
    if (typeof v !== "number" || Number.isNaN(v) || v < 1 || v > 5) {
      throw new ScoringError(`Dimension ${d} must be between 1 and 5, got ${v}`);
    }
    if (weights[d] === undefined) {
      throw new ScoringError(`Missing weight for dimension ${d}`);
    }
  }

  const bcWeight = weights.BC_INVESTMENT_PRIORITY ?? 0;
  const operationalWeight = DIMENSIONS.reduce((sum, d) => sum + (weights[d] ?? 0), 0);

  if (modelType === "PORTFOLIO") {
    if (bcWeight <= 0) throw new ScoringError("Portfolio model requires a BC_INVESTMENT_PRIORITY weight");
    if (bcPriority === undefined) throw new ScoringError("Portfolio scoring requires bcPriority");
    if (bcPriority < 1 || bcPriority > 5) throw new ScoringError(`bcPriority must be between 1 and 5, got ${bcPriority}`);
  } else {
    if (bcWeight !== 0) throw new ScoringError("Specialist model must not have a BC_INVESTMENT_PRIORITY weight");
    if (bcPriority !== undefined) throw new ScoringError("Specialist scoring must not receive bcPriority");
  }

  if (operationalWeight + bcWeight !== 100) {
    throw new ScoringError(
      `Weights must total 100 (got ${operationalWeight + bcWeight})`,
    );
  }

  const operationalPoints = DIMENSIONS.reduce(
    (sum, d) => sum + (dimensions[d] / 5) * (weights[d] as number),
    0,
  );

  if (modelType === "PORTFOLIO") {
    const bcPoints = ((bcPriority as number) / 5) * bcWeight;
    return {
      composite: Math.round(operationalPoints + bcPoints),
      opportunityQuality: Math.round((operationalPoints / operationalWeight) * 100),
      bcPriority,
    };
  }
  const composite = Math.round(operationalPoints);
  return { composite, opportunityQuality: composite };
}
