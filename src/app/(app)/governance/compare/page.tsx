import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";
import { DIMENSION_LABELS, EFFORT_LABELS, FLAG_LABELS, ttaLabel } from "@/lib/labels";
import { format } from "date-fns";

export const metadata = { title: "Compare Initiatives" };

/*
 * UX: answers "why should A be ahead of B?" — attributes as rows, initiatives
 * as columns, scores at top where the eye starts.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "governance.viewRanking")) redirect("/home");

  const { ids } = await searchParams;
  const idList = (ids ?? "").split(",").filter(Boolean).slice(0, 5);
  if (idList.length < 2) redirect("/governance/ranking");

  const initiatives = await db.initiative.findMany({
    where: { id: { in: idList }, deletedAt: null },
    include: {
      portfolioCompany: { select: { name: true } },
      function: { select: { label: true } },
      sponsor: { select: { name: true, title: true } },
      intakeResponse: true,
      triageReview: true,
      flags: { where: { resolvedAt: null } },
      scores: { where: { isCurrent: true }, take: 1, include: { components: true } },
      dataSources: true,
    },
  });
  // Preserve selection order
  const ordered = idList
    .map((id) => initiatives.find((i) => i.id === id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));

  const cols = `200px repeat(${ordered.length}, minmax(220px, 1fr))`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Compare</h1>
        <Link href="/governance/ranking" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to ranking
        </Link>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <div className="grid min-w-fit text-sm" style={{ gridTemplateColumns: cols }}>
          {/* Header row */}
          <Cell head />
          {ordered.map((i) => (
            <Cell key={i.id} head>
              <Link href={`/initiatives/${i.id}`} className="font-semibold hover:underline">{i.name}</Link>
              <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                {i.portfolioCompany?.name ?? "Specialist"} · {i.function?.label ?? "—"}
              </div>
            </Cell>
          ))}

          <Row label="Priority score" items={ordered.map((i) => {
            const s = i.scores[0];
            return s ? (
              <span className="text-lg font-semibold tabular-nums">{s.compositeScore}<span className="text-xs font-normal text-muted-foreground"> /100 {i.requestType === "SPECIALIST_SPECIALIST" ? "Specialist" : "Portfolio"}</span></span>
            ) : "—";
          })} />
          <Row label="Opportunity Quality" items={ordered.map((i) => i.scores[0] ? `${i.scores[0].opportunityQuality}/100` : "—")} />
          <Row label="BC Investment Priority" items={ordered.map((i) => i.scores[0]?.bcPriority != null ? `${i.scores[0].bcPriority.toFixed(2)}/5` : "—")} />
          {(["BUSINESS_IMPACT", "TIME_TO_ARTIFACT", "DATA_FEASIBILITY", "SPONSORSHIP", "STRATEGIC_FIT"] as const).map((dim) => (
            <Row key={dim} label={DIMENSION_LABELS[dim].label} items={ordered.map((i) => {
              const c = i.scores[0]?.components.find((c) => c.dimension === dim);
              return c ? `${c.value}/5` : "—";
            })} />
          ))}
          <Row label="Business problem" items={ordered.map((i) => i.triageReview?.normalizedProblem ?? i.intakeResponse?.businessProblem ?? "—")} wrap />
          <Row label="Proposed AI task" items={ordered.map((i) => i.triageReview?.normalizedAsk ?? i.intakeResponse?.aiTask ?? "—")} wrap />
          <Row label="Expected outcome" items={ordered.map((i) => i.intakeResponse?.successDefinition ?? "—")} wrap />
          <Row label="Time-to-Artifact" items={ordered.map((i) => ttaLabel(i.intakeResponse?.timeToArtifactValue, i.intakeResponse?.timeToArtifactUnit))} />
          <Row label="Requester effort" items={ordered.map((i) => i.intakeResponse?.effortEstimate ? EFFORT_LABELS[i.intakeResponse.effortEstimate] : "—")} />
          <Row label="Data considerations" items={ordered.map((i) =>
            i.dataSources.length > 0
              ? i.dataSources.map((s) => `${s.system} (${s.accessStatus.toLowerCase()})`).join(", ")
              : "—",
          )} wrap />
          <Row label="Sponsor" items={ordered.map((i) => i.sponsor ? `${i.sponsor.name}${i.sponsor.title ? `, ${i.sponsor.title}` : ""}` : "—")} />
          <Row label="Forcing event" items={ordered.map((i) =>
            i.intakeResponse?.forcingEvent
              ? `${i.intakeResponse.forcingEvent}${i.intakeResponse.forcingEventDate ? ` — ${format(i.intakeResponse.forcingEventDate, "MMM d, yyyy")}` : ""}`
              : "—",
          )} wrap />
          <Row label="Flags" items={ordered.map((i) =>
            i.flags.length > 0 ? i.flags.map((f) => FLAG_LABELS[f.flagType]).join(", ") : "None",
          )} wrap />
        </div>
      </div>
    </div>
  );
}

function Cell({ children, head }: { children?: React.ReactNode; head?: boolean }) {
  return (
    <div className={`border-b border-r px-3 py-2.5 last:border-r-0 ${head ? "bg-muted/40" : ""}`}>
      {children}
    </div>
  );
}

function Row({ label, items, wrap }: { label: string; items: React.ReactNode[]; wrap?: boolean }) {
  return (
    <>
      <div className="border-b border-r bg-muted/20 px-3 py-2.5 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      {items.map((item, i) => (
        <div key={i} className={`border-b border-r px-3 py-2.5 last:border-r-0 ${wrap ? "text-xs text-muted-foreground" : ""}`}>
          {item}
        </div>
      ))}
    </>
  );
}
