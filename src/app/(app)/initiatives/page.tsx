import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { InitiativeStatus } from "@prisma/client";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";
import { StatusBadge } from "@/components/initiative/status-badge";
import { statusLabel } from "@/server/workflow/transitions";
import { LANE_LABELS } from "@/lib/lanes";
import { cn } from "@/lib/utils";

export const metadata = { title: "All Initiatives" };

const FILTERS: { key: string; label: string; statuses: InitiativeStatus[] }[] = [
  { key: "all", label: "All", statuses: [] },
  {
    key: "in-review",
    label: "In review",
    statuses: ["SUBMITTED", "NEEDS_INFORMATION", "TRIAGE", "READY_FOR_GOVERNANCE", "GOVERNANCE_REVIEW"],
  },
  {
    key: "approved",
    label: "Approved",
    statuses: ["APPROVED_AWAITING_CAPACITY", "APPROVED_SCHEDULED"],
  },
  {
    key: "delivery",
    label: "In delivery",
    statuses: ["IN_DELIVERY", "DEPLOYED", "MEASURING_IMPACT"],
  },
  { key: "closed", label: "Closed", statuses: ["COMPLETED", "DEFERRED", "REJECTED", "CANCELLED"] },
];

/*
 * All Initiatives: the full record across the lifecycle for internal roles.
 * Drafts are excluded (they belong to their requesters until submitted).
 */
export default async function AllInitiativesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "initiative.viewAll")) redirect("/initiatives/mine");

  const { filter: filterKey } = await searchParams;
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];

  const initiatives = await db.initiative.findMany({
    where: {
      deletedAt: null,
      status: filter.statuses.length > 0 ? { in: filter.statuses } : { not: "DRAFT" },
    },
    orderBy: [{ submittedAt: "desc" }],
    include: {
      portfolioCompany: { select: { name: true } },
      function: { select: { label: true } },
      requester: { select: { name: true } },
      scores: { where: { isCurrent: true }, take: 1, select: { compositeScore: true } },
      governanceDecisions: { where: { isCurrent: true }, take: 1, select: { decision: true } },
      deliveryAssignment: { select: { lane: true } },
      project: { select: { id: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">All Initiatives</h1>
        <span className="text-sm text-muted-foreground">{initiatives.length} shown</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/initiatives" : `/initiatives?filter=${f.key}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              f.key === filter.key
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {initiatives.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium">Nothing here yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Initiatives appear as soon as they are submitted.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Initiative</th>
                <th className="px-3 py-2 font-medium">Company / Specialist</th>
                <th className="px-3 py-2 font-medium">Function</th>
                <th className="px-3 py-2 font-medium">Requester</th>
                <th className="px-3 py-2 font-medium">Submitted</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Assignment</th>
              </tr>
            </thead>
            <tbody>
              {initiatives.map((i) => (
                <tr key={i.id} className="group relative border-b transition-colors last:border-0 hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <Link
                      href={`/initiatives/${i.id}`}
                      className="relative font-medium after:absolute after:inset-0 group-hover:underline"
                    >
                      {i.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{i.portfolioCompany?.name ?? "Specialist"}</td>
                  <td className="px-3 py-2">{i.function?.label ?? "—"}</td>
                  <td className="px-3 py-2">{i.requester?.name ?? i.requesterName ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {i.submittedAt ? formatDistanceToNow(i.submittedAt, { addSuffix: true }) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="score-figure px-3 py-2 text-right font-medium">
                    {i.scores[0]?.compositeScore ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {i.deliveryAssignment ? LANE_LABELS[i.deliveryAssignment.lane] : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Statuses roll up as: In review covers {FILTERS[1].statuses.map(statusLabel).join(", ").toLowerCase()}.
      </p>
    </div>
  );
}
