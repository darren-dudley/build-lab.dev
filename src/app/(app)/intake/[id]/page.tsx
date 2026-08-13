import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { loadDraftData } from "@/server/intake";
import { IntakeForm } from "@/components/intake/intake-form";

export const metadata = { title: "Submit Initiative" };

export default async function IntakeDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const initiative = await db.initiative.findUnique({
    where: { id, deletedAt: null },
    select: { id: true, requestType: true, requesterId: true, status: true },
  });
  if (!initiative || initiative.requesterId !== session.user.id) notFound();
  if (initiative.status !== "DRAFT" && initiative.status !== "NEEDS_INFORMATION") {
    redirect(`/initiatives/${id}`);
  }

  const [companies, functions, workflows, systems, initial] = await Promise.all([
    db.portfolioCompany.findMany({
      where: { isActive: true, deletedAt: null, exitedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
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
      initiativeId={initiative.id}
      requestType={initiative.requestType}
      requesterName={session.user.name ?? ""}
      requesterEmail={session.user.email ?? ""}
      companies={companies.map((c) => ({ id: c.id, label: c.name }))}
      functions={functions}
      specialistWorkflows={workflows}
      systems={systems}
      initial={initial}
    />
  );
}
