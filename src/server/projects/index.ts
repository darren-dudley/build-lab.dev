import {
  InitiativeStatus, ProjectHealth, Prisma, TaskStatus,
} from "@prisma/client";
import { db } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { transitionInitiative } from "@/server/workflow";

/**
 * Converts an approved+assigned initiative into a Project (docs/04 §30).
 * A HUMAN action, always — capacity opening never triggers this. Carries
 * forward KPIs (as ESTIMATED), lane, owner; the initiative remains the
 * decision record with a permanent link.
 */
export async function startProject(params: {
  initiativeId: string;
  actorId: string;
  leadId?: string;
  targetDeploymentDate?: Date;
}) {
  const initiative = await db.initiative.findUniqueOrThrow({
    where: { id: params.initiativeId, deletedAt: null },
    include: {
      deliveryAssignment: true,
      triageReview: true,
      intakeResponse: true,
      kpis: true,
      project: true,
    },
  });
  if (initiative.project) throw new Error("A project already exists for this initiative");
  if (initiative.status !== InitiativeStatus.APPROVED_SCHEDULED) {
    throw new Error("Only initiatives in Approved — Scheduled can start execution");
  }
  const assignment = initiative.deliveryAssignment;
  if (!assignment) throw new Error("No delivery assignment — governance must assign a lane first");

  const templates = await db.phaseTemplate.findMany({
    where: { lane: assignment.lane, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        initiativeId: initiative.id,
        name: initiative.triageReview?.normalizedName ?? initiative.name,
        lane: assignment.lane,
        leadId: params.leadId ?? null,
        targetDeploymentDate: params.targetDeploymentDate ?? null,
        phases: {
          create: templates.map((t) => ({ name: t.name, sortOrder: t.sortOrder })),
        },
        kpis: {
          create: initiative.kpis.map((k) => ({
            initiativeKpiId: k.id,
            metric: k.metric,
            baseline: k.noBaseline ? "No baseline" : k.baseline,
            target: k.target,
            valueType: "ESTIMATED",
          })),
        },
      },
      include: { phases: { orderBy: { sortOrder: "asc" } } },
    });
    const firstPhase = project.phases[0];
    if (firstPhase) {
      await tx.project.update({
        where: { id: project.id },
        data: { currentPhaseId: firstPhase.id },
      });
      await tx.projectPhase.update({
        where: { id: firstPhase.id },
        data: { startedAt: new Date() },
      });
    }
    if (params.leadId) {
      await tx.projectMember.create({
        data: { projectId: project.id, userId: params.leadId, role: "Lead" },
      });
    }
    await transitionInitiative(
      { initiativeId: initiative.id, to: InitiativeStatus.IN_DELIVERY, actorId: params.actorId },
      tx,
    );
    await writeAudit(tx, {
      actorId: params.actorId,
      action: "project.start",
      entityType: "PROJECT",
      entityId: project.id,
      after: { initiativeId: initiative.id, lane: assignment.lane },
    });
    await tx.activityEvent.create({
      data: {
        initiativeId: initiative.id,
        projectId: project.id,
        actorId: params.actorId,
        eventType: "project_start",
        summary: "Project started",
      },
    });
    return project;
  });
}

/** Phase → initiative-status mirroring (recorded, never silent). */
const PHASE_STATUS_MIRROR: Record<string, InitiativeStatus> = {
  Production: InitiativeStatus.DEPLOYED,
  Measurement: InitiativeStatus.MEASURING_IMPACT,
  Complete: InitiativeStatus.COMPLETED,
};

export async function setCurrentPhase(params: {
  projectId: string;
  phaseId: string;
  actorId: string;
}) {
  await db.$transaction(async (tx) => {
    const project = await tx.project.findUniqueOrThrow({
      where: { id: params.projectId, deletedAt: null },
      include: { phases: { orderBy: { sortOrder: "asc" } }, initiative: { select: { id: true, status: true } } },
    });
    const target = project.phases.find((p) => p.id === params.phaseId);
    if (!target) throw new Error("Phase not found on this project");

    // Complete earlier phases, start the target
    for (const p of project.phases) {
      if (p.sortOrder < target.sortOrder && !p.completedAt) {
        await tx.projectPhase.update({ where: { id: p.id }, data: { completedAt: new Date(), startedAt: p.startedAt ?? new Date() } });
      }
    }
    await tx.projectPhase.update({
      where: { id: target.id },
      data: { startedAt: target.startedAt ?? new Date() },
    });
    await tx.project.update({
      where: { id: project.id },
      data: {
        currentPhaseId: target.id,
        ...(target.name === "Complete" ? { status: "COMPLETED", completedAt: new Date() } : {}),
      },
    });

    const mirror = PHASE_STATUS_MIRROR[target.name];
    if (mirror && project.initiative.status !== mirror) {
      // Walk the legal status path stepwise (e.g. IN_DELIVERY → DEPLOYED →
      // MEASURING_IMPACT → COMPLETED) — the whitelist forbids jumps.
      const path: InitiativeStatus[] = [
        InitiativeStatus.IN_DELIVERY,
        InitiativeStatus.DEPLOYED,
        InitiativeStatus.MEASURING_IMPACT,
        InitiativeStatus.COMPLETED,
      ];
      const from = path.indexOf(project.initiative.status);
      const to = path.indexOf(mirror);
      if (from !== -1 && to > from) {
        for (const step of path.slice(from + 1, to + 1)) {
          await transitionInitiative(
            { initiativeId: project.initiative.id, to: step, actorId: params.actorId },
            tx,
          );
        }
      }
    }
    await tx.activityEvent.create({
      data: {
        projectId: project.id,
        initiativeId: project.initiative.id,
        actorId: params.actorId,
        eventType: "phase_change",
        summary: `Phase → ${target.name}`,
      },
    });
    await writeAudit(tx, {
      actorId: params.actorId,
      action: "project.phase",
      entityType: "PROJECT",
      entityId: project.id,
      after: { phase: target.name },
    });
  });
}

