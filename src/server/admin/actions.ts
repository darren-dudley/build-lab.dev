"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/rbac";
import { db } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { computeBcPriority } from "@/server/scoring/engine";

/* ───────────────────────── Portfolio companies ───────────────────────── */

const companySchema = z.object({
  name: z.string().min(1).max(200),
  sector: z.string().max(200).optional().nullable(),
  fundNumber: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function upsertCompanyAction(companyId: string | null, raw: unknown) {
  const session = await requirePermission("admin.companies");
  const data = companySchema.parse(raw);
  const company = companyId
    ? await db.portfolioCompany.update({ where: { id: companyId }, data })
    : await db.portfolioCompany.create({ data: { ...data } });
  await db.$transaction((tx) =>
    writeAudit(tx, {
      actorId: session.user.id,
      action: companyId ? "admin.company.update" : "admin.company.create",
      entityType: "PORTFOLIO_COMPANY",
      entityId: company.id,
      after: data,
    }),
  );
  revalidatePath("/admin/companies");
  revalidatePath("/admin/investment-priority");
  return { ok: true as const };
}

/* ───────────────────────── BC Investment Priority ───────────────────────── */

const referenceSchema = z.object({
  checkSizeScore: z.number().int().min(1).max(5),
  remainingValueScore: z.number().int().min(1).max(5),
  runwayScore: z.number().int().min(1).max(5),
  effectiveDate: z.string(), // ISO date
  adminNotes: z.string().max(2000).optional(),
});

/**
 * Appends a NEW reference version for a company (never mutates old rows —
 * historical scores keep pointing at the version they used).
 */
export async function addInvestmentReferenceAction(companyId: string, raw: unknown) {
  const session = await requirePermission("admin.investmentPriority");
  const data = referenceSchema.parse(raw);
  const latest = await db.investmentPriorityReference.findFirst({
    where: { companyId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const calculated = computeBcPriority(
    data.checkSizeScore,
    data.remainingValueScore,
    data.runwayScore,
  );
  await db.$transaction(async (tx) => {
    const ref = await tx.investmentPriorityReference.create({
      data: {
        companyId,
        version: (latest?.version ?? 0) + 1,
        effectiveDate: new Date(data.effectiveDate),
        checkSizeScore: data.checkSizeScore,
        remainingValueScore: data.remainingValueScore,
        runwayScore: data.runwayScore,
        calculatedPriority: calculated,
        adminNotes: data.adminNotes ?? null,
        createdById: session.user.id,
      },
    });
    await writeAudit(tx, {
      actorId: session.user.id,
      action: "admin.investmentPriority.create",
      entityType: "INVESTMENT_PRIORITY_REFERENCE",
      entityId: ref.id,
      after: { companyId, version: ref.version, ...data, calculated },
    });
  });
  revalidatePath("/admin/investment-priority");
  return { ok: true as const, calculated };
}

/* ───────────────────────── Scoring configuration ───────────────────────── */

const DIMS = ["BUSINESS_IMPACT", "TIME_TO_ARTIFACT", "DATA_FEASIBILITY", "SPONSORSHIP", "STRATEGIC_FIT"] as const;

const rubricSchema = z.record(
  z.enum(DIMS),
  z.object({ "1": z.string(), "2": z.string(), "3": z.string(), "4": z.string(), "5": z.string() }),
);

const scoringUpdateSchema = z.object({
  weights: z.record(z.string(), z.number().int().min(0).max(100)),
  rubrics: rubricSchema,
});

/**
 * Creates a NEW ScoringModelVersion (spec §24 — config edits never mutate
 * history). Weights are validated: total 100; BC weight present only on the
 * portfolio model. New scores use the new version; old scores keep theirs.
 */
export async function createScoringVersionAction(modelId: string, raw: unknown) {
  const session = await requirePermission("admin.scoring");
  const data = scoringUpdateSchema.parse(raw);

  const model = await db.scoringModel.findUniqueOrThrow({ where: { id: modelId } });
  const bcWeight = data.weights.BC_INVESTMENT_PRIORITY ?? 0;
  const opWeight = DIMS.reduce((s, d) => s + (data.weights[d] ?? 0), 0);

  const errors: string[] = [];
  for (const d of DIMS) if (data.weights[d] === undefined) errors.push(`Missing weight: ${d}`);
  if (model.modelType === "PORTFOLIO" && bcWeight <= 0) {
    errors.push("Portfolio model requires a BC Investment Priority weight");
  }
  if (model.modelType === "SPECIALIST" && bcWeight !== 0) {
    errors.push("Specialist model must not have a BC weight");
  }
  if (opWeight + bcWeight !== 100) {
    errors.push(`Weights must total 100 (currently ${opWeight + bcWeight})`);
  }
  if (errors.length) return { ok: false as const, errors };

  const latest = await db.scoringModelVersion.findFirstOrThrow({
    where: { modelId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  await db.$transaction(async (tx) => {
    const v = await tx.scoringModelVersion.create({
      data: {
        modelId,
        version: latest.version + 1,
        weights: data.weights,
        rubrics: data.rubrics,
        createdById: session.user.id,
      },
    });
    await writeAudit(tx, {
      actorId: session.user.id,
      action: "admin.scoring.newVersion",
      entityType: "SCORING_MODEL_VERSION",
      entityId: v.id,
      after: { modelType: model.modelType, version: v.version, weights: data.weights },
    });
  });
  revalidatePath("/admin/scoring");
  return { ok: true as const };
}
