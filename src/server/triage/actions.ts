"use server";

import { revalidatePath } from "next/cache";
import type { FlagType, ScoreDimension } from "@prisma/client";
import { z } from "zod";
import { requirePermission } from "@/server/rbac";
import { scoreInitiative } from "@/server/scoring";
import {
  markReadyForGovernance,
  requestInformation,
  saveTriageReview,
  setFlag,
} from "./index";

const componentSchema = z.object({
  dimension: z.enum(["BUSINESS_IMPACT", "TIME_TO_ARTIFACT", "DATA_FEASIBILITY", "SPONSORSHIP", "STRATEGIC_FIT"]),
  value: z.number().int().min(1).max(5),
  rationale: z.string().max(2000).optional(),
});

export async function scoreInitiativeAction(
  initiativeId: string,
  rawComponents: unknown,
) {
  const session = await requirePermission("triage.score");
  const components = z.array(componentSchema).length(5).parse(rawComponents);
  const { result } = await scoreInitiative({
    initiativeId,
    scorerId: session.user.id,
    components: components.map((c) => ({
      dimension: c.dimension as ScoreDimension,
      value: c.value,
      rationale: c.rationale,
    })),
  });
  revalidatePath(`/triage/${initiativeId}`);
  revalidatePath("/triage");
  return { ok: true as const, result };
}

export async function saveTriageReviewAction(
  initiativeId: string,
  raw: unknown,
) {
  const session = await requirePermission("triage.review");
  const fields = z
    .object({
      normalizedName: z.string().max(200).optional().nullable(),
      normalizedProblem: z.string().max(4000).optional().nullable(),
      normalizedAsk: z.string().max(4000).optional().nullable(),
      internalNotes: z.string().max(8000).optional().nullable(),
    })
    .parse(raw);
  await saveTriageReview({ initiativeId, reviewerId: session.user.id, ...fields });
  return { ok: true as const };
}

export async function setFlagAction(
  initiativeId: string,
  flagType: FlagType,
  active: boolean,
  note?: string,
) {
  const session = await requirePermission("triage.flag");
  await setFlag({ initiativeId, flagType, active, note, actorId: session.user.id });
  revalidatePath(`/triage/${initiativeId}`);
  return { ok: true as const };
}

export async function requestInformationAction(initiativeId: string, message: string) {
  const session = await requirePermission("triage.requestInfo");
  const msg = z.string().min(5).max(4000).parse(message);
  await requestInformation({ initiativeId, actorId: session.user.id, message: msg });
  revalidatePath("/triage");
  revalidatePath(`/triage/${initiativeId}`);
  return { ok: true as const };
}

/** AI-drafted score suggestions — prefill only; humans review and save. */
export async function suggestScoresAction(initiativeId: string) {
  await requirePermission("triage.score");
  const { suggestScores } = await import("@/server/ai/suggest-scores");
  const suggestions = await suggestScores(initiativeId);
  return { ok: true as const, suggestions };
}

export async function markReadyAction(initiativeId: string) {
  const session = await requirePermission("triage.review");
  await markReadyForGovernance({ initiativeId, actorId: session.user.id });
  revalidatePath("/triage");
  return { ok: true as const };
}
