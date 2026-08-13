import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";
import { ScoringEditor } from "@/components/admin/scoring-editor";

export const metadata = { title: "Scoring Configuration" };

/*
 * Scoring config (spec §20/§24): rubrics + weights are data, versioned.
 * Every save creates a new ScoringModelVersion; history is never mutated,
 * and existing scores keep pointing at the version that produced them.
 */
export default async function ScoringAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "admin.scoring")) redirect("/home");

  const models = await db.scoringModel.findMany({
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
      _count: { select: { versions: true } },
    },
    orderBy: { modelType: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Scoring Configuration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the 1–5 rubric for each dimension and the model weights. Changes
          apply to new scores only — historical scores retain their version.
        </p>
      </div>
      {models.map((m) => {
        const v = m.versions[0];
        return (
          <ScoringEditor
            key={m.id}
            modelId={m.id}
            modelName={m.name}
            modelType={m.modelType}
            version={v.version}
            initialWeights={v.weights as Record<string, number>}
            initialRubrics={v.rubrics as Record<string, Record<string, string>>}
          />
        );
      })}
    </div>
  );
}
