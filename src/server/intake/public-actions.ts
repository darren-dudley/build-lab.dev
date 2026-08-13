"use server";

import { redirect } from "next/navigation";
import type { RequestType } from "@prisma/client";
import { draftDataSchema } from "@/lib/intake-schema";
import { createDraft, saveDraft, submitInitiative } from "./index";
import { db } from "@/server/db";

/**
 * Public (unauthenticated) intake actions. No session required by design —
 * anyone with the link may submit an initiative. Edit access to a public
 * draft is possession of its unguessable URL, and only while editable.
 */

export async function createPublicDraftAction(requestType: RequestType) {
  const initiative = await createDraft(null, requestType);
  redirect(`/submit/${initiative.id}`);
}

async function assertPublic(initiativeId: string) {
  const initiative = await db.initiative.findUnique({
    where: { id: initiativeId },
    select: { requesterId: true },
  });
  if (!initiative || initiative.requesterId !== null) {
    throw new Error("Not found");
  }
}

export async function savePublicDraftAction(initiativeId: string, raw: unknown) {
  await assertPublic(initiativeId);
  const data = draftDataSchema.parse(raw);
  await saveDraft(initiativeId, null, data);
  return { savedAt: new Date().toISOString() };
}

export async function submitPublicInitiativeAction(initiativeId: string) {
  await assertPublic(initiativeId);
  const result = await submitInitiative(initiativeId, null);
  if (result.ok) redirect(`/submit/${initiativeId}`);
  return result;
}
