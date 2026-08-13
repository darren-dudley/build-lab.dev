/** Appends updated BC reference versions where the new vintage mapping changed scores. */
import { db } from "@/server/db";
import { deriveBcInputs, DERIVATION_NOTE } from "@/server/admin/bc-derive";
import { computeBcPriority } from "@/server/scoring/engine";

async function main() {
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@build-lab.dev" } });
  const companies = await db.portfolioCompany.findMany({
    where: { isActive: true, deletedAt: null, equityCheckUsd: { not: null }, valueUsd: { not: null } },
    include: { investmentRefs: { orderBy: { version: "desc" }, take: 1 } },
  });
  const peerChecks = companies.map((c) => c.equityCheckUsd!);
  const peerValues = companies.map((c) => c.valueUsd!);

  let updated = 0;
  for (const c of companies) {
    const inputs = deriveBcInputs({
      equityCheckUsd: c.equityCheckUsd!, valueUsd: c.valueUsd!,
      fundNumber: c.fundNumber, peerChecks, peerValues,
    });
    const cur = c.investmentRefs[0];
    if (
      cur &&
      cur.checkSizeScore === inputs.checkSizeScore &&
      cur.remainingValueScore === inputs.remainingValueScore &&
      cur.runwayScore === inputs.runwayScore
    ) continue;
    await db.investmentPriorityReference.create({
      data: {
        companyId: c.id,
        version: (cur?.version ?? 0) + 1,
        effectiveDate: new Date(),
        ...inputs,
        calculatedPriority: computeBcPriority(inputs.checkSizeScore, inputs.remainingValueScore, inputs.runwayScore),
        adminNotes: `${DERIVATION_NOTE} Vintage mapping updated: XI=1, XII=2, XIII=4, XIV=5 (newer funds prioritized).`,
        createdById: admin.id,
      },
    });
    updated++;
  }
  console.log(`Appended updated references for ${updated} companies.`);
}
main().finally(() => db.$disconnect());
