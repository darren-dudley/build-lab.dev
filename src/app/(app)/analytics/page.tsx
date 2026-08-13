import Link from "next/link";
import { redirect } from "next/navigation";
import { differenceInDays, format, subMonths, startOfMonth } from "date-fns";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";

export const metadata = { title: "Analytics" };

/*
 * Portfolio analytics (spec §39): actionable over decorative. Single-series
 * magnitude breakdowns use one hue with text-token labels (dataviz rules);
 * every number links to the view it summarizes where practical. Estimated
 * and validated value are never mixed.
 */
export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "governance.viewRanking")) redirect("/home");

  const now = new Date();
  const [initiatives, decisions, projects, validatedKpis, capacity] = await Promise.all([
    db.initiative.findMany({
      where: { deletedAt: null, status: { not: "DRAFT" } },
      include: {
        portfolioCompany: { select: { name: true } },
        function: { select: { label: true } },
        scores: { where: { isCurrent: true }, take: 1 },
        statusTransitions: { orderBy: { createdAt: "asc" } },
      },
    }),
    db.governanceDecision.findMany({ where: { isCurrent: true } }),
    db.project.findMany({ where: { deletedAt: null }, include: { initiative: { select: { statusTransitions: true } } } }),
    db.projectKPI.findMany({
      where: { valueType: "VALIDATED", currentResult: { not: null } },
      include: { project: { select: { id: true, name: true } } },
    }),
    db.capacitySetting.findMany(),
  ]);

  // Submissions by month (last 6)
  const months = Array.from({ length: 6 }, (_, k) => startOfMonth(subMonths(now, 5 - k)));
  const byMonth = months.map((m) => ({
    label: format(m, "MMM"),
    count: initiatives.filter((i) => i.submittedAt && startOfMonth(i.submittedAt).getTime() === m.getTime()).length,
  }));

  const countBy = (fn: (i: (typeof initiatives)[number]) => string | null) => {
    const map = new Map<string, number>();
    for (const i of initiatives) {
      const k = fn(i);
      if (k) map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  const byCompany = countBy((i) => i.portfolioCompany?.name ?? "Specialist (internal)");
  const byFunction = countBy((i) => i.function?.label ?? null);
  const byType = countBy((i) =>
    i.requestType === "SPECIALIST_SPECIALIST" ? "Specialist — Specialist"
    : i.requestType === "SPECIALIST_PORTCO" ? "Specialist — Portfolio Co."
    : "Generalist — Portfolio Co.",
  );

  // Scores
  const scored = initiatives.filter((i) => i.scores[0]);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, i) => s + i.scores[0]!.compositeScore, 0) / scored.length)
    : 0;
  const buckets = [
    { label: "80–100", min: 80, max: 100 },
    { label: "60–79", min: 60, max: 79 },
    { label: "40–59", min: 40, max: 59 },
    { label: "0–39", min: 0, max: 39 },
  ].map((b) => ({
    label: b.label,
    count: scored.filter((i) => {
      const s = i.scores[0]!.compositeScore;
      return s >= b.min && s <= b.max;
    }).length,
  }));

  // Governance
  const decided = decisions.length;
  const approvals = decisions.filter((d) => d.decision === "APPROVE" || d.decision === "APPROVE_AWAITING_CAPACITY").length;
  const approvalRate = decided ? Math.round((approvals / decided) * 100) : 0;

  // Cycle times (median days)
  const median = (xs: number[]) => {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const intakeToGov = median(
    initiatives
      .map((i) => {
        const sub = i.statusTransitions.find((t) => t.toStatus === "SUBMITTED");
        const gov = i.statusTransitions.find((t) => t.toStatus === "READY_FOR_GOVERNANCE");
        return sub && gov ? differenceInDays(gov.createdAt, sub.createdAt) : null;
      })
      .filter((d): d is number => d !== null),
  );
  const govToStart = median(
    projects
      .map((p) => {
        const gov = p.initiative.statusTransitions.find((t) => t.toStatus === "GOVERNANCE_REVIEW");
        return gov ? differenceInDays(p.startedAt, gov.createdAt) : null;
      })
      .filter((d): d is number => d !== null),
  );

  const backlog = initiatives.filter((i) =>
    ["SUBMITTED", "TRIAGE", "NEEDS_INFORMATION", "READY_FOR_GOVERNANCE", "GOVERNANCE_REVIEW"].includes(i.status),
  ).length;
  const activeByLane = capacity.map((c) => ({
    label: c.lane.replaceAll("_", " ").toLowerCase(),
    active: projects.filter((p) => p.lane === c.lane && p.status === "ACTIVE").length,
    capacity: c.capacity,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>

      {/* Headline tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Total submissions" value={initiatives.length} href="/initiatives" />
        <Tile label="Pipeline backlog" value={backlog} href="/triage" />
        <Tile label="Average score" value={avgScore} />
        <Tile label="Approval rate" value={`${approvalRate}%`} />
        <Tile label="Median intake → governance" value={intakeToGov != null ? `${intakeToGov}d` : "—"} />
        <Tile label="Median governance → start" value={govToStart != null ? `${govToStart}d` : "—"} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <BarBlock title="Submissions by month" rows={byMonth.map((m) => ({ label: m.label, value: m.count }))} />
        <BarBlock title="Score distribution" rows={buckets.map((b) => ({ label: b.label, value: b.count }))} />
        <BarBlock title="Submissions by company" rows={byCompany.map(([label, value]) => ({ label, value }))} />
        <BarBlock title="Submissions by function" rows={byFunction.map(([label, value]) => ({ label, value }))} />
        <BarBlock title="Submissions by request type" rows={byType.map(([label, value]) => ({ label, value }))} />
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Delivery capacity</h2>
          <ul className="space-y-2">
            {activeByLane.map((l) => (
              <li key={l.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{l.label}</span>
                  <span className="tabular-nums text-muted-foreground">{l.active} / {l.capacity}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (l.active / Math.max(1, l.capacity)) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Validated value</h2>
        <p className="text-xs text-muted-foreground">
          Only measured results appear here — estimates never mix into this table.
        </p>
        {validatedKpis.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
            No validated measurements yet. Results appear once deployed projects measure impact.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {validatedKpis.map((k) => (
              <li key={k.id}>
                <Link href={`/projects/${k.project.id}`} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm hover:bg-accent/40">
                  <span>
                    <span className="font-medium">{k.project.name}</span>
                    <span className="text-muted-foreground"> · {k.metric}</span>
                  </span>
                  <span className="text-right">{k.currentResult}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const inner = (
    <div className="rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent/40">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

/** Single-series magnitude breakdown: one hue, text-token labels, thin bars. */
function BarBlock({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[minmax(7rem,auto)_1fr_2rem] items-center gap-2 text-sm">
              <span className="truncate text-muted-foreground">{r.label}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
              <span className="text-right tabular-nums">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
