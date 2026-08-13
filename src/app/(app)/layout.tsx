import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { navForRoles } from "@/components/shell/nav-config";
import { SideNav } from "@/components/shell/side-nav";
import { TopBar } from "@/components/shell/top-bar";
import { CommandPalette } from "@/components/shell/command-palette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sections = navForRoles(session.user.roles);
  const { db } = await import("@/server/db");
  const unreadCount = await db.notification.count({
    where: { userId: session.user.id, readAt: null },
  });

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r bg-sidebar">
        <div className="sticky top-0 h-screen">
          <SideNav sections={sections} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar userName={session.user.name ?? session.user.email ?? ""} unreadCount={unreadCount} />
        <main className="flex-1 p-6">{children}</main>
      </div>
      <CommandPalette sections={sections} />
    </div>
  );
}
