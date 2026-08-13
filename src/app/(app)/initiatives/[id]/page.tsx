import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac";
import { StatusBadge } from "@/components/initiative/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommentThread } from "@/components/shared/comment-thread";
import { format } from "date-fns";
import { REQUEST_TYPES, ACCESS_STATUS_OPTIONS } from "@/lib/intake-schema";

export const metadata = { title: "Initiative" };

/*
 * UX (docs/02): header answers identity questions at a glance; tabs disclose
 * progressively. Overview synthesizes — it never redisplays the raw form.
 * Requesters see external status + their own submission; internal roles see more.
 */
export default async function InitiativeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const { submitted } = await searchParams;

  const initiative = await db.initiative.findUnique({
    where: { id, deletedAt: null },
    include: {
      requester: { select: { name: true, email: true } },
      portfolioCompany: { select: { name: true } },
      function: { select: { label: true } },
      sponsor: true,
      intakeResponse: true,
      kpis: true,
      dataSources: true,
      systems: { include: { system: { select: { label: true } } } },
      scores: { where: { isCurrent: true }, take: 1 },
      activityEvents: { orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { name: true } } } },
    },
  });
  if (!initiative) notFound();

  const isOwner = initiative.requesterId === session.user.id;
  const internal = hasPermission(session.user.roles, "initiative.viewAll");
  if (!isOwner && !internal) notFound();

  const comments = await db.comment.findMany({
    where: { entityType: "INITIATIVE", entityId: id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true } } },
  });

  const r = initiative.intakeResponse;
  const requestTypeLabel = REQUEST_TYPES.find((t) => t.value === initiative.requestType)?.label;
  const score = initiative.scores[0];
  const tta = r?.timeToArtifactValue
    ? `${r.timeToArtifactValue} ${r.timeToArtifactUnit?.toLowerCase()}`
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {submitted ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          Initiative submitted. The triage team will review it — you&apos;ll be
          notified if anything else is needed, and you can track status here.
        </div>
      ) : null}

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">{initiative.name}</h1>
          <StatusBadge status={initiative.status} external={!internal} />
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <HeaderItem label={initiative.portfolioCompany ? "Company" : "Specialist"}
            value={initiative.portfolioCompany?.name ?? r?.specialistWorkflow ?? "—"} />
          <HeaderItem label="Function" value={initiative.function?.label ?? "—"} />
          <HeaderItem
            label="Requester"
            value={initiative.requester?.name ?? initiative.requesterName ?? "—"}
          />
          <HeaderItem label="Sponsor" value={initiative.sponsor?.name ?? "—"} />
          <HeaderItem label="Request type" value={requestTypeLabel ?? "—"} />
          <HeaderItem label="Submitted"
            value={initiative.submittedAt ? format(initiative.submittedAt, "MMM d, yyyy") : "—"} />
          {internal ? (
            <HeaderItem label="Priority score"
              value={score ? String(score.compositeScore) : "Not yet scored"} />
          ) : null}
        </dl>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="intake">Intake</TabsTrigger>
          <TabsTrigger value="discussion">
            Discussion{comments.length ? ` (${comments.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-5">
          <Section title="Business problem" body={r?.businessProblem} />
          <Section title="Proposed AI task" body={r?.aiTask} />
          <Section title="What success looks like (90 days)" body={r?.successDefinition} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Time-to-Artifact" value={tta ?? "—"} />
            <Stat label="Requester effort estimate" value={r?.effortEstimate ?? "—"} />
            <Stat label="Outcome owner"
              value={r?.outcomeOwnerName ? `${r.outcomeOwnerName}${r.outcomeOwnerTitle ? `, ${r.outcomeOwnerTitle}` : ""}` : "—"} />
          </div>
          {r?.forcingEvent || r?.forcingEventDate ? (
            <div className="rounded-md border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              <span className="font-medium">Forcing event: </span>
              {r.forcingEvent}
              {r.forcingEventDate ? ` — ${format(r.forcingEventDate, "MMM d, yyyy")}` : ""}
              {r.forcingConsequence ? `. If missed: ${r.forcingConsequence}` : ""}
            </div>
          ) : null}
          {initiative.kpis.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-medium">Metrics</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1.5 pr-4 font-medium">Metric</th>
                    <th className="py-1.5 pr-4 font-medium">Baseline</th>
                    <th className="py-1.5 font-medium">Desired result</th>
                  </tr>
                </thead>
                <tbody>
                  {initiative.kpis.map((k) => (
                    <tr key={k.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-4">{k.metric}</td>
                      <td className="py-1.5 pr-4">{k.noBaseline ? "No baseline" : k.baseline || "—"}</td>
                      <td className="py-1.5">{k.target || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="intake" className="mt-4 space-y-5">
          <p className="text-xs text-muted-foreground">
            The requester&apos;s original submission
            {r?.lockedAt ? ` — locked ${format(r.lockedAt, "MMM d, yyyy")} and preserved as the historical record.` : "."}
          </p>
          <Section title="Business problem" body={r?.businessProblem} />
          <Section title="How it works today" body={r?.currentProcess} />
          <Section title="What AI should do" body={r?.aiTask} />
          <Section title="90-day success" body={r?.successDefinition} />
          <Section title="Prior attempts"
            body={r?.priorAttempts ? `${r.priorAttempts}${r.priorAttemptsDetail ? ` — ${r.priorAttemptsDetail}` : ""}` : null} />
          {initiative.dataSources.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-medium">Data sources</h2>
              <ul className="space-y-1 text-sm">
                {initiative.dataSources.map((s) => (
                  <li key={s.id} className="flex items-baseline gap-2">
                    <span className="font-medium">{s.system}</span>
                    {s.dataType ? <span className="text-muted-foreground">{s.dataType}</span> : null}
                    <span className="text-xs text-muted-foreground">
                      {ACCESS_STATUS_OPTIONS.find((o) => o.value === s.accessStatus)?.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {initiative.systems.length > 0 ? (
            <div>
              <h2 className="mb-1 text-sm font-medium">Systems involved</h2>
              <p className="text-sm text-muted-foreground">
                {initiative.systems.map((s) => s.system?.label ?? s.otherLabel).filter(Boolean).join(", ")}
              </p>
            </div>
          ) : null}
          <Section title="Only initiative this quarter?"
            body={r?.onlyOneAnswer ? `${r.onlyOneAnswer}${r.onlyOneWhy ? ` — ${r.onlyOneWhy}` : ""}` : null} />
          <Section title="Additional context" body={r?.finalContext} />
        </TabsContent>

        <TabsContent value="discussion" className="mt-4">
          <CommentThread
            entityType="INITIATIVE"
            entityId={initiative.id}
            comments={comments.map((c) => ({
              id: c.id,
              authorName: c.author.name,
              body: c.body,
              createdAt: c.createdAt.toISOString(),
            }))}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {initiative.activityEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="space-y-3">
              {initiative.activityEvents.map((e) => (
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HeaderItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Section({ title, body }: { title: string; body?: string | null }) {
  if (!body) return null;
  return (
    <div>
      <h2 className="mb-1 text-sm font-medium">{title}</h2>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
