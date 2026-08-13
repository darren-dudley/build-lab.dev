import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { hasPermission } from "@/server/rbac/permissions";
import { getTriageQueue } from "@/server/triage";
import { StatusBadge } from "@/components/initiative/status-badge";
import { EFFORT_LABELS, ttaLabel } from "@/lib/labels";
import { formatDistanceToNow } from "date-fns";

export const metadata = { title: "Triage Queue" };

/*
 * UX: a work queue, not a dashboard. Goal — process submissions fast.
 * Hierarchy: what's unprocessed first (oldest submitted at top), score state
 * visible without opening, flags visible as count. Row click → workspace.
 */
export default async function TriageQueuePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "triage.review")) redirect("/home");

  const queue = await getTriageQueue();
  const unscored = queue.filter((i) => i.scores.length === 0);
  const scored = queue.filter((i) => i.scores.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Triage Queue</h1>
        <div className="text-sm text-muted-foreground">
          {unscored.length} unscored · {scored.length} in progress
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium">No initiatives need triage.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;re caught up. New submissions will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <Th>Initiative</Th>
                <Th>Company / Specialist</Th>
                <Th>Function</Th>
                <Th>Requester</Th>
                <Th>Submitted</Th>
                <Th>Status</Th>
                <Th>Time-to-Artifact</Th>
                <Th>Effort</Th>
                <Th className="text-right">Score</Th>
                <Th className="text-right">Flags</Th>
              </tr>
            </thead>
            <tbody>
              {queue.map((i) => (
                <tr key={i.id} className="group border-b transition-colors last:border-0 hover:bg-accent/40">
                  <Td>
                    <Link href={`/triage/${i.id}`} className="font-medium after:absolute after:inset-0 group-hover:underline relative">
                      {i.name}
                    </Link>
                  </Td>
                  <Td>{i.portfolioCompany?.name ?? "Specialist"}</Td>
                  <Td>{i.function?.label ?? "—"}</Td>
                  <Td>{i.requester?.name ?? i.requesterName ?? "—"}</Td>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {i.submittedAt ? formatDistanceToNow(i.submittedAt, { addSuffix: true }) : "—"}
                  </Td>
                  <Td><StatusBadge status={i.status} /></Td>
                  <Td>{ttaLabel(i.intakeResponse?.timeToArtifactValue, i.intakeResponse?.timeToArtifactUnit)}</Td>
                  <Td>{i.intakeResponse?.effortEstimate ? EFFORT_LABELS[i.intakeResponse.effortEstimate] : "—"}</Td>
                  <Td className="text-right tabular-nums">
                    {i.scores[0] ? (
                      <span className="font-medium">{i.scores[0].compositeScore}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    {i.flags.length > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {i.flags.length}
                      </span>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
