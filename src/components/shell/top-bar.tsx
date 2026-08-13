import { signOut } from "@/server/auth";
import { Button } from "@/components/ui/button";

export function TopBar({ userName }: { userName: string }) {
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <header className="flex h-12 items-center justify-between border-b px-4">
      {/* Global search + command palette land in Phase 3 with the data layer */}
      <div className="text-sm text-muted-foreground" />
      <div className="flex items-center gap-3">
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
