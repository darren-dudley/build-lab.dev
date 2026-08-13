import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { formatDistanceToNow } from "date-fns";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const notifications = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = notifications.filter((n) => !n.readAt).length;

  async function markAllRead() {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;
    await db.notification.updateMany({
      where: { userId: s.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath("/notifications");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Notifications</h1>
        {unread > 0 ? (
          <form action={markAllRead}>
            <Button size="sm" variant="outline" type="submit">Mark all read</Button>
          </form>
        ) : null}
      </div>
      {notifications.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium">You&apos;re all caught up.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Notifications about your initiatives and projects will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {notifications.map((n) => {
            const href =
              n.entityType === "INITIATIVE" ? `/initiatives/${n.entityId}`
              : n.entityType === "PROJECT" ? `/projects/${n.entityId}`
              : "#";
            return (
              <li key={n.id} className={cn(!n.readAt && "bg-accent/30")}>
                <Link href={href} className="block px-4 py-3 hover:bg-accent/40">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={cn("text-sm", !n.readAt && "font-medium")}>{n.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                  {n.body ? <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
