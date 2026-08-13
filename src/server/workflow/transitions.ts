import { InitiativeStatus } from "@prisma/client";

const S = InitiativeStatus;

/**
 * The initiative state machine (docs/03). Any transition not listed here
 * throws — there is no other way to change an initiative's status.
 */
export const ALLOWED_TRANSITIONS: Record<InitiativeStatus, InitiativeStatus[]> = {
  [S.DRAFT]: [S.SUBMITTED, S.CANCELLED],
  [S.SUBMITTED]: [S.TRIAGE, S.NEEDS_INFORMATION, S.CANCELLED],
  [S.NEEDS_INFORMATION]: [S.SUBMITTED, S.TRIAGE, S.CANCELLED],
  [S.TRIAGE]: [S.READY_FOR_GOVERNANCE, S.NEEDS_INFORMATION, S.CANCELLED],
  [S.READY_FOR_GOVERNANCE]: [S.GOVERNANCE_REVIEW, S.TRIAGE, S.CANCELLED],
  [S.GOVERNANCE_REVIEW]: [
    S.APPROVED_AWAITING_CAPACITY,
    S.APPROVED_SCHEDULED,
    S.DEFERRED,
    S.REJECTED,
    S.NEEDS_INFORMATION,
    S.READY_FOR_GOVERNANCE,
    S.CANCELLED,
  ],
  [S.APPROVED_AWAITING_CAPACITY]: [S.APPROVED_SCHEDULED, S.DEFERRED, S.CANCELLED],
  [S.APPROVED_SCHEDULED]: [S.IN_DELIVERY, S.APPROVED_AWAITING_CAPACITY, S.CANCELLED],
  [S.IN_DELIVERY]: [S.DEPLOYED, S.CANCELLED],
  [S.DEPLOYED]: [S.MEASURING_IMPACT, S.COMPLETED],
  [S.MEASURING_IMPACT]: [S.COMPLETED],
  [S.COMPLETED]: [],
  [S.DEFERRED]: [S.READY_FOR_GOVERNANCE, S.REJECTED, S.CANCELLED],
  [S.REJECTED]: [],
  [S.CANCELLED]: [],
};

export function canTransition(from: InitiativeStatus, to: InitiativeStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * External (requester-facing) status labels. Requesters never see internal
 * pipeline detail — several internal statuses collapse into one label.
 */
export function externalStatusLabel(status: InitiativeStatus): string {
  switch (status) {
    case S.DRAFT:
      return "Draft";
    case S.SUBMITTED:
      return "Submitted";
    case S.NEEDS_INFORMATION:
      return "Needs Information";
    case S.TRIAGE:
    case S.READY_FOR_GOVERNANCE:
    case S.GOVERNANCE_REVIEW:
      return "In Review";
    case S.APPROVED_AWAITING_CAPACITY:
    case S.APPROVED_SCHEDULED:
      return "Approved";
    case S.IN_DELIVERY:
      return "In Delivery";
    case S.DEPLOYED:
      return "Deployed";
    case S.MEASURING_IMPACT:
      return "Measuring Impact";
    case S.COMPLETED:
      return "Completed";
    case S.DEFERRED:
      return "Deferred";
    case S.REJECTED:
      return "Not Pursued";
    case S.CANCELLED:
      return "Cancelled";
  }
}

/** Internal display labels. */
export function statusLabel(status: InitiativeStatus): string {
  const labels: Record<InitiativeStatus, string> = {
    [S.DRAFT]: "Draft",
    [S.SUBMITTED]: "Submitted",
    [S.NEEDS_INFORMATION]: "Needs Information",
    [S.TRIAGE]: "Triage",
    [S.READY_FOR_GOVERNANCE]: "Ready for Governance",
    [S.GOVERNANCE_REVIEW]: "Governance Review",
    [S.APPROVED_AWAITING_CAPACITY]: "Approved — Awaiting Capacity",
    [S.APPROVED_SCHEDULED]: "Approved — Scheduled",
    [S.IN_DELIVERY]: "In Delivery",
    [S.DEPLOYED]: "Deployed",
    [S.MEASURING_IMPACT]: "Measuring Impact",
    [S.COMPLETED]: "Completed",
    [S.DEFERRED]: "Deferred",
    [S.REJECTED]: "Rejected",
    [S.CANCELLED]: "Cancelled",
  };
  return labels[status];
}
