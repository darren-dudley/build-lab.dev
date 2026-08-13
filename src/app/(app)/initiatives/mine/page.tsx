import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { StatusBadge } from "@/components/initiative/status-badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export const metadata = { title: "My Initiatives" };

/*
 * UX: Goal — requester sees everything they've submitted + external status.
 * Primary action — resume drafts / open initiatives. Needs-info items surface first.
 */
export default async function MyInitiativesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const initiatives = await db.initiative.findMany({
    where: { requesterId: session.user.id, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    include: { portfolioCompany: { select: { name: true } } },
  });

  const needsInfo = initiatives.filter((i) => i.status === "NEEDS_INFORMATION");
  const rest = initiatives.filter((i) => i.status !== "NEEDS_INFORMATION");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">My Initiatives</h1>
        <Button asChild size="sm">
          <Link href="/intake/new">Submit Initiative</Link>
        </Button>
      </div>

      {initiatives.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium">No initiatives yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Have an idea where AI could help? Submitting takes about 5–7 minutes.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/intake/new">Submit your first initiative</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {needsInfo.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Needs your response
              </div>
              <List items={needsInfo} />
            </div>
          ) : null}
          <List items={rest} />
        </div>
      )}
    </div>
  );
}

function List({
  items,
}: {
  items: Array<{
    id: string;
    name: string;
    status: import("@prisma/client").InitiativeStatus;
    updatedAt: Date;
    portfolioCompany: { name: string } | null;
  }>;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="divide-y rounded-md border">
      {items.map((i) => {
        const href = i.status === "DRAFT" ? `/intake/${i.id}` : `/initiatives/${i.id}`;
        return (
          <li key={i.id}>
            <Link
              href={href}
              className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent/40"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {i.name === "Untitled initiative" ? (
                    <span className="italic text-muted-foreground">Untitled draft</span>
                  ) : (
                    i.name
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {i.portfolioCompany?.name ?? "Specialist build"} · updated{" "}
                  {formatDistanceToNow(i.updatedAt, { addSuffix: true })}
                </div>
              </div>
              <StatusBadge status={i.status} external />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
