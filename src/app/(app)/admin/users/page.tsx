import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";
import { UserForm } from "@/components/admin/user-form";

export const metadata = { title: "Users" };

const ROLE_LABELS: Record<string, string> = {
  REQUESTER: "Requester", TRIAGE: "Triage", GOVERNANCE: "Governance",
  DELIVERY: "Delivery", ADMIN: "Admin",
};

export default async function UsersAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "admin.users")) redirect("/home");

  const users = await db.user.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: { roles: true },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Users</h1>
        <UserForm />
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Roles</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{u.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-3 py-2 text-muted-foreground">{u.title ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span key={r.role} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {ROLE_LABELS[r.role]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {u.isActive ? (
                    <span className="text-xs text-green-700 dark:text-green-400">Active</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Disabled</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <UserForm user={{
                    id: u.id, name: u.name, email: u.email, title: u.title,
                    roles: u.roles.map((r) => r.role), isActive: u.isActive,
                  }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        There is no public registration — access is granted here only. Public
        intake submissions at /submit don&apos;t require accounts.
      </p>
    </div>
  );
}
