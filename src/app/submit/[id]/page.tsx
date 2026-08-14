import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { loadDraftData } from "@/server/intake";
import { IntakeForm } from "@/components/intake/intake-form";
import { StatusBadge } from "@/components/initiative/status-badge";

export const metadata = { title: "Submit an AI Initiative" };

/*
 * Public draft/status page. Only public (anonymous) initiatives are reachable
 * here — authenticated users' drafts live under /intake. While editable it
 * renders the form; after submission it becomes a lightweight status view.
 */
export default async function PublicDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initiative = await db.initiative.findUnique({
    where: { id, deletedAt: null },
    select: { id: true, name: true, requestType: true, requesterId: true, status: true, submittedAt: true },
  });
  if (!initiative || initiative.requesterId !== null) notFound();

  if (initiative.status !== "DRAFT" && initiative.status !== "NEEDS_INFORMATION") {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-12 text-center">
        <StatusBadge status={initiative.status} external />
        <h1 className="text-lg font-semibold tracking-tight">
          {initiative.name === "Untitled initiative" ? "Your initiative" : initiative.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Thanks, your submission is in. The team will review it and follow up
          by email. You can bookmark this page to check its status.
        </p>
      </div>
    );
  }

  const [companies, functions, workflows, systems, initial] = await Promise.all([
    db.portfolioCompany.findMany({
      where: { isActive: true, deletedAt: null, exitedAt: null },
      select: { id: true, name: true },
    }).then((cs) => cs.sort((a, b) => a.name.localeCompare(b.name))),
    db.taxonomyItem.findMany({
      where: { kind: "FUNCTION", isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true },
    }),
    db.taxonomyItem.findMany({
      where: { kind: "SPECIALIST_WORKFLOW", isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true },
    }),
    db.taxonomyItem.findMany({
      where: { kind: "SYSTEM", isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true },
    }),
    loadDraftData(id),
  ]);

  return (
    <IntakeForm
      publicMode
      initiativeId={initiative.id}
      requestType={initiative.requestType}
      requesterName=""
      requesterEmail=""
      companies={companies.map((c) => ({ id: c.id, label: c.name }))}
      functions={functions}
      specialistWorkflows={workflows}
      systems={systems}
      initial={initial}
    />
  );
}
