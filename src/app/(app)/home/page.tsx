import { auth } from "@/server/auth";

export const metadata = { title: "Home" };

// Placeholder home — the role-aware home with stat row + Needs Attention
// sections is built in Phase 6, once the data it summarizes exists.
export default async function HomePage() {
  const session = await auth();
  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold tracking-tight">
        Welcome, {session?.user?.name?.split(" ")[0]}
      </h1>
      <p className="text-sm text-muted-foreground">
        The portfolio home view is coming online as intake, triage, and
        delivery data flow in.
      </p>
    </div>
  );
}
