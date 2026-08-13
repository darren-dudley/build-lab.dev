"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { z } from "zod";
import { RoleType, TaxonomyKind, type DeliveryLane } from "@prisma/client";
import { requirePermission } from "@/server/rbac";
import { db } from "@/server/db";
import { writeAudit } from "@/server/audit";

/* ───────────────────────── Users ───────────────────────── */

const userSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  title: z.string().max(200).optional().nullable(),
  roles: z.array(z.enum(["REQUESTER", "TRIAGE", "GOVERNANCE", "DELIVERY", "ADMIN"])).min(1),
  password: z.string().min(10).max(200).optional(),
  isActive: z.boolean().optional(),
});

export async function upsertUserAction(userId: string | null, raw: unknown) {
  const session = await requirePermission("admin.users");
  const data = userSchema.parse(raw);

  if (!userId && !data.password) {
    return { ok: false as const, error: "New users need an initial password (10+ characters)" };
  }

  // Lockout guards: admins cannot deactivate themselves or drop their own
  // ADMIN role, and the last active admin can never lose admin access.
  if (userId === session.user.id) {
    if (data.isActive === false) {
      return { ok: false as const, error: "You can't deactivate your own account" };
    }
    if (!data.roles.includes("ADMIN")) {
      return { ok: false as const, error: "You can't remove your own administrator role" };
    }
  }
  if (userId && (!data.roles.includes("ADMIN") || data.isActive === false)) {
    const target = await db.user.findUnique({
      where: { id: userId },
      select: { isActive: true, roles: { select: { role: true } } },
    });
    const targetIsActiveAdmin = target?.isActive && target.roles.some((r) => r.role === "ADMIN");
    if (targetIsActiveAdmin) {
      const otherActiveAdmins = await db.user.count({
        where: {
          id: { not: userId },
          isActive: true,
          deletedAt: null,
          roles: { some: { role: "ADMIN" } },
        },
      });
      if (otherActiveAdmins === 0) {
        return { ok: false as const, error: "This is the last active administrator" };
      }
    }
  }

  await db.$transaction(async (tx) => {
    const base = {
      name: data.name,
      email: data.email.toLowerCase(),
      title: data.title ?? null,
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.password ? { passwordHash: await hash(data.password, 10) } : {}),
    };
    const user = userId
      ? await tx.user.update({ where: { id: userId }, data: base })
      : await tx.user.create({ data: { ...base, passwordHash: await hash(data.password!, 10) } });

    await tx.userRole.deleteMany({
      where: { userId: user.id, role: { notIn: data.roles as RoleType[] } },
    });
    for (const role of data.roles as RoleType[]) {
      await tx.userRole.upsert({
        where: { userId_role: { userId: user.id, role } },
        update: {},
        create: { userId: user.id, role },
      });
    }
    await writeAudit(tx, {
      actorId: session.user.id,
      action: userId ? "admin.user.update" : "admin.user.create",
      entityType: "USER",
      entityId: user.id,
      after: { name: data.name, email: data.email, roles: data.roles, isActive: data.isActive },
    });
  });
  revalidatePath("/admin/users");
  return { ok: true as const };
}

/* ───────────────────────── Capacity ───────────────────────── */

export async function updateCapacityAction(lane: DeliveryLane, capacity: number) {
  const session = await requirePermission("admin.capacity");
  const value = z.number().int().min(0).max(999).parse(capacity);
  await db.$transaction(async (tx) => {
    const before = await tx.capacitySetting.findUnique({ where: { lane } });
    await tx.capacitySetting.upsert({
      where: { lane },
      update: { capacity: value },
      create: { lane, capacity: value },
    });
    await writeAudit(tx, {
      actorId: session.user.id,
      action: "admin.capacity.update",
      entityType: "CAPACITY_SETTING",
      entityId: lane,
      before: { capacity: before?.capacity },
      after: { capacity: value },
    });
  });
  revalidatePath("/admin/capacity");
  return { ok: true as const };
}

/* ───────────────────────── Taxonomies ───────────────────────── */

export async function upsertTaxonomyItemAction(
  itemId: string | null,
  raw: { kind: string; label: string; isActive?: boolean },
) {
  const session = await requirePermission("admin.taxonomies");
  const kind = z.nativeEnum(TaxonomyKind).parse(raw.kind);
  const label = z.string().min(1).max(200).parse(raw.label);

  await db.$transaction(async (tx) => {
    const item = itemId
      ? await tx.taxonomyItem.update({
          where: { id: itemId },
          data: { label, ...(raw.isActive !== undefined ? { isActive: raw.isActive } : {}) },
        })
      : await tx.taxonomyItem.create({
          data: {
            kind,
            label,
            sortOrder: (await tx.taxonomyItem.count({ where: { kind } })) + 1,
          },
        });
    await writeAudit(tx, {
      actorId: session.user.id,
      action: itemId ? "admin.taxonomy.update" : "admin.taxonomy.create",
      entityType: "TAXONOMY_ITEM",
      entityId: item.id,
      after: { kind, label, isActive: raw.isActive },
    });
  });
  revalidatePath("/admin/taxonomies");
  return { ok: true as const };
}
