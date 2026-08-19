import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";
import {
  getCurrentInvestmentReference, getCurrentModelVersion, modelTypeFor,
} from "@/server/scoring";
import { ScoringPanel } from "@/components/triage/scoring-panel";
import { StatusBadge } from "@/components/initiative/status-badge";
import { EFFORT_LABELS, ttaLabel } from "@/lib/labels";
import { ACCESS_STATUS_OPTIONS, BUDGET_LABELS } from "@/lib/intake-schema";

export const metadata = { title: "Triage" };

/*
 * UX (docs/02): split workspace. Left — the immutable submission and context
 * the reviewer reads. Right — everything the reviewer does: normalize, score
 * against inline rubrics, flag, then mark ready or bounce back for info.
 */
export default async function TriageWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "triage.review")) redirect("/home");
  const { id } = await params;

  const initiative = await db.initiative.findUnique({
    where: { id, deletedAt: null },
    include: {
      portfolioCompany: { select: { id: true, name: true } },
      function: { select: { label: true } },
      requester: { select: { name: true, email: true } },
      sponsor: true,
      intakeResponse: true,
      kpis: true,
      dataSources: true,
      systems: { include: { system: { select: { label: true } } } },
      flags: { where: { resolvedAt: null } },
      triageReview: true,
      scores: {
        where: { isCurrent: true },
        take: 1,
        include: { components: true },
      },
    },
  });
  if (!initiative) notFound();

  const modelType = modelTypeFor(initiative.requestType);
  const isPortfolio = modelType === "PORTFOLIO";
  const version = await getCurrentModelVersion(modelType);
  const bcRef = isPortfolio && initiative.portfolioCompany
    ? await getCurrentInvestmentReference(initiative.portfolioCompany.id)
    : null;

  const r = initiative.intakeResponse;
  const score = initiative.scores[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/triage" className="text-sm text-muted-foreground hover:text-foreground">
            ← Queue
          </Link>
          <h1 className="truncate text-lg font-semibold tracking-tight">{initiative.name}</h1>
          <StatusBadge status={initiative.status} />
        </div>
        <Link
          href={`/initiatives/${initiative.id}`}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Full record
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Left: submission */}
        <div className="min-w-0 space-y-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-md border bg-muted/20 p-4 text-sm sm:grid-cols-3">
            <Item label={isPortfolio ? "Company" : "Specialist workflow"}
              value={initiative.portfolioCompany?.name ?? r?.specialistWorkflow ?? "—"} />
            <Item label="Function" value={initiative.function?.label ?? "—"} />
            <Item label="Requester"
              value={initiative.requester?.name ?? initiative.requesterName ?? "—"} />
            <Item label="Sponsor" value={initiative.sponsor?.name ?? "—"} />
            <Item label="Submitted"
              value={initiative.submittedAt ? format(initiative.submittedAt, "MMM d, yyyy") : "—"} />
            <Item label="Effort / TTA"
              value={`${r?.effortEstimate ? EFFORT_LABELS[r.effortEstimate] : "—"} · ${ttaLabel(r?.timeToArtifactValue, r?.timeToArtifactUnit)}`} />
            <Item label="Rough budget" value={r?.budgetRange ? BUDGET_LABELS[r.budgetRange] : "—"} />
          </dl>

          <Block title="Business problem" body={r?.businessProblem} />
          <Block title="How it works today" body={r?.currentProcess} />
          <Block title="What AI should do" body={r?.aiTask} />
          <Block title="90-day success" body={r?.successDefinition} />
          {initiative.kpis.length > 0 ? (
            <div>
              <h2 className="mb-1 text-sm font-medium">Metrics</h2>
              <ul className="space-y-0.5 text-sm text-muted-foreground">
                {initiative.kpis.map((k) => (
                  <li key={k.id}>
                    {k.metric}: {k.noBaseline ? "no baseline" : k.baseline || "—"} → {k.target || "—"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {initiative.dataSources.length > 0 ? (
            <div>
              <h2 className="mb-1 text-sm font-medium">Data sources</h2>
              <ul className="space-y-0.5 text-sm text-muted-foreground">
                {initiative.dataSources.map((s) => (
                  <li key={s.id}>
                    {s.system}
                    {s.dataType ? ` — ${s.dataType}` : ""} ·{" "}
                    {ACCESS_STATUS_OPTIONS.find((o) => o.value === s.accessStatus)?.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {initiative.systems.length > 0 ? (
            <Block
              title="Systems"
              body={initiative.systems.map((s) => s.system?.label ?? s.otherLabel).filter(Boolean).join(", ")}
            />
          ) : null}
          <Block title="Prior attempts"
            body={r?.priorAttempts ? `${r.priorAttempts}${r.priorAttemptsDetail ? ` — ${r.priorAttemptsDetail}` : ""}` : null} />
          <Block title="Only initiative this quarter?"
            body={r?.onlyOneAnswer ? `${r.onlyOneAnswer}${r.onlyOneWhy ? ` — ${r.onlyOneWhy}` : ""}` : null} />
          {r?.forcingEvent || r?.forcingEventDate ? (
            <Block title="Forcing event"
              body={`${r.forcingEvent ?? ""}${r.forcingEventDate ? ` — ${format(r.forcingEventDate, "MMM d, yyyy")}` : ""}${r.forcingConsequence ? `. If missed: ${r.forcingConsequence}` : ""}`} />
          ) : null}
          <Block title="Additional context" body={r?.finalContext} />
        </div>

        {/* Right: actions */}
        <div className="lg:border-l lg:pl-8">
          <ScoringPanel
            initiativeId={initiative.id}
            status={initiative.status}
            isPortfolio={isPortfolio}
            rubrics={version.rubrics as Record<string, Record<string, string>>}
            weights={version.weights as Record<string, number>}
            bcReference={
              bcRef
                ? {
                    priority: bcRef.calculatedPriority,
                    checkSize: bcRef.checkSizeScore,
                    remainingValue: bcRef.remainingValueScore,
                    runway: bcRef.runwayScore,
                    effectiveDate: format(bcRef.effectiveDate, "MMM d, yyyy"),
                  }
                : null
            }
            currentScore={
              score
                ? {
                    composite: score.compositeScore,
                    opportunityQuality: score.opportunityQuality,
                    bcPriority: score.bcPriority,
                    components: score.components.map((c) => ({
                      dimension: c.dimension,
                      value: c.value,
                      rationale: c.rationale,
                    })),
                  }
                : null
            }
            review={initiative.triageReview}
            activeFlags={initiative.flags.map((f) => ({ flagType: f.flagType, note: f.note }))}
          />
        </div>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Block({ title, body }: { title: string; body?: string | null }) {
  if (!body) return null;
  return (
    <div>
      <h2 className="mb-1 text-sm font-medium">{title}</h2>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
