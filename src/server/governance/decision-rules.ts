import type { DeliveryLane, GovernanceDecisionType } from "@prisma/client";

/**
 * Pure governance decision rules (docs/04). The software NEVER computes or
 * suggests a delivery lane — `lane` is only ever a human's explicit choice,
 * and it is REQUIRED exactly when the decision is APPROVE.
 */
export type DecisionInput = {
  decision: GovernanceDecisionType;
  rationale?: string | null;
  /** Human-chosen lane. Required for APPROVE. Forbidden otherwise. */
  lane?: DeliveryLane | null;
  /** Optional non-operative label for APPROVE_AWAITING_CAPACITY. */
  anticipatedLane?: DeliveryLane | null;
  reconsiderAt?: Date | null;
};

export function validateDecision(input: DecisionInput): string[] {
  const errors: string[] = [];
  const { decision, rationale, lane, anticipatedLane, reconsiderAt } = input;

  if (decision === "APPROVE") {
    if (!lane) errors.push("Approval requires an explicit delivery-lane assignment");
  } else if (lane) {
    errors.push("A delivery lane can only accompany an Approve decision");
  }

  if (decision !== "APPROVE_AWAITING_CAPACITY" && anticipatedLane) {
    errors.push("Anticipated lane only applies to Approve — Awaiting Capacity");
  }

  if ((decision === "REJECT" || decision === "DEFER") && !rationale?.trim()) {
    errors.push(`${decision === "REJECT" ? "Rejection" : "Deferral"} requires a rationale`);
  }

  if (reconsiderAt && decision !== "DEFER") {
    errors.push("A reconsideration date only applies to Defer");
  }

  return errors;
}

/** Status each decision maps to — used by the service after validation. */
export const DECISION_TARGET_STATUS = {
  APPROVE: "APPROVED_SCHEDULED",
  APPROVE_AWAITING_CAPACITY: "APPROVED_AWAITING_CAPACITY",
  DEFER: "DEFERRED",
  MORE_INFORMATION: "NEEDS_INFORMATION",
  REJECT: "REJECTED",
} as const;
