import { notFound, redirect } from "next/navigation";
import type { DeliveryLane } from "@prisma/client";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";
import { getProjects } from "@/server/projects";
import { getCapacity } from "@/server/governance";
import { ProjectTable } from "@/components/project/project-table";
import { StartProjectDialog } from "@/components/project/start-project-dialog";
import { CapacityStrip } from "@/components/governance/capacity-strip";
import { LANE_LABELS } from "@/lib/lanes";

const SLUG_TO_LANE: Record<string, DeliveryLane> = {
  "rapid-deployment": "RAPID_DEPLOYMENT",
  "fde-pod": "EXTERNAL_FDE_POD",
  "core-transformation": "CORE_TRANSFORMATION",
};

export function generateStaticParams() {
  return Object.keys(SLUG_TO_LANE).map((lane) => ({ lane }));
}

export default async function LanePage({ params }: { params: Promise<{ lane: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "project.view")) redirect("/home");
  const { lane: slug } = await params;
  const lane = SLUG_TO_LANE[slug];
  if (!lane) notFound();

  const canStart = hasPermission(session.user.roles, "project.start");

  const [projects, capacity, readyToStart, leads] = await Promise.all([
    getProjects(lane),
    getCapacity(),
    db.initiative.findMany({
      where: {
        deletedAt: null,
        status: "APPROVED_SCHEDULED",
        deliveryAssignment: { lane },
        project: null,
      },
      include: {
        portfolioCompany: { select: { name: true } },
        scores: { where: { isCurrent: true }, take: 1, select: { compositeScore: true } },
      },
    }),
    db.user.findMany({
      where: { isActive: true, deletedAt: null, roles: { some: { role: { in: ["DELIVERY", "ADMIN"] } } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">{LANE_LABELS[lane]}</h1>
        <CapacityStrip capacity={capacity.filter((c) => c.lane === lane)} compact />
      </div>

      {readyToStart.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Approved — ready to start</h2>
          <ul className="divide-y rounded-md border">
            {readyToStart.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <div className="min-w-0 text-sm">
                  <span className="font-medium">{i.name}</span>
                  <span className="text-muted-foreground">
                    {" "}· {i.portfolioCompany?.name ?? "Specialist"}
                    {i.scores[0] ? ` · score ${i.scores[0].compositeScore}` : ""}
                  </span>
                </div>
                {canStart ? (
                  <StartProjectDialog initiativeId={i.id} initiativeName={i.name} leads={leads} />
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Starting a project is always a human decision — nothing starts automatically when capacity opens.
          </p>
        </div>
      ) : null}

      <ProjectTable projects={projects} showLane={false} />
    </div>
  );
}
