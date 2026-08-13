"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/rbac";
import { recordDecision } from "./index";

const decisionSchema = z.object({
  decision: z.enum(["APPROVE", "APPROVE_AWAITING_CAPACITY", "DEFER", "MORE_INFORMATION", "REJECT"]),
  lane: z.enum(["RAPID_DEPLOYMENT", "EXTERNAL_FDE_POD", "CORE_TRANSFORMATION"]).optional().nullable(),
  anticipatedLane: z.enum(["RAPID_DEPLOYMENT", "EXTERNAL_FDE_POD", "CORE_TRANSFORMATION"]).optional().nullable(),
  rationale: z.string().max(4000).optional().nullable(),
  conditions: z.string().max(4000).optional(),
  priorityNotes: z.string().max(4000).optional(),
  reconsiderAt: z.string().optional().nullable(), // ISO date
  infoMessage: z.string().max(4000).optional(),
  makerIds: z.array(z.string().uuid()).optional(),
});

export async function recordDecisionAction(initiativeId: string, raw: unknown) {
  const session = await requirePermission("governance.decide");
  const parsed = decisionSchema.parse(raw);
  const result = await recordDecision({
    initiativeId,
    actorId: session.user.id,
    makerIds: parsed.makerIds,
    input: {
      decision: parsed.decision,
      lane: parsed.lane ?? null,
      anticipatedLane: parsed.anticipatedLane ?? null,
      rationale: parsed.rationale ?? null,
      conditions: parsed.conditions,
      priorityNotes: parsed.priorityNotes,
      reconsiderAt: parsed.reconsiderAt ? new Date(parsed.reconsiderAt) : null,
      infoMessage: parsed.infoMessage,
    },
  });
  if (result.ok) {
    revalidatePath("/governance");
    revalidatePath("/governance/ranking");
  }
  return result;
}
