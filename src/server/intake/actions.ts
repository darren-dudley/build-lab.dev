"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { RequestType } from "@prisma/client";
import { requirePermission } from "@/server/rbac";
import { draftDataSchema } from "@/lib/intake-schema";
import { createDraft, saveDraft, submitInitiative } from "./index";

export async function createDraftAction(requestType: RequestType) {
  const session = await requirePermission("initiative.create");
  const initiative = await createDraft(session.user.id, requestType);
  redirect(`/intake/${initiative.id}`);
}

export async function saveDraftAction(initiativeId: string, raw: unknown) {
  const session = await requirePermission("initiative.create");
  const data = draftDataSchema.parse(raw);
  await saveDraft(initiativeId, session.user.id, data);
  return { savedAt: new Date().toISOString() };
}

export async function submitInitiativeAction(initiativeId: string) {
  const session = await requirePermission("initiative.create");
  const result = await submitInitiative(initiativeId, session.user.id);
  if (result.ok) {
    revalidatePath("/initiatives/mine");
    redirect(`/initiatives/${initiativeId}?submitted=1`);
  }
  return result;
}