/** Yellow/Red require an explanation (docs spec §36). */
export async function updateHealth(params: {
  projectId: string;
  health: ProjectHealth;
  note?: string;
  actorId: string;
}) {
  if (params.health !== "GREEN" && !params.note?.trim()) {
    throw new Error("Yellow or Red health requires an explanation");
  }
  await db.$transaction(async (tx) => {
    const before = await tx.project.findUniqueOrThrow({
      where: { id: params.projectId },
      select: { health: true, initiativeId: true },
    });
    await tx.project.update({
      where: { id: params.projectId },
      data: { health: params.health, healthNote: params.note ?? null },
    });
    if (before.health !== params.health) {
      await tx.activityEvent.create({
        data: {
          projectId: params.projectId,
          initiativeId: before.initiativeId,
          actorId: params.actorId,
          eventType: "health_change",
          summary: `Health ${before.health} → ${params.health}${params.note ? `: ${params.note}` : ""}`,
        },
      });
      await writeAudit(tx, {
        actorId: params.actorId,
        action: "project.health",
        entityType: "PROJECT",
        entityId: params.projectId,
        before: { health: before.health },
        after: { health: params.health, note: params.note ?? null },
      });
    }
  });
}

export async function addProjectUpdate(params: {
  projectId: string;
  authorId: string;
  accomplished?: string;
  next?: string;
  risks?: string;
  decisionsNeeded?: string;
  kpiUpdate?: string;
  health: ProjectHealth;
  healthNote?: string;
}) {
  await updateHealth({
    projectId: params.projectId,
    health: params.health,
    note: params.healthNote,
    actorId: params.authorId,
  });
  await db.projectUpdate.create({
    data: {
      projectId: params.projectId,
      authorId: params.authorId,
      accomplished: params.accomplished ?? null,
      next: params.next ?? null,
      risks: params.risks ?? null,
      decisionsNeeded: params.decisionsNeeded ?? null,
      kpiUpdate: params.kpiUpdate ?? null,
      healthAtTime: params.health,
    },
  });
}

export async function upsertTask(params: {
  projectId: string;
  actorId: string;
  taskId?: string;
  data: {
    name?: string;
    ownerId?: string | null;
    status?: TaskStatus;
    dueDate?: Date | null;
    description?: string | null;
    priority?: string | null;
    phaseId?: string | null;
    blockerNote?: string | null;
  };
}) {
  if (params.taskId) {
    return db.task.update({ where: { id: params.taskId }, data: params.data });
  }
  if (!params.data.name) throw new Error("Task name required");
  return db.task.create({
    data: {
      projectId: params.projectId,
      name: params.data.name,
      ownerId: params.data.ownerId ?? null,
      status: params.data.status ?? "NOT_STARTED",
      dueDate: params.data.dueDate ?? null,
      description: params.data.description ?? null,
      priority: params.data.priority ?? null,
      phaseId: params.data.phaseId ?? null,
      blockerNote: params.data.blockerNote ?? null,
    },
  });
}

export async function upsertMilestone(params: {
  projectId: string;
  milestoneId?: string;
  data: { name?: string; targetDate?: Date | null; completedAt?: Date | null; phaseId?: string | null };
}) {
  if (params.milestoneId) {
    return db.milestone.update({ where: { id: params.milestoneId }, data: params.data });
  }
  if (!params.data.name) throw new Error("Milestone name required");
  return db.milestone.create({
    data: {
      projectId: params.projectId,
      name: params.data.name,
      targetDate: params.data.targetDate ?? null,
      phaseId: params.data.phaseId ?? null,
    },
  });
}

/** Validated results require a measurement date + methodology. */
export async function updateProjectKpi(params: {
  kpiId: string;
  actorId: string;
  currentResult: string;
  valueType: "ESTIMATED" | "VALIDATED";
  measuredAt?: Date;
  methodology?: string;
  numericValue?: number;
}) {
  if (params.valueType === "VALIDATED" && (!params.measuredAt || !params.methodology?.trim())) {
    throw new Error("Validated results require a measurement date and methodology");
  }
  const kpi = await db.projectKPI.update({
    where: { id: params.kpiId },
    data: {
      currentResult: params.currentResult,
      valueType: params.valueType,
      measuredAt: params.measuredAt ?? null,
      methodology: params.methodology ?? null,
      numericValue: params.numericValue ?? null,
    },
  });
  await db.activityEvent.create({
    data: {
      projectId: kpi.projectId,
      actorId: params.actorId,
      eventType: "kpi_update",
      summary: `KPI "${kpi.metric}" → ${params.currentResult} (${params.valueType.toLowerCase()})`,
    },
  });
  return kpi;
}

const projectListInclude = {
  initiative: {
    select: {
      id: true,
      portfolioCompany: { select: { name: true } },
      function: { select: { label: true } },
    },
  },
  lead: { select: { name: true } },
  currentPhase: { select: { name: true } },
  tasks: { where: { status: "BLOCKED" }, select: { id: true, name: true, blockerNote: true } },
  milestones: {
    where: { completedAt: null },
    orderBy: { targetDate: "asc" },
    take: 1,
  },
  updates: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
} satisfies Prisma.ProjectInclude;

export async function getProjects(lane?: "RAPID_DEPLOYMENT" | "EXTERNAL_FDE_POD" | "CORE_TRANSFORMATION") {
  return db.project.findMany({
    where: { deletedAt: null, ...(lane ? { lane } : {}) },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    include: projectListInclude,
  });
}
