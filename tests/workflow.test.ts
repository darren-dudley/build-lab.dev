import { describe, expect, it } from "vitest";
import { InitiativeStatus } from "@prisma/client";
import { ALLOWED_TRANSITIONS, canTransition, externalStatusLabel } from "@/server/workflow/transitions";
import { hasPermission } from "@/server/rbac/permissions";
import { RoleType } from "@prisma/client";

const S = InitiativeStatus;

describe("initiative state machine", () => {
  it("covers every status", () => {
    for (const s of Object.values(S)) {
      expect(ALLOWED_TRANSITIONS[s]).toBeDefined();
    }
  });
  it("allows the happy path", () => {
    const path: InitiativeStatus[] = [
      S.DRAFT, S.SUBMITTED, S.TRIAGE, S.READY_FOR_GOVERNANCE, S.GOVERNANCE_REVIEW,
      S.APPROVED_SCHEDULED, S.IN_DELIVERY, S.DEPLOYED, S.MEASURING_IMPACT, S.COMPLETED,
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1]), `${path[i]} → ${path[i + 1]}`).toBe(true);
    }
  });
  it("blocks illegal jumps", () => {
    expect(canTransition(S.DRAFT, S.IN_DELIVERY)).toBe(false);
    expect(canTransition(S.SUBMITTED, S.APPROVED_SCHEDULED)).toBe(false);
    expect(canTransition(S.REJECTED, S.TRIAGE)).toBe(false);
    expect(canTransition(S.COMPLETED, S.IN_DELIVERY)).toBe(false);
    expect(canTransition(S.DRAFT, S.DRAFT)).toBe(false);
  });
  it("terminal states have no exits (except deferred reconsideration)", () => {
    expect(ALLOWED_TRANSITIONS[S.COMPLETED]).toHaveLength(0);
    expect(ALLOWED_TRANSITIONS[S.REJECTED]).toHaveLength(0);
    expect(ALLOWED_TRANSITIONS[S.CANCELLED]).toHaveLength(0);
    expect(ALLOWED_TRANSITIONS[S.DEFERRED]).toContain(S.READY_FOR_GOVERNANCE);
  });
  it("collapses internal pipeline statuses for requesters", () => {
    expect(externalStatusLabel(S.TRIAGE)).toBe("In Review");
    expect(externalStatusLabel(S.READY_FOR_GOVERNANCE)).toBe("In Review");
    expect(externalStatusLabel(S.GOVERNANCE_REVIEW)).toBe("In Review");
    expect(externalStatusLabel(S.REJECTED)).toBe("Not Pursued");
  });
});

describe("rbac matrix", () => {
  const R = RoleType;
  it("requesters cannot see internal surfaces", () => {
    expect(hasPermission([R.REQUESTER], "initiative.viewAll")).toBe(false);
    expect(hasPermission([R.REQUESTER], "triage.score")).toBe(false);
    expect(hasPermission([R.REQUESTER], "governance.decide")).toBe(false);
    expect(hasPermission([R.REQUESTER], "admin.users")).toBe(false);
  });
  it("triage can score but not decide", () => {
    expect(hasPermission([R.TRIAGE], "triage.score")).toBe(true);
    expect(hasPermission([R.TRIAGE], "governance.decide")).toBe(false);
    expect(hasPermission([R.TRIAGE], "governance.viewRanking")).toBe(true);
  });
  it("only governance and admin can decide or assign lanes", () => {
    for (const role of [R.REQUESTER, R.TRIAGE, R.DELIVERY]) {
      expect(hasPermission([role], "governance.assignLane")).toBe(false);
      expect(hasPermission([role], "project.start")).toBe(false);
    }
    expect(hasPermission([R.GOVERNANCE], "governance.assignLane")).toBe(true);
    expect(hasPermission([R.ADMIN], "governance.assignLane")).toBe(true);
  });
  it("roles are additive", () => {
    expect(hasPermission([R.REQUESTER, R.TRIAGE], "triage.score")).toBe(true);
    expect(hasPermission([], "initiative.create")).toBe(false);
  });
});
