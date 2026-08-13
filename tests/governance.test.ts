import { describe, expect, it } from "vitest";
import { validateDecision, DECISION_TARGET_STATUS } from "@/server/governance/decision-rules";

describe("governance decision rules", () => {
  it("APPROVE requires an explicit human lane", () => {
    expect(validateDecision({ decision: "APPROVE" })).toContainEqual(
      expect.stringContaining("explicit delivery-lane"),
    );
    expect(validateDecision({ decision: "APPROVE", lane: "RAPID_DEPLOYMENT" })).toHaveLength(0);
  });

  it("a lane can never accompany any other decision (no auto/side-channel assignment)", () => {
    for (const decision of ["APPROVE_AWAITING_CAPACITY", "DEFER", "MORE_INFORMATION", "REJECT"] as const) {
      const errors = validateDecision({ decision, lane: "CORE_TRANSFORMATION", rationale: "r" });
      expect(errors.some((e) => e.includes("only accompany an Approve")), decision).toBe(true);
    }
  });

  it("anticipated lane is a label restricted to awaiting-capacity", () => {
    expect(
      validateDecision({ decision: "APPROVE_AWAITING_CAPACITY", anticipatedLane: "EXTERNAL_FDE_POD" }),
    ).toHaveLength(0);
    expect(
      validateDecision({ decision: "REJECT", rationale: "r", anticipatedLane: "EXTERNAL_FDE_POD" }),
    ).toContainEqual(expect.stringContaining("Anticipated lane"));
  });

  it("reject and defer require rationale", () => {
    expect(validateDecision({ decision: "REJECT" })).toContainEqual(
      expect.stringContaining("requires a rationale"),
    );
    expect(validateDecision({ decision: "DEFER", rationale: "  " })).toContainEqual(
      expect.stringContaining("requires a rationale"),
    );
    expect(validateDecision({ decision: "DEFER", rationale: "Revisit next quarter" })).toHaveLength(0);
  });

  it("reconsideration date only applies to defer", () => {
    expect(
      validateDecision({ decision: "APPROVE", lane: "RAPID_DEPLOYMENT", reconsiderAt: new Date() }),
    ).toContainEqual(expect.stringContaining("reconsideration date"));
  });

  it("decision → status mapping never skips awaiting-capacity into delivery", () => {
    expect(DECISION_TARGET_STATUS.APPROVE).toBe("APPROVED_SCHEDULED");
    expect(DECISION_TARGET_STATUS.APPROVE_AWAITING_CAPACITY).toBe("APPROVED_AWAITING_CAPACITY");
    // No decision maps directly to IN_DELIVERY — starting a project is a separate human act.
    expect(Object.values(DECISION_TARGET_STATUS)).not.toContain("IN_DELIVERY");
  });
});
