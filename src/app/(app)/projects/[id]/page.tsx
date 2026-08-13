import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HealthBadge } from "@/components/project/health-badge";
import { PhaseRail } from "@/components/project/phase-rail";
import { TaskList } from "@/components/project/task-list";
import { UpdateComposer } from "@/components/project/update-composer";
import { KpiTable } from "@/components/project/kpi-table";
import { LANE_LABELS } from "@/lib/lanes";

export const metadata = { title: "Project" };

/*
 * UX (docs §32): the overview answers Outcome / Metrics / Status / Next /
 * Blockers / Recent without task-level noise. Execution detail lives in tabs.
 */
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "project.view")) redirect("/home");
  const canManage = hasPermission(session.user.roles, "project.manage");
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id, deletedAt: null },
    include: {
      initiative: {
        include: {
          portfolioCompany: { select: { name: true } },
          function: { select: { label: true } },
          sponsor: { select: { name: true } },
          intakeResponse: { select: { successDefinition: true, aiTask: true, outcomeOwnerName: true, outcomeOwnerTitle: true } },
          triageReview: { select: { normalizedProblem: true, normalizedAsk: true } },
        },
      },
      lead: { select: { id: true, name: true } },
      currentPhase: true,
      phases: { orderBy: { sortOrder: "asc" } },
      tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }], include: { owner: { select: { name: true } }, phase: { select: { name: true } } } },
      milestones: { orderBy: { targetDate: "asc" } },
      updates: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      kpis: true,
      activityEvents: { orderBy: { createdAt: "desc" }, take: 20, include: { actor: { select: { name: true } } } },
    },
  });
  if (!project) notFound();

  const deliveryUsers = await db.user.findMany({
    where: { isActive: true, deletedAt: null, roles: { some: { role: { in: ["DELIVERY", "ADMIN"] } } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const blocked = project.tasks.filter((t) => t.status === "BLOCKED");
  const nextMilestone = project.milestones.find((m) => !m.completedAt);
  const latestUpdate = project.updates[0];
  const i = project.initiative;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
          <div className="flex items-center gap-3">
            <HealthBadge health={project.health} note={project.healthNote} />
            {project.status !== "ACTIVE" ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{project.status}</span>
            ) : null}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <Meta label="Company" value={i.portfolioCompany?.name ?? "Specialist"} />
          <Meta label="Function" value={i.function?.label ?? "—"} />
          <Meta label="Lane" value={LANE_LABELS[project.lane]} />
          <Meta label="Lead" value={project.lead?.name ?? "Unassigned"} />
          <Meta label="Business owner" value={i.intakeResponse?.outcomeOwnerName ?? "—"} />
          <Meta label="Target deployment" value={project.targetDeploymentDate ? format(project.targetDeploymentDate, "MMM d, yyyy") : "—"} />
        </dl>
        <PhaseRail
          projectId={project.id}
          phases={project.phases.map((p) => ({ id: p.id, name: p.name, sortOrder: p.sortOrder, completedAt: p.completedAt?.toISOString() ?? null }))}
          currentPhaseId={project.currentPhaseId}
          canManage={canManage}
        />
        <div className="text-xs text-muted-foreground">
          From initiative{" "}
          <Link href={`/initiatives/${i.id}`} className="underline underline-offset-2 hover:text-foreground">
            {i.name}
          </Link>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks{project.tasks.length ? ` (${project.tasks.length})` : ""}</TabsTrigger>
          <TabsTrigger value="updates">Updates{project.updates.length ? ` (${project.updates.length})` : ""}</TabsTrigger>
          <TabsTrigger value="kpis">KPIs</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-5">
          <Section title="Outcome">
            <p className="text-sm text-muted-foreground">
              {i.triageReview?.normalizedAsk ?? i.intakeResponse?.aiTask ?? "—"}
            </p>
            {i.intakeResponse?.successDefinition ? (
              <p className="mt-1 text-sm"><span className="text-muted-foreground">Success: </span>{i.intakeResponse.successDefinition}</p>
            ) : null}
          </Section>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border p-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current status</h3>
              {latestUpdate ? (
                <div className="mt-1.5 space-y-1 text-sm">
                  {latestUpdate.accomplished ? <p>{latestUpdate.accomplished}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    {latestUpdate.author.name} · {formatDistanceToNow(latestUpdate.createdAt, { addSuffix: true })}
                  </p>
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">No status updates yet.</p>
              )}
            </div>
            <div className="rounded-md border p-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next milestone</h3>
              {nextMilestone ? (
                <div className="mt-1.5 text-sm">
                  <span className="font-medium">{nextMilestone.name}</span>
                  {nextMilestone.targetDate ? (
                    <span className="text-muted-foreground"> — {format(nextMilestone.targetDate, "MMM d, yyyy")}</span>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">No open milestones.</p>
              )}
            </div>
          </div>

          <Section title="Blockers">
            {blocked.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing is blocked.</p>
            ) : (
              <ul className="space-y-1.5">
                {blocked.map((t) => (
                  <li key={t.id} className="rounded-md border border-red-200 bg-red-50/50 px-3 py-2 text-sm dark:border-red-900 dark:bg-red-950/20">
                    <span className="font-medium">{t.name}</span>
                    {t.blockerNote ? <span className="text-muted-foreground"> — {t.blockerNote}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recent activity">
            <ol className="space-y-1.5">
              {project.activityEvents.slice(0, 6).map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">
                    {format(e.createdAt, "MMM d, h:mm a")}
                  </span>
                  <span className="text-muted-foreground">{e.summary}</span>
                </li>
              ))}
            </ol>
          </Section>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <TaskList
            projectId={project.id}
            canManage={canManage}
            members={deliveryUsers}
            phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
            tasks={project.tasks.map((t) => ({
              id: t.id,
              name: t.name,
              status: t.status,
              ownerId: t.ownerId,
              ownerName: t.owner?.name ?? null,
              dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
              phaseId: t.phaseId,
              phaseName: t.phase?.name ?? null,
              priority: t.priority,
              blockerNote: t.blockerNote,
            }))}
          />
        </TabsContent>

        <TabsContent value="updates" className="mt-4 space-y-4">
          {canManage ? <UpdateComposer projectId={project.id} currentHealth={project.health} /> : null}
          {project.updates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No updates posted yet.</p>
          ) : (
            <ol className="space-y-4">
              {project.updates.map((u) => (
                <li key={u.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{u.author.name} · {format(u.createdAt, "MMM d, yyyy h:mm a")}</span>
                    <HealthBadge health={u.healthAtTime} className="text-xs" />
                  </div>
                  <div className="space-y-2 text-sm">
                    <UpdateBlock label="Accomplished" body={u.accomplished} />
                    <UpdateBlock label="Next" body={u.next} />
                    <UpdateBlock label="Risks / blockers" body={u.risks} />
                    <UpdateBlock label="Decisions needed" body={u.decisionsNeeded} />
                    <UpdateBlock label="KPI update" body={u.kpiUpdate} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="kpis" className="mt-4">
          <KpiTable
            projectId={project.id}
            canManage={canManage}
            kpis={project.kpis.map((k) => ({
              id: k.id,
              metric: k.metric,
              baseline: k.baseline,
              target: k.target,
              currentResult: k.currentResult,
              valueType: k.valueType,
              measuredAt: k.measuredAt ? k.measuredAt.toISOString().slice(0, 10) : null,
              methodology: k.methodology,
            }))}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ol className="space-y-2">
            {project.activityEvents.map((e) => (
              <li key={e.id} className="flex gap-3 text-sm">
                <span className="w-32 shrink-0 text-xs text-muted-foreground">
                  {format(e.createdAt, "MMM d, h:mm a")}
                </span>
                <span>
                  {e.summary}
                  {e.actor ? <span className="text-muted-foreground"> — {e.actor.name}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-1.5 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function UpdateBlock({ label, body }: { label: string; body: string | null }) {
  if (!body) return null;
  return (
    <div>
      <span className="text-xs font-medium text-muted-foreground">{label}: </span>
      {body}
    </div>
  );
}
