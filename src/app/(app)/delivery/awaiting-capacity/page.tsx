import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";
import { getCapacity } from "@/server/governance";
import { CapacityStrip } from "@/components/governance/capacity-strip";
import { LANE_LABELS } from "@/lib/lanes";

export const metadata = { title: "Awaiting Capacity" };

export default async function AwaitingCapacityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "project.view")) redirect("/home");

  const [initiatives, capacity] = await Promise.all([
    db.initiative.findMany({
      where: { deletedAt: null, status: "APPROVED_AWAITING_CAPACITY" },
      orderBy: { updatedAt: "asc" },
      include: {
        portfolioCompany: { select: { name: true } },
        scores: { where: { isCurrent: true }, take: 1, select: { compositeScore: true } },
        governanceDecisions: { where: { isCurrent: true }, take: 1 },
      },
    }),
    getCapacity(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Awaiting Capacity</h1>
        <CapacityStrip capacity={capacity} compact />
      </div>
      <p className="text-sm text-muted-foreground">
        Approved on merit, waiting for room. When capacity opens, governance
        records an Approve decision (with a lane) to schedule execution —
        nothing moves automatically.
      </p>

      {initiatives.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium">Nothing is waiting on capacity.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {initiatives.map((i) => {
            const d = i.governanceDecisions[0];
            return (
              <li key={i.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={`/initiatives/${i.id}`} className="text-sm font-medium hover:underline">
                      {i.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {i.portfolioCompany?.name ?? "Specialist"}
                      {i.scores[0] ? ` · score ${i.scores[0].compositeScore}` : ""}
                      {d?.anticipatedLane ? ` · anticipated: ${LANE_LABELS[d.anticipatedLane]}` : ""}
                      {d ? ` · approved ${format(d.decidedAt, "MMM d, yyyy")}` : ""}
                    </div>
                    {d?.rationale ? (
                      <p className="mt-1 text-xs text-muted-foreground">{d.rationale}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
