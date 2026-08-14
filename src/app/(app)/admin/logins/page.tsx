import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";

export const metadata = { title: "Login History" };

const PAGE_SIZE = 100;

/*
 * Append-only sign-in log: every successful login, newest first. Sourced from
 * the audit trail (action "user.login"). Failed attempts are not listed here
 * by design — those drive the lockout throttle, not this list.
 */
export default async function LoginHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "admin.users")) redirect("/home");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [events, total] = await Promise.all([
    db.auditEvent.findMany({
      where: { action: "user.login" },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { name: true, email: true } } },
    }),
    db.auditEvent.count({ where: { action: "user.login" } }),
  ]);
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Login History</h1>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
          ← Users
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Every successful sign-in, newest first. {total} total.
      </p>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No logins recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const meta = (e.after ?? {}) as { email?: string; ip?: string | null };
                return (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-3 py-1.5 text-xs">
                      {format(e.createdAt, "MMM d, yyyy · HH:mm:ss")}
                    </td>
                    <td className="px-3 py-1.5 font-medium">{e.actor?.name ?? "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{e.actor?.email ?? meta.email ?? "—"}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{meta.ip ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 ? (
            <Link className="underline underline-offset-2" href={`/admin/logins?page=${page - 1}`}>← Newer</Link>
          ) : null}
          <span className="text-xs text-muted-foreground">Page {page} of {pages}</span>
          {page < pages ? (
            <Link className="underline underline-offset-2" href={`/admin/logins?page=${page + 1}`}>Older →</Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
