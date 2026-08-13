import { z } from "zod";

/** Shared intake schemas + copy. Used by the form (client) and actions (server). */

export const REQUEST_TYPES = [
  {
    value: "SPECIALIST_SPECIALIST",
    label: "Specialist — Specialist Build",
    description:
      "An internal Specialist requests an AI capability for a Specialist workflow.",
  },
  {
    value: "SPECIALIST_PORTCO",
    label: "Specialist — Portfolio Company Build",
    description:
      "An internal Specialist submits or sponsors an AI opportunity involving a portfolio company.",
  },
  {
    value: "GENERALIST_PORTCO",
    label: "Generalist — Portfolio Company Build",
    description:
      "An internal Generalist submits or sponsors an AI opportunity involving a portfolio company.",
  },
] as const;

export type RequestTypeValue = (typeof REQUEST_TYPES)[number]["value"];

export function isPortfolioType(t: RequestTypeValue | string): boolean {
  return t === "SPECIALIST_PORTCO" || t === "GENERALIST_PORTCO";
}

export const AFFECTED_OPTIONS = [
  "Individual", "Team", "Function", "Company", "Customers",
  "Revenue", "Margin", "Cost", "Productivity", "Risk", "Strategic KPI", "Other",
] as const;

export const VALUE_LEVER_OPTIONS = [
  "Revenue", "Cost", "Margin", "Productivity", "Customer Experience",
  "Quality", "Risk", "Speed", "Strategic Capability", "Other",
] as const;

export const EFFORT_OPTIONS = [
  { value: "SMALL", label: "Small", description: "Days of work — a focused tool or automation touching one workflow." },
  { value: "MEDIUM", label: "Medium", description: "Weeks of work — multiple data sources or a workflow used by a team." },
  { value: "LARGE", label: "Large", description: "Months of work — cross-functional change, significant integration, or high stakes." },
] as const;

export const PRIOR_ATTEMPT_OPTIONS = [
  { value: "NO", label: "No" },
  { value: "INTERNAL", label: "Internally" },
  { value: "VENDOR", label: "Vendor" },
  { value: "CONSULTANT", label: "Consultant / Agency" },
  { value: "MULTIPLE", label: "Multiple approaches" },
  { value: "UNKNOWN", label: "Unknown" },
] as const;

export const ACCESS_STATUS_OPTIONS = [
  { value: "CONFIRMED", label: "Access confirmed" },
  { value: "LIKELY", label: "Likely accessible" },
  { value: "UNCONFIRMED", label: "Unconfirmed" },
  { value: "UNKNOWN", label: "Unknown" },
] as const;

export const TTA_HELPER =
  "By artifact, we mean something sufficiently functional that a real user can interact with it or evaluate its usefulness.";

export const AI_TASK_HELPER =
  'Describe the task itself, not just "use AI." Example: "Create first-pass QBR decks using CRM, customer usage, and support data."';

const kpiSchema = z.object({
  metric: z.string().min(1),
  baseline: z.string().optional().nullable(),
  target: z.string().optional().nullable(),
  noBaseline: z.boolean().default(false),
});

const dataSourceSchema = z.object({
  system: z.string().min(1),
  dataType: z.string().optional().nullable(),
  owner: z.string().optional().nullable(),
  accessStatus: z.enum(["CONFIRMED", "LIKELY", "UNCONFIRMED", "UNKNOWN"]).default("UNKNOWN"),
  notes: z.string().optional().nullable(),
});

/** Everything optional — autosave accepts partial state at any time. */
export const draftDataSchema = z.object({
  name: z.string().max(200).optional(),
  portfolioCompanyId: z.string().uuid().optional().nullable(),
  functionId: z.string().uuid().optional().nullable(),
  specialistWorkflow: z.string().optional().nullable(),
  sponsorName: z.string().optional().nullable(),
  sponsorTitle: z.string().optional().nullable(),
  sponsorEmail: z.string().optional().nullable(),
  businessProblem: z.string().optional().nullable(),
  currentProcess: z.string().optional().nullable(),
  affected: z.object({ selections: z.array(z.string()), explanation: z.string().optional() }).optional().nullable(),
  aiTask: z.string().optional().nullable(),
  successDefinition: z.string().optional().nullable(),
  kpis: z.array(kpiSchema).optional(),
  noBaselineExists: z.boolean().optional(),
  valueCreation: z.object({ levers: z.array(z.string()), explanation: z.string().optional() }).optional().nullable(),
  effortEstimate: z.enum(["SMALL", "MEDIUM", "LARGE"]).optional().nullable(),
  dataSources: z.array(dataSourceSchema).optional(),
  systems: z.array(z.string()).optional(), // taxonomy IDs or "other:<label>"
  priorAttempts: z.enum(["NO", "INTERNAL", "VENDOR", "CONSULTANT", "MULTIPLE", "UNKNOWN"]).optional().nullable(),
  priorAttemptsDetail: z.string().optional().nullable(),
  timeToArtifactValue: z.number().int().positive().optional().nullable(),
  timeToArtifactUnit: z.enum(["DAYS", "WEEKS", "MONTHS"]).optional().nullable(),
  onlyOneAnswer: z.enum(["YES", "NO", "UNSURE"]).optional().nullable(),
  onlyOneWhy: z.string().optional().nullable(),
  forcingEventDate: z.string().optional().nullable(), // ISO date
  forcingEvent: z.string().optional().nullable(),
  forcingConsequence: z.string().optional().nullable(),
  outcomeOwnerName: z.string().optional().nullable(),
  outcomeOwnerTitle: z.string().optional().nullable(),
  finalContext: z.string().optional().nullable(),
  stepProgress: z.record(z.string(), z.boolean()).optional(),
});

export type DraftData = z.infer<typeof draftDataSchema>;

/** Branching submission requirements — what must exist before submit. */
export function validateSubmission(requestType: string, d: DraftData): string[] {
  const missing: string[] = [];
  const need = (cond: unknown, label: string) => {
    if (!cond) missing.push(label);
  };

  need(d.name?.trim(), "Initiative name");
  need(d.businessProblem?.trim(), "Business problem");
  need(d.currentProcess?.trim(), "How this works today");
  need(d.aiTask?.trim(), "What you want AI to do");
  need(d.successDefinition?.trim(), "What success looks like in 90 days");
  need(d.effortEstimate, "Effort estimate");
  need(d.timeToArtifactValue && d.timeToArtifactUnit, "Time-to-Artifact estimate");
  need(d.onlyOneAnswer, "Only-initiative-this-quarter answer");
  need(d.outcomeOwnerName?.trim(), "Business outcome owner");

  if (isPortfolioType(requestType)) {
    need(d.portfolioCompanyId, "Portfolio company");
    need(d.functionId, "Function");
    need(d.sponsorName?.trim(), "Internal sponsor");
  } else {
    need(d.specialistWorkflow?.trim(), "Specialist function / workflow");
  }

  const hasKpis = (d.kpis?.length ?? 0) > 0 || d.noBaselineExists;
  need(hasKpis, "At least one KPI (or confirm no meaningful baseline exists)");

  return missing;
}
