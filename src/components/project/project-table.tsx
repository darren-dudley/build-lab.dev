import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { HealthBadge } from "./health-badge";
import { LANE_LABELS } from "@/lib/lanes";
import type { getProjects } from "@/server/projects";

export function ProjectTable({
  projects,
  showLane = true,
}: {
  projects: Awaited<ReturnType<typeof getProjects>>;
  showLane?: boolean;
}) {
  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="text-sm font-medium">No projects here yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Projects appear when governance-approved initiatives are started.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Project</th>
            <th className="px-3 py-2 font-medium">Company</th>
            {showLane ? <th className="px-3 py-2 font-medium">Lane</th> : null}
            <th className="px-3 py-2 font-medium">Lead</th>
            <th className="px-3 py-2 font-medium">Phase</th>
            <th className="px-3 py-2 font-medium">Health</th>
            <th className="px-3 py-2 font-medium">Target</th>
            <th className="px-3 py-2 font-medium">Next milestone</th>
            <th className="px-3 py-2 font-medium">Blockers</th>
            <th className="px-3 py-2 font-medium">Last update</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const nextMilestone = p.milestones[0];
            const lastUpdate = p.updates[0];
            return (
              <tr key={p.id} className="group relative border-b transition-colors last:border-0 hover:bg-accent/40">
                <td className="px-3 py-2">
                  <Link href={`/projects/${p.id}`} className="relative font-medium after:absolute after:inset-0 group-hover:underline">
                    {p.name}
                  </Link>
                  {p.status !== "ACTIVE" ? (
                    <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">{p.status}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2">{p.initiative.portfolioCompany?.name ?? "Specialist"}</td>
                {showLane ? <td className="px-3 py-2 text-xs">{LANE_LABELS[p.lane]}</td> : null}
                <td className="px-3 py-2">{p.lead?.name ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{p.currentPhase?.name ?? "—"}</td>
                <td className="px-3 py-2"><HealthBadge health={p.health} /></td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">
                  {p.targetDeploymentDate ? format(p.targetDeploymentDate, "MMM d") : "—"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {nextMilestone ? (
                    <>
                      {nextMilestone.name}
                      {nextMilestone.targetDate ? ` · ${format(nextMilestone.targetDate, "MMM d")}` : ""}
                    </>
                  ) : "—"}
                </td>
                <td className="px-3 py-2">
                  {p.tasks.length > 0 ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                      {p.tasks.length}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                  {lastUpdate ? formatDistanceToNow(lastUpdate.createdAt, { addSuffix: true }) : "never"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
