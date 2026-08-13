import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";
import { getRankedPortfolio } from "@/server/governance";
import { PortfolioTable, type PortfolioRow } from "@/components/governance/portfolio-table";
import { statusLabel } from "@/server/workflow/transitions";
import { EFFORT_LABELS, ttaLabel } from "@/lib/labels";
import { LANE_LABELS } from "@/lib/lanes";

export const metadata = { title: "Portfolio Ranking" };

const DECISION_LABELS: Record<string, string> = {
  APPROVE: "Approved",
  APPROVE_AWAITING_CAPACITY: "Approved — Awaiting Capacity",
  DEFER: "Deferred",
  MORE_INFORMATION: "More Info Requested",
  REJECT: "Rejected",
};

export default async function PortfolioRankingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "governance.viewRanking")) redirect("/home");

  const [portfolio, savedViews] = await Promise.all([
    getRankedPortfolio(),
    db.savedView.findMany({
      where: { userId: session.user.id, tableKey: "portfolio-ranking" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows: PortfolioRow[] = portfolio.map((i) => {
    const s = i.scores[0]!;
    return {
      id: i.id,
      name: i.name,
      company: i.portfolioCompany?.name ?? null,
      functionLabel: i.function?.label ?? null,
      scoreType: i.requestType === "SPECIALIST_SPECIALIST" ? "Specialist" : "Portfolio",
      composite: s.compositeScore,
      opportunityQuality: s.opportunityQuality,
      bcPriority: s.bcPriority,
      tta: ttaLabel(i.intakeResponse?.timeToArtifactValue, i.intakeResponse?.timeToArtifactUnit),
      effort: i.intakeResponse?.effortEstimate ? EFFORT_LABELS[i.intakeResponse.effortEstimate] : "—",
      status: i.status,
      statusLabel: statusLabel(i.status),
      decision: i.governanceDecisions[0] ? DECISION_LABELS[i.governanceDecisions[0].decision] : null,
      assignment: i.deliveryAssignment ? LANE_LABELS[i.deliveryAssignment.lane] : null,
      flagCount: i.flags.length,
      sponsor: i.sponsor?.name ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Portfolio Ranking</h1>
        <p className="text-sm text-muted-foreground">
          Every scored initiative, ranked. Portfolio and Specialist scores share
          this view but are not economically comparable — the type badge stays visible.
        </p>
      </div>
      <PortfolioTable
        rows={rows}
        savedViews={savedViews.map((v) => ({
          id: v.id,
          name: v.name,
          config: v.config as Record<string, unknown>,
        }))}
      />
    </div>
  );
}
