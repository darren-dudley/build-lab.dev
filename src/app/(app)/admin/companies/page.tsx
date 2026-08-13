import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";
import { CompanyForm } from "@/components/admin/company-form";
import { ImportCompaniesDialog } from "@/components/admin/import-companies-dialog";

export const metadata = { title: "Portfolio Companies" };

function money(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${Math.round(v / 1e6)}M`;
  return `$${Math.round(v).toLocaleString()}`;
}

export default async function CompaniesAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "admin.companies")) redirect("/home");

  const companies = await db.portfolioCompany.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { initiatives: true } },
    },
  });
  const refs = await db.investmentPriorityReference.findMany({
    orderBy: [{ effectiveDate: "desc" }, { version: "desc" }],
    distinct: ["companyId"],
  });
  const refByCompany = new Map(refs.map((r) => [r.companyId, r]));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Portfolio Companies</h1>
        <div className="flex gap-2">
          <ImportCompaniesDialog />
          <CompanyForm />
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Fund</th>
              <th className="px-3 py-2 text-right font-medium">Equity Check</th>
              <th className="px-3 py-2 text-right font-medium">Value</th>
              <th className="px-3 py-2 text-right font-medium">Initiatives</th>
              <th className="px-3 py-2 text-right font-medium">BC Priority</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const ref = refByCompany.get(c.id);
              return (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2">{c.fundNumber ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(c.equityCheckUsd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(c.valueUsd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c._count.initiatives}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {ref ? ref.calculatedPriority.toFixed(2) : (
                      <span className="text-amber-700 dark:text-amber-400">missing</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {c.isActive ? (
                      <span className="text-xs text-green-700 dark:text-green-400">Active</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <CompanyForm company={{ id: c.id, name: c.name, sector: c.sector, fundNumber: c.fundNumber, equityCheckUsd: c.equityCheckUsd, valueUsd: c.valueUsd, isActive: c.isActive }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Equity check size, remaining value, and runway are managed under{" "}
        <a href="/admin/investment-priority" className="underline underline-offset-2">Investment Priority</a>{" "}
        — companies marked <span className="text-amber-700 dark:text-amber-400">missing</span> can&apos;t
        be scored until reference data exists.
      </p>
    </div>
  );
}
