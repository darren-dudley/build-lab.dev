import Link from "next/link";
import { redirect } from "next/navigation";
import { differenceInDays } from "date-fns";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";
import { getProjects } from "@/server/projects";
import { getCapacity } from "@/server/governance";
import { ProjectTable } from "@/components/project/project-table";
import { StartProjectDialog } from "@/components/project/start-project-dialog";
import { CapacityStrip } from "@/components/governance/capacity-strip";

export const metadata = { title: "Rapid Deployment" };

/*
 * Command center (spec §37): manage by exception. Top metrics answer "how much
 * and where"; the exceptions block surfaces what needs leadership attention
 * (blocked, overdue, stale, at-risk); the table carries the detail.
 */
export default async function RapidDeploymentPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "project.view")) redirect("/home");
  const canStart = hasPermission(session.user.roles, "project.start");

  const [projects, capacity, awaiting, readyToStart, deployedStatuses, leads] = await Promise.all([
    getProjects("RAPID_DEPLOYMENT"),
    getCapacity(),
    db.initiative.count({ where: { status: "APPROVED_AWAITING_CAPACITY", deletedAt: null } }),
    db.initiative.findMany({
      where: { deletedAt: null, status: "APPROVED_SCHEDULED", deliveryAssignment: { lane: "RAPID_DEPLOYMENT" }, project: null },
      include: {
        portfolioCompany: { select: { name: true } },
        scores: { where: { isCurrent: true }, take: 1, select: { compositeScore: true } },
      },
    }),
    db.initiative.groupBy({
      by: ["status"],
      where: { deletedAt: null, status: { in: ["DEPLOYED", "MEASURING_IMPACT"] }, project: { lane: "RAPID_DEPLOYMENT" } },
      _count: true,
    }),
    db.user.findMany({
      where: { isActive: true, deletedAt: null, roles: { some: { role: { in: ["DELIVERY", "ADMIN"] } } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const active = projects.filter((p) => p.status === "ACTIVE");
  const now = new Date();
  const blocked = active.filter((p) => p.tasks.length > 0);
  const inPilot = active.filter((p) => p.currentPhase?.name === "Pilot");
  const completed = projects.filter((p) => p.status === "COMPLETED");
  const deployed = deployedStatuses.find((s) => s.status === "DEPLOYED")?._count ?? 0;
  const measuring = deployedStatuses.find((s) => s.status === "MEASURING_IMPACT")?._count ?? 0;

  const exceptions: { project: (typeof active)[number]; reasons: string[] }[] = active
    .map((p) => {
      const reasons: string[] = [];
      if (p.tasks.length > 0) reasons.push(`${p.tasks.length} blocked task${p.tasks.length > 1 ? "s" : ""}`);
      if (p.health !== "GREEN") reasons.push(`health ${p.health.toLowerCase()}`);
      const lastUpdate = p.updates[0]?.createdAt;
      if (!lastUpdate || differenceInDays(now, lastUpdate) > 7) reasons.push("no update in 7+ days");
      if (p.targetDeploymentDate && p.targetDeploymentDate < now) reasons.push("past target date");
      const m = p.milestones[0];
      if (m?.targetDate && m.targetDate < now) reasons.push(`milestone overdue: ${m.name}`);
      return { project: p, reasons };
    })
    .filter((e) => e.reasons.length > 0);

  const stats: { label: string; value: number; href?: string }[] = [
    { label: "Active", value: active.length },
    { label: "Awaiting Capacity", value: awaiting, href: "/delivery/awaiting-capacity" },
    { label: "Starting Soon", value: readyToStart.length },
    { label: "Blocked", value: blocked.length },
    { label: "In Pilot", value: inPilot.length },
    { label: "Deployed", value: deployed },
    { label: "Measuring", value: measuring },
    { label: "Completed", value: completed.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Rapid Deployment</h1>
        <CapacityStrip capacity={capacity.filter((c) => c.lane === "RAPID_DEPLOYMENT")} compact />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {stats.map((s) => {
          const inner = (
            <div className="rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent/40">
              <div className="score-figure text-xl font-semibold">{s.value}</div>
              <div className="text-[11px] text-muted-foreground">{s.label}</div>
            </div>
          );
          return s.href ? <Link key={s.label} href={s.href}>{inner}</Link> : <div key={s.label}>{inner}</div>;
        })}
      </div>

      {exceptions.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Needs attention</h2>
          <ul className="divide-y rounded-md border border-amber-300/60 dark:border-amber-900">
            {exceptions.map(({ project: p, reasons }) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <Link href={`/projects/${p.id}`} className="text-sm font-medium hover:underline">
                  {p.name}
                </Link>
                <span className="text-xs text-amber-700 dark:text-amber-400">{reasons.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          No exceptions — all active projects are healthy, current, and unblocked.
        </div>
      )}

      {readyToStart.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Approved — ready to start</h2>
          <ul className="divide-y rounded-md border">
            {readyToStart.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <div className="min-w-0 text-sm">
                  <span className="font-medium">{i.name}</span>
                  <span className="text-muted-foreground">
                    {" "}· {i.portfolioCompany?.name ?? "Specialist"}
                    {i.scores[0] ? ` · score ${i.scores[0].compositeScore}` : ""}
                  </span>
                </div>
                {canStart ? <StartProjectDialog initiativeId={i.id} initiativeName={i.name} leads={leads} /> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ProjectTable projects={projects} showLane={false} />
    </div>
  );
}
