"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/server/rbac";
import { db } from "@/server/db";

const configSchema = z.record(z.string(), z.unknown());

export async function saveViewAction(tableKey: string, name: string, config: unknown) {
  const session = await requireSession();
  const parsed = {
    tableKey: z.string().min(1).max(50).parse(tableKey),
    name: z.string().min(1).max(60).parse(name.trim()),
    config: configSchema.parse(config),
  };
  await db.savedView.create({
    data: {
      userId: session.user.id,
      tableKey: parsed.tableKey,
      name: parsed.name,
      config: parsed.config as object,
    },
  });
  revalidatePath("/governance/ranking");
  return { ok: true as const };
}

export async function deleteViewAction(viewId: string) {
  const session = await requireSession();
  await db.savedView.deleteMany({ where: { id: viewId, userId: session.user.id } });
  revalidatePath("/governance/ranking");
  return { ok: true as const };
}
