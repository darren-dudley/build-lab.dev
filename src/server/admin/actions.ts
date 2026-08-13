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
  equityCheckUsd: z.number().nonnegative().optional().nullable(),
  valueUsd: z.number().nonnegative().optional().nullable(),
  isActive: z.boolean().optional(),
  exited: z.boolean().optional(),
});

/** Derives + appends a BC reference for a company from its financials. */
async function deriveReferenceFor(companyId: string, actorId: string) {
  const { deriveBcInputs, DERIVATION_NOTE } = await import("./bc-derive");
  const { computeBcPriority } = await import("@/server/scoring/engine");
  const company = await db.portfolioCompany.findUniqueOrThrow({ where: { id: companyId } });
  if (company.equityCheckUsd == null || company.valueUsd == null) return;
  const peers = await db.portfolioCompany.findMany({
    where: { isActive: true, deletedAt: null, exitedAt: null, equityCheckUsd: { not: null }, valueUsd: { not: null } },
    select: { equityCheckUsd: true, valueUsd: true },
  });
  const inputs = deriveBcInputs({
    equityCheckUsd: company.equityCheckUsd,
    valueUsd: company.valueUsd,
    fundNumber: company.fundNumber,
    peerChecks: peers.map((p) => p.equityCheckUsd!),
    peerValues: peers.map((p) => p.valueUsd!),
  });
  const latest = await db.investmentPriorityReference.findFirst({
    where: { companyId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  await db.investmentPriorityReference.create({
    data: {
      companyId,
      version: (latest?.version ?? 0) + 1,
      effectiveDate: new Date(),
      ...inputs,
      calculatedPriority: computeBcPriority(
        inputs.checkSizeScore, inputs.remainingValueScore, inputs.runwayScore,
      ),
      adminNotes: DERIVATION_NOTE,
      createdById: actorId,
    },
  });
}

export async function upsertCompanyAction(companyId: string | null, raw: unknown) {
  const session = await requirePermission("admin.companies");
  const { exited, ...data } = companySchema.parse(raw);
  const exitData = exited === undefined ? {} : { exitedAt: exited ? new Date() : null };
  const company = companyId
    ? await db.portfolioCompany.update({ where: { id: companyId }, data: { ...data, ...exitData } })
    : await db.portfolioCompany.create({ data: { ...data, ...exitData } });
  // First reference version auto-derives from financials when present
  const hasReference = await db.investmentPriorityReference.findFirst({
    where: { companyId: company.id },
    select: { id: true },
  });
  if (!hasReference) await deriveReferenceFor(company.id, session.user.id);
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

/**
 * Bulk import from pasted rows (copy out of a spreadsheet or PDF table).
 * Accepts tab- or comma-separated lines: Name, Fund, Equity Check, Value.
 * Existing companies (by name) are updated; new ones created. Each imported
 * company gets a derived BC reference version.
 */
export async function importCompaniesAction(pasted: string) {
  const session = await requirePermission("admin.companies");
  const text = z.string().min(1).max(100_000).parse(pasted);

  const parseMoney = (s: string) => {
    const n = Number(s.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const rows: { name: string; fund: string | null; check: number | null; value: number | null }[] = [];
  const errors: string[] = [];
  for (const [idx, lineRaw] of text.split("\n").entries()) {
    const line = lineRaw.trim();
    if (!line) continue;
    const parts = line.includes("\t") ? line.split("\t") : line.split(",");
    const cells = parts.map((p) => p.trim()).filter((p) => p !== "");
    if (cells.length < 1) continue;
    if (/^portfolio company$/i.test(cells[0])) continue; // header row
    const [name, fund, check, value] = [cells[0], cells[1] ?? null, cells[2] ?? null, cells[3] ?? null];
    if (name.length > 200) {
      errors.push(`Line ${idx + 1}: name too long`);
      continue;
    }
    rows.push({
      name,
      fund,
      check: check ? parseMoney(check) : null,
      value: value ? parseMoney(value) : null,
    });
  }
  if (rows.length === 0) return { ok: false as const, errors: ["No rows found", ...errors] };

  let createdCount = 0;
  let updatedCount = 0;
  for (const r of rows) {
    const existing = await db.portfolioCompany.findUnique({ where: { name: r.name } });
    const data = {
      fundNumber: r.fund ?? undefined,
      equityCheckUsd: r.check ?? undefined,
      valueUsd: r.value ?? undefined,
      isActive: true,
    };
    const company = existing
      ? await db.portfolioCompany.update({ where: { id: existing.id }, data })
      : await db.portfolioCompany.create({ data: { name: r.name, ...data } });
    if (existing) updatedCount++;
    else createdCount++;
    if (r.check != null && r.value != null) {
      await deriveReferenceFor(company.id, session.user.id);
    }
  }
  await db.$transaction((tx) =>
    writeAudit(tx, {
      actorId: session.user.id,
      action: "admin.company.import",
      entityType: "PORTFOLIO_COMPANY",
      entityId: "bulk",
      after: { created: createdCount, updated: updatedCount, errors },
    }),
  );
  revalidatePath("/admin/companies");
  revalidatePath("/admin/investment-priority");
  return { ok: true as const, created: createdCount, updated: updatedCount, errors };
}

/** One-click exit marking (also available via the company edit form). */
export async function markCompanyExitedAction(companyId: string, exited: boolean) {
  const session = await requirePermission("admin.companies");
  const company = await db.portfolioCompany.update({
    where: { id: companyId },
    data: { exitedAt: exited ? new Date() : null },
  });
  await db.$transaction((tx) =>
    writeAudit(tx, {
      actorId: session.user.id,
      action: exited ? "admin.company.exit" : "admin.company.unexit",
      entityType: "PORTFOLIO_COMPANY",
      entityId: company.id,
      after: { name: company.name, exited },
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
