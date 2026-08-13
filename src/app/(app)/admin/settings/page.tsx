import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";

export const metadata = { title: "Settings & Audit" };

const PAGE_SIZE = 50;

/*
 * Settings hub + audit trail (spec §47): append-only record of every
 * consequential change — submissions, scores, config, decisions, assignments,
 * project changes, KPI updates.
 */
export default async function SettingsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "admin.audit")) redirect("/home");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [events, total] = await Promise.all([
    db.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { name: true } } },
    }),
    db.auditEvent.count(),
  ]);
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings & Audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configuration lives in its own sections:{" "}
          <Link href="/admin/scoring" className="underline underline-offset-2">Scoring</Link>,{" "}
          <Link href="/admin/investment-priority" className="underline underline-offset-2">Investment Priority</Link>,{" "}
          <Link href="/admin/capacity" className="underline underline-offset-2">Capacity</Link>,{" "}
          <Link href="/admin/taxonomies" className="underline underline-offset-2">Taxonomies</Link>.
        </p>
      </div>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Audit history</h2>
          <span className="text-xs text-muted-foreground">{total} events (append-only)</span>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Entity</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-3 py-1.5 text-xs text-muted-foreground">
                    {format(e.createdAt, "MMM d, HH:mm:ss")}
                  </td>
                  <td className="px-3 py-1.5">{e.actor?.name ?? <span className="text-muted-foreground">public</span>}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{e.action}</td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">{e.entityType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 ? (
          <div className="flex items-center gap-2 text-sm">
            {page > 1 ? (
              <Link className="underline underline-offset-2" href={`/admin/settings?page=${page - 1}`}>← Newer</Link>
            ) : null}
            <span className="text-xs text-muted-foreground">Page {page} of {pages}</span>
            {page < pages ? (
              <Link className="underline underline-offset-2" href={`/admin/settings?page=${page + 1}`}>Older →</Link>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
