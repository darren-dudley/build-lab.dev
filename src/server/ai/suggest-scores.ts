import { generateText, Output, type LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { db } from "@/server/db";
import { getCurrentModelVersion, modelTypeFor } from "@/server/scoring";

/**
 * AI-drafted dimension scores for a submission, scored strictly against the
 * CURRENT rubric text. These are SUGGESTIONS ONLY — they prefill the triage
 * scoring panel, and nothing becomes an official score until a human reviewer
 * saves it (the saved score always records the human as scorer).
 * The engine still never touches delivery-lane assignment.
 */

const DIMENSIONS = [
  "BUSINESS_IMPACT",
  "TIME_TO_ARTIFACT",
  "DATA_FEASIBILITY",
  "SPONSORSHIP",
  "STRATEGIC_FIT",
] as const;

const suggestionSchema = z.object({
  scores: z.object(
    Object.fromEntries(
      DIMENSIONS.map((d) => [
        d,
        z.object({
          value: z.number().int().min(1).max(5),
          rationale: z
            .string()
            .max(300)
            .describe("One or two sentences citing specific evidence from the submission"),
        }),
      ]),
    ) as Record<
      (typeof DIMENSIONS)[number],
      z.ZodObject<{ value: z.ZodNumber; rationale: z.ZodString }>
    >,
  ),
  caveats: z
    .string()
    .max(400)
    .describe("What a human reviewer should double-check before accepting these scores"),
});

export type ScoreSuggestions = z.infer<typeof suggestionSchema>;

export async function suggestScores(initiativeId: string): Promise<ScoreSuggestions> {
  const initiative = await db.initiative.findUniqueOrThrow({
    where: { id: initiativeId, deletedAt: null },
    include: {
      portfolioCompany: { select: { name: true, fundNumber: true } },
      function: { select: { label: true } },
      sponsor: true,
      intakeResponse: true,
      kpis: true,
      dataSources: true,
      systems: { include: { system: { select: { label: true } } } },
    },
  });
  const version = await getCurrentModelVersion(modelTypeFor(initiative.requestType));
  const rubrics = version.rubrics as Record<string, Record<string, string>>;
  const r = initiative.intakeResponse;

  const rubricText = DIMENSIONS.map(
    (d) =>
      `${d}:\n` +
      [1, 2, 3, 4, 5].map((n) => `  ${n} = ${rubrics[d]?.[String(n)] ?? "-"}`).join("\n"),
  ).join("\n\n");

  const submission = `
INITIATIVE: ${initiative.name}
TYPE: ${initiative.requestType === "SPECIALIST_SPECIALIST" ? "Internal specialist build" : `Portfolio company build — ${initiative.portfolioCompany?.name ?? "unknown"} (${initiative.portfolioCompany?.fundNumber ?? "fund unknown"})`}
FUNCTION: ${initiative.function?.label ?? r?.specialistWorkflow ?? "—"}
SPONSOR: ${initiative.sponsor ? `${initiative.sponsor.name}${initiative.sponsor.title ? `, ${initiative.sponsor.title}` : ""} (confirmed: ${initiative.sponsor.confirmed ? "yes" : "no"})` : "none named"}
OUTCOME OWNER: ${r?.outcomeOwnerName ?? "none named"}${r?.outcomeOwnerTitle ? `, ${r.outcomeOwnerTitle}` : ""}

BUSINESS PROBLEM: ${r?.businessProblem ?? "—"}
HOW IT WORKS TODAY: ${r?.currentProcess ?? "—"}
PROPOSED AI TASK: ${r?.aiTask ?? "—"}
90-DAY SUCCESS: ${r?.successDefinition ?? "—"}
METRICS: ${initiative.kpis.length > 0 ? initiative.kpis.map((k) => `${k.metric}: ${k.noBaseline ? "no baseline" : k.baseline ?? "?"} → ${k.target ?? "?"}`).join("; ") : "none provided"}
REQUESTER TIME-TO-ARTIFACT ESTIMATE: ${r?.timeToArtifactValue ? `${r.timeToArtifactValue} ${r.timeToArtifactUnit?.toLowerCase()}` : "not provided"}
REQUESTER EFFORT ESTIMATE: ${r?.effortEstimate ?? "not provided"}
DATA SOURCES: ${initiative.dataSources.length > 0 ? initiative.dataSources.map((s) => `${s.system} (${s.accessStatus.toLowerCase()})`).join("; ") : "none listed"}
SYSTEMS: ${initiative.systems.map((s) => s.system?.label ?? s.otherLabel).filter(Boolean).join(", ") || "none listed"}
PRIOR ATTEMPTS: ${r?.priorAttempts ?? "unknown"}${r?.priorAttemptsDetail ? ` — ${r.priorAttemptsDetail}` : ""}
ONLY INITIATIVE THIS QUARTER: ${r?.onlyOneAnswer ?? "—"}${r?.onlyOneWhy ? ` — ${r.onlyOneWhy}` : ""}
FORCING EVENT: ${r?.forcingEvent ?? "none"}`;

  // Model preference: direct Anthropic API when ANTHROPIC_API_KEY is set
  // (unrestricted, Sonnet 5), then AI Gateway, then the gateway free-tier
  // model as a labeled last resort.
  const MODELS: LanguageModel[] = [
    ...(process.env.ANTHROPIC_API_KEY ? [anthropic("claude-sonnet-5")] : []),
    "anthropic/claude-sonnet-5",
    "anthropic/claude-3-haiku",
  ];
  let lastError: unknown;
  for (const model of MODELS) {
    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: suggestionSchema }),
        system: `You are a triage analyst at a private equity firm drafting first-pass scores for an AI initiative submission. Score each dimension 1-5 STRICTLY against the rubric definitions provided — the rubric text is the law, not your general judgment. Cite specific evidence from the submission in each rationale. Where the submission is silent or unconfirmed (e.g. unnamed sponsor, unverified data access), score conservatively and say so. Do not reward enthusiasm; reward evidence. A human reviewer will check and adjust every score before anything is saved.`,
        prompt: `RUBRICS (score against these definitions verbatim):\n\n${rubricText}\n\nSUBMISSION:\n${submission}`,
      });
      if (model === "anthropic/claude-3-haiku") {
        output.caveats =
          `Drafted by a limited fallback model — review extra carefully. ${output.caveats}`.slice(0, 400);
      }
      return output;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}
