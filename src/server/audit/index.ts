import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Append-only audit writer. Always called inside the same transaction as the
 * mutation it records so history can never diverge from state.
 */
export async function writeAudit(
  tx: Tx,
  event: {
    actorId: string | null;
    action: string; // e.g. "initiative.submit", "governance.decide"
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await tx.auditEvent.create({
    data: {
      actorId: event.actorId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      before: event.before === undefined ? undefined : (event.before as Prisma.InputJsonValue),
      after: event.after === undefined ? undefined : (event.after as Prisma.InputJsonValue),
    },
  });
}
