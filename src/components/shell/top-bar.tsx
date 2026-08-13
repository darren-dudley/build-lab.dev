import Link from "next/link";
import { signOut } from "@/server/auth";
import { Button } from "@/components/ui/button";

export function TopBar({ userName, unreadCount = 0 }: { userName: string; unreadCount?: number }) {
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <header className="flex h-12 items-center justify-between border-b px-4">
      <div className="text-sm text-muted-foreground" />
      <div className="flex items-center gap-3">
        <Link
          href="/notifications"
          className="relative rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Notifications
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount}
            </span>
          ) : null}
        </Link>
        <span className="text-sm text-muted-foreground">{userName}</span>
        <form action={logout}>
          <Button variant="ghost" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
