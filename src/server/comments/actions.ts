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
  z.string().uuid().parse(entityId);

  if (entityType === "INITIATIVE") {
    // Object-level check: target must exist, and the caller must be either
    // the requester on their own initiative or an internal role.
    const initiative = await db.initiative.findUnique({
      where: { id: entityId, deletedAt: null },
      select: { requesterId: true },
    });
    if (!initiative) throw new AuthorizationError("Not found");
    const isOwner = initiative.requesterId === session.user.id;
    if (!isOwner && !hasPermission(session.user.roles, "initiative.viewAll")) {
      throw new AuthorizationError();
    }
  } else if (entityType === "PROJECT") {
    await requirePermission("project.view");
    const project = await db.project.findUnique({
      where: { id: entityId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new AuthorizationError("Not found");
  } else {
    throw new AuthorizationError("Comments are not supported on this entity");
  }

  await db.comment.create({
    data: { entityType, entityId, authorId: session.user.id, body: text },
  });
  revalidatePath(entityType === "INITIATIVE" ? `/initiatives/${entityId}` : `/projects/${entityId}`);
  return { ok: true as const };
}
