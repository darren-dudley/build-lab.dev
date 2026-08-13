"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProjectHealth, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { requirePermission } from "@/server/rbac";
import {
  addProjectUpdate, setCurrentPhase, startProject, updateHealth,
  updateProjectKpi, upsertMilestone, upsertTask,
} from "./index";

export async function startProjectAction(
  initiativeId: string,
  opts: { leadId?: string; targetDeploymentDate?: string },
) {
  const session = await requirePermission("project.start");
  const project = await startProject({
    initiativeId,
    actorId: session.user.id,
    leadId: opts.leadId,
    targetDeploymentDate: opts.targetDeploymentDate ? new Date(opts.targetDeploymentDate) : undefined,
  });
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function setPhaseAction(projectId: string, phaseId: string) {
  const session = await requirePermission("project.manage");
  await setCurrentPhase({ projectId, phaseId, actorId: session.user.id });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function updateHealthAction(projectId: string, health: ProjectHealth, note?: string) {
  const session = await requirePermission("project.manage");
  await updateHealth({ projectId, health, note, actorId: session.user.id });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

const updateSchema = z.object({
  accomplished: z.string().max(4000).optional(),
  next: z.string().max(4000).optional(),
  risks: z.string().max(4000).optional(),
  decisionsNeeded: z.string().max(4000).optional(),
  kpiUpdate: z.string().max(4000).optional(),
  health: z.enum(["GREEN", "YELLOW", "RED"]),
  healthNote: z.string().max(2000).optional(),
});

export async function addUpdateAction(projectId: string, raw: unknown) {
  const session = await requirePermission("project.manage");
  const data = updateSchema.parse(raw);
  await addProjectUpdate({ projectId, authorId: session.user.id, ...data });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

const taskSchema = z.object({
  name: z.string().max(300).optional(),
  ownerId: z.string().uuid().optional().nullable(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "WAITING", "BLOCKED", "COMPLETE", "CANCELLED"]).optional(),
  dueDate: z.string().optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().nullable(),
  phaseId: z.string().uuid().optional().nullable(),
  blockerNote: z.string().max(2000).optional().nullable(),
});

export async function upsertTaskAction(projectId: string, taskId: string | undefined, raw: unknown) {
  const session = await requirePermission("project.manage");
  const d = taskSchema.parse(raw);
  await upsertTask({
    projectId,
    actorId: session.user.id,
    taskId,
    data: {
      ...d,
      status: d.status as TaskStatus | undefined,
      dueDate: d.dueDate === undefined ? undefined : d.dueDate ? new Date(d.dueDate) : null,
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function upsertMilestoneAction(
  projectId: string,
  milestoneId: string | undefined,
  raw: { name?: string; targetDate?: string | null; complete?: boolean },
) {
  await requirePermission("project.manage");
  await upsertMilestone({
    projectId,
    milestoneId,
    data: {
      name: raw.name,
      targetDate: raw.targetDate === undefined ? undefined : raw.targetDate ? new Date(raw.targetDate) : null,
      completedAt: raw.complete === undefined ? undefined : raw.complete ? new Date() : null,
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

const kpiSchema = z.object({
  currentResult: z.string().min(1).max(500),
  valueType: z.enum(["ESTIMATED", "VALIDATED"]),
  measuredAt: z.string().optional(),
  methodology: z.string().max(2000).optional(),
  numericValue: z.number().optional(),
});

export async function updateKpiAction(kpiId: string, projectId: string, raw: unknown) {
  const session = await requirePermission("project.manage");
  const d = kpiSchema.parse(raw);
  await updateProjectKpi({
    kpiId,
    actorId: session.user.id,
    currentResult: d.currentResult,
    valueType: d.valueType,
    measuredAt: d.measuredAt ? new Date(d.measuredAt) : undefined,
    methodology: d.methodology,
    numericValue: d.numericValue,
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}
