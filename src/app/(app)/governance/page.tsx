import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/server/auth";
import { hasPermission } from "@/server/rbac/permissions";
import { getCapacity, getGovernanceQueue } from "@/server/governance";
import { DecisionPanel } from "@/components/governance/decision-panel";
import { CapacityStrip } from "@/components/governance/capacity-strip";
import { StatusBadge } from "@/components/initiative/status-badge";
import { DIMENSION_LABELS, EFFORT_LABELS, FLAG_LABELS, ttaLabel } from "@/lib/labels";

export const metadata = { title: "Governance Queue" };

/*
 * UX (docs/02): each initiative understandable within seconds — identity,
 * problem, ask, scores, flags, sponsor, forcing event at a glance; evidence
 * expands in place; the decision is one click away. No form navigation.
 */
export default async function GovernanceQueuePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "governance.decide")) redirect("/home");

  const [queue, capacity] = await Promise.all([getGovernanceQueue(), getCapacity()]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Governance Queue</h1>
        <CapacityStrip capacity={capacity} compact />
      </div>

      {queue.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium">Nothing is waiting on governance.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Initiatives appear here when triage marks them ready.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((i) => {
            const score = i.scores[0];
            const isPortfolio = i.requestType !== "SPECIALIST_SPECIALIST";
            const problem = i.triageReview?.normalizedProblem ?? "";
            const ask = i.triageReview?.normalizedAsk ?? "";
            return (
              <div key={i.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/initiatives/${i.id}`} className="font-medium hover:underline">
                        {i.name}
                      </Link>
                      <StatusBadge status={i.status} />
                      {i.flags.map((f) => (
                        <span key={f.id} title={f.note ?? undefined}
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          {FLAG_LABELS[f.flagType]}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {i.portfolioCompany?.name ?? "Specialist"} · {i.function?.label ?? "—"}
                      {i.sponsor ? <> · Sponsor: {i.sponsor.name}</> : null}
                      {" · "}TTA {ttaLabel(i.intakeResponse?.timeToArtifactValue, i.intakeResponse?.timeToArtifactUnit)}
                      {" · "}Effort {i.intakeResponse?.effortEstimate ? EFFORT_LABELS[i.intakeResponse.effortEstimate] : "—"}
                    </div>
                    {i.intakeResponse?.forcingEvent ? (
                      <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        Forcing event: {i.intakeResponse.forcingEvent}
                        {i.intakeResponse.forcingEventDate ? ` — ${format(i.intakeResponse.forcingEventDate, "MMM d")}` : ""}
                      </div>
                    ) : null}
                    {problem ? <p className="text-sm text-muted-foreground">{problem}</p> : null}
                    {ask ? <p className="text-sm"><span className="text-muted-foreground">AI task: </span>{ask}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {score ? (
                      <div className="text-right">
                        <div className="score-figure text-xl font-semibold">{score.compositeScore}</div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {isPortfolio ? "Portfolio" : "Specialist"} score
                        </div>
                      </div>
                    ) : null}
                    <DecisionPanel initiativeId={i.id} initiativeName={i.name} capacity={capacity} />
                  </div>
                </div>

                {score ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      Score breakdown{isPortfolio && score.bcPriority != null
                        ? ` — Opportunity Quality ${score.opportunityQuality}/100 · BC Priority ${score.bcPriority.toFixed(2)}/5`
                        : ""}
                    </summary>
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {score.components.map((c) => (
                        <div key={c.id} className="flex items-baseline justify-between gap-3 rounded-md border px-3 py-1.5 text-xs">
                          <span>{DIMENSION_LABELS[c.dimension].label}</span>
                          <span className="font-medium tabular-nums">{c.value}/5</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Compare initiatives side-by-side from the{" "}
        <Link href="/governance/ranking" className="underline underline-offset-2">Portfolio Ranking</Link>.
      </p>
    </div>
  );
}
