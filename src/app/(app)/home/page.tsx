import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow, subDays, startOfQuarter } from "date-fns";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";
import { StatusBadge } from "@/components/initiative/status-badge";
import { HealthBadge } from "@/components/project/health-badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Home" };

/*
 * Role-aware home (spec §7): the stat row answers the seven leadership
 * questions; each number drills into its filtered view; sections below are
 * actionable, not decorative, and render only for roles that can act on them.
 */
export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const roles = session.user.roles;
  const can = {
    triage: hasPermission(roles, "triage.review"),
    governance: hasPermission(roles, "governance.decide"),
    ranking: hasPermission(roles, "governance.viewRanking"),
    projects: hasPermission(roles, "project.view"),
    internal: hasPermission(roles, "initiative.viewAll"),
  };
  const now = new Date();

  // Requester-only home
  if (!can.internal) {
    const mine = await db.initiative.findMany({
      where: { requesterId: session.user.id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 8,
    });
    const needsInfo = mine.filter((i) => i.status === "NEEDS_INFORMATION");
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">
            Welcome, {session.user.name?.split(" ")[0]}
          </h1>
          <Button asChild size="sm"><Link href="/intake/new">Submit Initiative</Link></Button>
        </div>
        {needsInfo.length > 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50/60 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
            <span className="font-medium">The team needs more information</span> on{" "}
            {needsInfo.map((i, idx) => (
              <span key={i.id}>
                {idx > 0 ? ", " : ""}
                <Link href={`/initiatives/${i.id}`} className="underline underline-offset-2">{i.name}</Link>
              </span>
            ))}
            .
          </div>
        ) : null}
        {mine.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Your recent initiatives</h2>
            <ul className="divide-y rounded-md border">
              {mine.map((i) => (
                <li key={i.id}>
                  <Link href={i.status === "DRAFT" ? `/intake/${i.id}` : `/initiatives/${i.id}`}
                    className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-accent/40">
                    <span className="truncate font-medium">{i.name}</span>
                    <StatusBadge status={i.status} external />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Have an idea where AI could help? Submitting takes about 5–7 minutes.
          </p>
        )}
      </div>
    );
  }

  // Internal home
  const [
    newSubmissions, awaitingTriage, readyForGov, awaitingCapacity,
    activeProjects, blockedProjects, deployedQuarter, validatedKpis,
    topUnassigned, decisionReady, blockedList, recentDeployed,
  ] = await Promise.all([
    db.initiative.count({ where: { deletedAt: null, submittedAt: { gte: subDays(now, 7) } } }),
    db.initiative.count({ where: { deletedAt: null, status: { in: ["SUBMITTED", "TRIAGE"] } } }),
    db.initiative.count({ where: { deletedAt: null, status: { in: ["READY_FOR_GOVERNANCE", "GOVERNANCE_REVIEW"] } } }),
    db.initiative.count({ where: { deletedAt: null, status: "APPROVED_AWAITING_CAPACITY" } }),
    db.project.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    db.project.count({ where: { deletedAt: null, status: "ACTIVE", tasks: { some: { status: "BLOCKED" } } } }),
    db.initiative.count({
      where: { deletedAt: null, status: { in: ["DEPLOYED", "MEASURING_IMPACT", "COMPLETED"] }, project: { startedAt: { gte: startOfQuarter(now) } } },
    }),
    db.projectKPI.count({ where: { valueType: "VALIDATED", currentResult: { not: null } } }),
    db.initiative.findMany({
      where: { deletedAt: null, status: { in: ["READY_FOR_GOVERNANCE", "GOVERNANCE_REVIEW"] } },
      include: {
        portfolioCompany: { select: { name: true } },
        scores: { where: { isCurrent: true }, take: 1, select: { compositeScore: true } },
      },
    }),
    db.initiative.count({ where: { deletedAt: null, status: "READY_FOR_GOVERNANCE" } }),
    db.task.findMany({
      where: { status: "BLOCKED", project: { status: "ACTIVE", deletedAt: null } },
      include: { project: { select: { id: true, name: true } } },
      take: 6,
    }),
    db.project.findMany({
      where: { deletedAt: null, OR: [{ status: "COMPLETED" }, { initiative: { status: { in: ["DEPLOYED", "MEASURING_IMPACT"] } } }] },
      orderBy: { updatedAt: "desc" },
      take: 4,
      include: { initiative: { select: { id: true, portfolioCompany: { select: { name: true } } } } },
    }),
  ]);

  const topRanked = topUnassigned
    .filter((i) => i.scores[0])
    .sort((a, b) => (b.scores[0]?.compositeScore ?? 0) - (a.scores[0]?.compositeScore ?? 0))
    .slice(0, 5);

  const stats = [
    { label: "New Submissions (7d)", value: newSubmissions, href: "/initiatives" },
    { label: "Awaiting Triage", value: awaitingTriage, href: "/triage" },
    { label: "Ready for Governance", value: readyForGov, href: "/governance" },
    { label: "Awaiting Capacity", value: awaitingCapacity, href: "/delivery/awaiting-capacity" },
    { label: "Active Projects", value: activeProjects, href: "/projects" },
    { label: "Blocked Projects", value: blockedProjects, href: "/delivery/rapid-deployment" },
    { label: "Deployed This Quarter", value: deployedQuarter, href: "/projects" },
    { label: "Validated KPIs", value: validatedKpis, href: "/analytics" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">
          Welcome, {session.user.name?.split(" ")[0]}
        </h1>
        <Button asChild size="sm" variant="outline"><Link href="/intake/new">Submit Initiative</Link></Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <div className="rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent/40">
              <div className="score-figure text-xl font-semibold">{s.value}</div>
              <div className="text-[11px] leading-tight text-muted-foreground">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {can.ranking && topRanked.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Highest-priority undecided initiatives</h2>
            <ul className="divide-y rounded-md border">
              {topRanked.map((i) => (
                <li key={i.id}>
                  <Link href={`/initiatives/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-accent/40">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{i.name}</span>
                      <span className="text-muted-foreground"> · {i.portfolioCompany?.name ?? "Specialist"}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{i.scores[0]?.compositeScore}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {can.governance && decisionReady > 0 ? (
              <p className="text-xs text-muted-foreground">
                {decisionReady} awaiting a decision in the{" "}
                <Link href="/governance" className="underline underline-offset-2">Governance Queue</Link>.
              </p>
            ) : null}
          </section>
        ) : null}

        {can.projects ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Current blockers</h2>
            {blockedList.length === 0 ? (
              <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
                All active projects are currently moving.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {blockedList.map((t) => (
                  <li key={t.id}>
                    <Link href={`/projects/${t.project.id}`} className="block px-4 py-2.5 text-sm hover:bg-accent/40">
                      <span className="font-medium">{t.project.name}</span>
                      <span className="text-muted-foreground"> — {t.name}</span>
                      {t.blockerNote ? (
                        <span className="block text-xs text-red-700 dark:text-red-400">{t.blockerNote}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>

      {can.projects && recentDeployed.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Recently deployed & completed</h2>
          <ul className="divide-y rounded-md border">
            {recentDeployed.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-accent/40">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground"> · {p.initiative.portfolioCompany?.name ?? "Specialist"}</span>
                  </span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <HealthBadge health={p.health} className="text-xs" />
                    {formatDistanceToNow(p.updatedAt, { addSuffix: true })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
