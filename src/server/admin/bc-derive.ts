/**
 * Transparent derivation of BC Investment Priority inputs from fund financials.
 * Used when importing companies; admins can override per company anytime in
 * Admin → Investment Priority. The derivation is recorded in reference notes.
 *
 * - Equity Check Size score: portfolio quintile of the equity check (1–5)
 * - Remaining Value-Creation score: portfolio quintile of current value (1–5)
 * - Runway score: fund vintage (older fund = shorter runway)
 */

export function fundRunwayScore(fund: string | null | undefined): number {
  const f = (fund ?? "").toUpperCase();
  if (f.includes("XIV")) return 5;
  if (f.includes("XIII")) return 4;
  if (f.includes("XII")) return 3;
  if (f.includes("XI")) return 2;
  return 3;
}

/** 1–5 by position among portfolio peers (quintiles of the sorted values). */
export function quintileScore(value: number, peerValues: number[]): number {
  const sorted = [...peerValues].sort((a, b) => a - b);
  if (sorted.length === 0) return 3;
  const below = sorted.filter((v) => v < value).length;
  const pct = below / sorted.length;
  return Math.min(5, Math.floor(pct * 5) + 1);
}

export function deriveBcInputs(params: {
  equityCheckUsd: number;
  valueUsd: number;
  fundNumber: string | null | undefined;
  peerChecks: number[];
  peerValues: number[];
}) {
  return {
    checkSizeScore: quintileScore(params.equityCheckUsd, params.peerChecks),
    remainingValueScore: quintileScore(params.valueUsd, params.peerValues),
    runwayScore: fundRunwayScore(params.fundNumber),
  };
}

export const DERIVATION_NOTE =
  "Auto-derived from fund financials: check-size and remaining-value scores are portfolio quintiles of equity check / current value; runway score from fund vintage. Override anytime with a new version.";
