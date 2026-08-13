"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EntityType } from "@prisma/client";
import { requirePermission, requireSession, AuthorizationError } from "@/server/rbac";
import { hasPermission } from "@/server/rbac/permissions";
import { db } from "@/server/db";

export async function addCommentAction(
  entityType: EntityType,
  entityId: string,
  body: string,
) {
  const session = await requireSession();
  const text = z.string().min(1).max(8000).parse(body.trim());

  if (entityType === "INITIATIVE") {
    // Internal roles, or the requester on their own initiative (Needs Info replies)
    const initiative = await db.initiative.findUniqueOrThrow({
      where: { id: entityId },
      select: { requesterId: true },
    });
    const isOwner = initiative.requesterId === session.user.id;
    if (!isOwner && !hasPermission(session.user.roles, "initiative.viewAll")) {
      throw new AuthorizationError();
    }
  } else {
    await requirePermission("project.view");
  }

  await db.comment.create({
    data: { entityType, entityId, authorId: session.user.id, body: text },
  });
  revalidatePath(entityType === "INITIATIVE" ? `/initiatives/${entityId}` : `/projects/${entityId}`);
  return { ok: true as const };
}
