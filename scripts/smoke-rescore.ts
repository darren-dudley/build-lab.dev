/** Verifies append-only score history: re-scoring keeps the old row + version refs. */
import { db } from "@/server/db";
import { scoreInitiative } from "@/server/scoring";

async function main() {
  const i = await db.initiative.findFirstOrThrow({
    where: { name: "Sales-call preparation briefs" },
    include: { scores: true },
  });
  const before = i.scores.length;
  const scorer = await db.user.findUniqueOrThrow({ where: { email: "tara.chen@build-lab.dev" } });
  await scoreInitiative({
    initiativeId: i.id, scorerId: scorer.id,
    components: [
      { dimension: "BUSINESS_IMPACT", value: 4 }, { dimension: "TIME_TO_ARTIFACT", value: 5 },
      { dimension: "DATA_FEASIBILITY", value: 4 }, { dimension: "SPONSORSHIP", value: 4 },
      { dimension: "STRATEGIC_FIT", value: 5 },
    ],
  });
  const after = await db.initiativeScore.findMany({
    where: { initiativeId: i.id }, orderBy: { scoredAt: "asc" },
  });
  console.log("history grew:", after.length === before + 1 ? "OK" : "FAIL");
  console.log("exactly one current:", after.filter((s) => s.isCurrent).length === 1 ? "OK" : "FAIL");
  console.log("old row retained w/ model version:", after[0].modelVersionId ? "OK" : "FAIL");
  console.log("bc reference retained:", after.every((s) => s.investmentPriorityReferenceId) ? "OK" : "FAIL");
}
main().finally(() => db.$disconnect());
