import type { FlagType, ScoreDimension } from "@prisma/client";

export const FLAG_LABELS: Record<FlagType, string> = {
  SENSITIVE_DATA: "Sensitive Data",
  SECURITY_REVIEW_REQUIRED: "Security Review Required",
  DATA_ACCESS_UNCONFIRMED: "Data Access Unconfirmed",
  SPONSOR_UNCONFIRMED: "Sponsor Unconfirmed",
  THIRD_PARTY_DEPENDENCY: "Third-Party Dependency",
  SIGNIFICANT_CHANGE_MANAGEMENT: "Significant Change Management",
  EXISTING_REUSABLE_SOLUTION: "Existing Reusable Solution",
  SIMILAR_REQUESTS_EXIST: "Similar Requests Exist",
  EXECUTIVE_DEADLINE: "Executive Deadline",
  MEASUREMENT_BASELINE_MISSING: "Measurement Baseline Missing",
};

export const DIMENSION_LABELS: Record<ScoreDimension, { label: string; question: string }> = {
  BUSINESS_IMPACT: {
    label: "Business Impact",
    question: "How meaningful is the potential outcome?",
  },
  TIME_TO_ARTIFACT: {
    label: "Time-to-Artifact",
    question: "How quickly can something usable and testable reach users? Higher speed = higher score.",
  },
  DATA_FEASIBILITY: {
    label: "Data Friction / Feasibility",
    question: "How accessible, usable, and tractable are the required data and systems? Lower friction = higher score.",
  },
  SPONSORSHIP: {
    label: "Sponsorship & Pull-through",
    question: "How strong is ownership, sponsorship, commitment, and likelihood of adoption?",
  },
  STRATEGIC_FIT: {
    label: "Strategic Fit / Repeatability",
    question: "How strategically relevant is this, and how much leverage could it create elsewhere?",
  },
};

export const EFFORT_LABELS: Record<string, string> = {
  SMALL: "Small",
  MEDIUM: "Medium",
  LARGE: "Large",
};

export function ttaLabel(value?: number | null, unit?: string | null): string {
  if (!value || !unit) return "—";
  return `${value} ${unit.toLowerCase()}`;
}
