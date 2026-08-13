import type { InitiativeStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { canTransition, statusLabel } from "./transitions";

export { ALLOWED_TRANSITIONS, canTransition, externalStatusLabel, statusLabel } from "./transitions";

export class InvalidTransitionError extends Error {
  constructor(from: InitiativeStatus, to: InitiativeStatus) {
    super(`Invalid status transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/**
 * The ONLY way to change an initiative's status. Validates against the
 * whitelist, then atomically: updates status, appends StatusTransition,
 * AuditEvent, and ActivityEvent.
 *
 * Accepts an existing transaction so callers (e.g. governance decisions) can
 * bundle the transition with their own writes.
 */
export async function transitionInitiative(
  params: {
    initiativeId: string;
    to: InitiativeStatus;
    /** Null when the actor is an unauthenticated public requester. */
    actorId: string | null;
    note?: string;
  },
  tx?: Prisma.TransactionClient,
) {
  const run = async (t: Prisma.TransactionClient) => {
    const initiative = await t.initiative.findUniqueOrThrow({
      where: { id: params.initiativeId },
      select: { id: true, status: true, name: true, submittedAt: true },
    });
    if (!canTransition(initiative.status, params.to)) {
      throw new InvalidTransitionError(initiative.status, params.to);
    }
    const firstSubmission = params.to === "SUBMITTED" && !initiative.submittedAt;
    await t.initiative.update({
      where: { id: initiative.id },
      data: {
        status: params.to,
        ...(firstSubmission ? { submittedAt: new Date() } : {}),
      },
    });
    await t.statusTransition.create({
      data: {
        initiativeId: initiative.id,
        fromStatus: initiative.status,
        toStatus: params.to,
        actorId: params.actorId,
        note: params.note,
      },
    });
    await writeAudit(t, {
      actorId: params.actorId,
      action: "initiative.transition",
      entityType: "INITIATIVE",
      entityId: initiative.id,
      before: { status: initiative.status },
      after: { status: params.to, note: params.note },
    });
    await t.activityEvent.create({
      data: {
        initiativeId: initiative.id,
        actorId: params.actorId,
        eventType: "status_change",
        summary: `Status changed from ${statusLabel(initiative.status)} to ${statusLabel(params.to)}`,
      },
    });
    return { from: initiative.status, to: params.to };
  };

  return tx ? run(tx) : db.$transaction(run);
}
