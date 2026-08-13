import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";
import { ReferenceForm } from "@/components/admin/reference-form";

export const metadata = { title: "Investment Priority" };

/*
 * BC Investment Priority reference data (spec §21): admin-maintained,
 * refreshed ~quarterly, versioned per company. Requesters never see this;
 * scoring joins the version current at scoring time and retains it forever.
 */
export default async function InvestmentPriorityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "admin.investmentPriority")) redirect("/home");

  const companies = await db.portfolioCompany.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { name: "asc" },
    include: {
      investmentRefs: { orderBy: [{ effectiveDate: "desc" }, { version: "desc" }] },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">BC Investment Priority</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Three 1–5 inputs per company, averaged — contributes 35% of every
          Portfolio Priority Score. Updates create new versions; scores retain
          the version they used.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 text-right font-medium">Equity Check</th>
              <th className="px-3 py-2 text-right font-medium">Remaining Value</th>
              <th className="px-3 py-2 text-right font-medium">Runway</th>
              <th className="px-3 py-2 text-right font-medium">BC Priority</th>
              <th className="px-3 py-2 font-medium">Effective</th>
              <th className="px-3 py-2 text-right font-medium">Version</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const ref = c.investmentRefs[0];
              return (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  {ref ? (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums">{ref.checkSizeScore}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{ref.remainingValueScore}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{ref.runwayScore}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {ref.calculatedPriority.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {format(ref.effectiveDate, "MMM d, yyyy")}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">v{ref.version}</td>
                    </>
                  ) : (
                    <td colSpan={6} className="px-3 py-2 text-amber-700 dark:text-amber-400">
                      No reference data — portfolio initiatives for this company can&apos;t be scored yet
                    </td>
                  )}
                  <td className="px-3 py-2 text-right">
                    <ReferenceForm
                      companyId={c.id}
                      companyName={c.name}
                      current={ref ? { checkSizeScore: ref.checkSizeScore, remainingValueScore: ref.remainingValueScore, runwayScore: ref.runwayScore } : undefined}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
