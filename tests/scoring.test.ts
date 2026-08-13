import { describe, expect, it } from "vitest";
import { computeBcPriority, computeScore, ScoringError } from "@/server/scoring/engine";

const PORTFOLIO_WEIGHTS = {
  BUSINESS_IMPACT: 17,
  TIME_TO_ARTIFACT: 17,
  DATA_FEASIBILITY: 13,
  SPONSORSHIP: 9,
  STRATEGIC_FIT: 9,
  BC_INVESTMENT_PRIORITY: 35,
};

const SPECIALIST_WEIGHTS = {
  BUSINESS_IMPACT: 27,
  TIME_TO_ARTIFACT: 27,
  DATA_FEASIBILITY: 20,
  SPONSORSHIP: 13,
  STRATEGIC_FIT: 13,
};

const dims = (v: number) => ({
  BUSINESS_IMPACT: v,
  TIME_TO_ARTIFACT: v,
  DATA_FEASIBILITY: v,
  SPONSORSHIP: v,
  STRATEGIC_FIT: v,
});

describe("computeBcPriority", () => {
  it("is the simple average of the three inputs", () => {
    expect(computeBcPriority(5, 4, 4)).toBeCloseTo(4.33, 2);
    expect(computeBcPriority(3, 3, 3)).toBe(3);
    expect(computeBcPriority(5, 5, 5)).toBe(5);
  });
  it("rejects out-of-range inputs", () => {
    expect(() => computeBcPriority(0, 3, 3)).toThrow(ScoringError);
    expect(() => computeBcPriority(3, 6, 3)).toThrow(ScoringError);
  });
});

describe("portfolio composite", () => {
  it("perfect scores → 100", () => {
    const r = computeScore({ modelType: "PORTFOLIO", weights: PORTFOLIO_WEIGHTS, dimensions: dims(5), bcPriority: 5 });
    expect(r.composite).toBe(100);
    expect(r.opportunityQuality).toBe(100);
  });
  it("floor scores → 20 (1/5 of every weight)", () => {
    const r = computeScore({ modelType: "PORTFOLIO", weights: PORTFOLIO_WEIGHTS, dimensions: dims(1), bcPriority: 1 });
    expect(r.composite).toBe(20);
    expect(r.opportunityQuality).toBe(20);
  });
  it("splits 65 opportunity / 35 BC exactly", () => {
    // All operational 5s, worst BC: 65 + 7 = 72
    const r = computeScore({ modelType: "PORTFOLIO", weights: PORTFOLIO_WEIGHTS, dimensions: dims(5), bcPriority: 1 });
    expect(r.composite).toBe(72);
    expect(r.opportunityQuality).toBe(100);
    // All operational 1s, best BC: 13 + 35 = 48
    const r2 = computeScore({ modelType: "PORTFOLIO", weights: PORTFOLIO_WEIGHTS, dimensions: dims(1), bcPriority: 5 });
    expect(r2.composite).toBe(48);
    expect(r2.opportunityQuality).toBe(20);
  });
  it("matches a hand-computed mixed example", () => {
    // BI 4×3.4 + TTA 4×3.4 + DF 3×2.6 + SP 5×1.8 + SF 4×1.8 = 13.6+13.6+7.8+9+7.2 = 51.2
    // BC 4.33 → 4.33/5×35 = 30.31 → total 81.51 → 82
    const r = computeScore({
      modelType: "PORTFOLIO",
      weights: PORTFOLIO_WEIGHTS,
      dimensions: { BUSINESS_IMPACT: 4, TIME_TO_ARTIFACT: 4, DATA_FEASIBILITY: 3, SPONSORSHIP: 5, STRATEGIC_FIT: 4 },
      bcPriority: 4.33,
    });
    expect(r.composite).toBe(82);
    // OQ = 51.2/65×100 = 78.77 → 79
    expect(r.opportunityQuality).toBe(79);
    expect(r.bcPriority).toBe(4.33);
  });
  it("requires bcPriority", () => {
    expect(() =>
      computeScore({ modelType: "PORTFOLIO", weights: PORTFOLIO_WEIGHTS, dimensions: dims(3) }),
    ).toThrow(/requires bcPriority/);
  });
});

describe("specialist composite", () => {
  it("perfect → 100, floor → 20, OQ equals composite", () => {
    const hi = computeScore({ modelType: "SPECIALIST", weights: SPECIALIST_WEIGHTS, dimensions: dims(5) });
    expect(hi.composite).toBe(100);
    expect(hi.opportunityQuality).toBe(100);
    expect(hi.bcPriority).toBeUndefined();
    const lo = computeScore({ modelType: "SPECIALIST", weights: SPECIALIST_WEIGHTS, dimensions: dims(1) });
    expect(lo.composite).toBe(20);
  });
  it("mixed example", () => {
    // 27×0.8 + 27×0.6 + 20×1 + 13×0.4 + 13×0.6 = 21.6+16.2+20+5.2+7.8 = 70.8 → 71
    const r = computeScore({
      modelType: "SPECIALIST",
      weights: SPECIALIST_WEIGHTS,
      dimensions: { BUSINESS_IMPACT: 4, TIME_TO_ARTIFACT: 3, DATA_FEASIBILITY: 5, SPONSORSHIP: 2, STRATEGIC_FIT: 3 },
    });
    expect(r.composite).toBe(71);
  });
  it("rejects BC input entirely", () => {
    expect(() =>
      computeScore({ modelType: "SPECIALIST", weights: SPECIALIST_WEIGHTS, dimensions: dims(3), bcPriority: 3 }),
    ).toThrow(/must not receive bcPriority/);
    expect(() =>
      computeScore({
        modelType: "SPECIALIST",
        weights: { ...SPECIALIST_WEIGHTS, BC_INVESTMENT_PRIORITY: 10 },
        dimensions: dims(3),
      }),
    ).toThrow(/must not have/);
  });
});

describe("validation", () => {
  it("rejects out-of-range dimensions", () => {
    expect(() =>
      computeScore({ modelType: "SPECIALIST", weights: SPECIALIST_WEIGHTS, dimensions: { ...dims(3), BUSINESS_IMPACT: 0 } }),
    ).toThrow(ScoringError);
    expect(() =>
      computeScore({ modelType: "SPECIALIST", weights: SPECIALIST_WEIGHTS, dimensions: { ...dims(3), STRATEGIC_FIT: 5.5 } }),
    ).toThrow(ScoringError);
  });
  it("rejects weights that do not total 100", () => {
    expect(() =>
      computeScore({
        modelType: "SPECIALIST",
        weights: { ...SPECIALIST_WEIGHTS, BUSINESS_IMPACT: 30 },
        dimensions: dims(3),
      }),
    ).toThrow(/total 100/);
  });
});
