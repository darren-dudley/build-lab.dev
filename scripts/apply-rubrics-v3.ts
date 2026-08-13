/** Applies concrete, example-anchored rubrics (v3) for both models.
 * Style guide: Darren's Time-to-Artifact rubric (kept verbatim from v2).
 * Weights carried forward unchanged. Append-only versioning as always. */
import { db } from "@/server/db";

const PORTFOLIO = {
  BUSINESS_IMPACT: {
    "1": "Convenience for a few individuals; no measurable KPI or P&L movement (e.g. reformatting an internal report)",
    "2": "Time savings for a single team, hard to see beyond their workflow (e.g. drafting routine correspondence)",
    "3": "Measurable improvement to one function's KPI — hours, cost, or cycle time (e.g. QBR prep from 6 hours to 1)",
    "4": "Moves a company-level metric visible in monthly reporting — revenue, margin, churn, cost line (e.g. +50% claims-appeal capacity)",
    "5": "Changes company economics or competitive position; board-level visibility (e.g. pricing engine adding 1–2 margin points across all quotes)",
  },
  DATA_FEASIBILITY: {
    "1": "Required data doesn't exist, is on paper, or owner unknown/refusing; integrations would be built from scratch",
    "2": "Data exists but fragmented across systems with no API path; significant IT effort, owners unconfirmed",
    "3": "Sources and owners identified, but access unconfirmed or requires cleanup/manual exports (e.g. monthly GL extracts)",
    "4": "Access confirmed to primary systems via API or export; minor gaps or cleanup remain (e.g. CRM connected, one spreadsheet source)",
    "5": "All required data confirmed, API-accessible, clean, and current (e.g. Salesforce + warehouse already provisioned)",
  },
  SPONSORSHIP: {
    "1": "No named sponsor or outcome owner; a requester submitting an idea on their own",
    "2": "Sponsor named but unconfirmed or below director level; nobody owns the outcome metric",
    "3": "Confirmed director/VP sponsor and a named outcome owner, but no adoption plan or committed user time",
    "4": "Engaged VP/C-level sponsor who has committed team time; owner is accountable for the KPI it moves",
    "5": "CEO/CFO-level sponsor with a forcing event; end users asking for it; adoption written into someone's goals",
  },
  STRATEGIC_FIT: {
    "1": "One-off, company-specific workaround with no reuse anywhere (e.g. cleanup for a system being retired)",
    "2": "Mostly bespoke; only lessons learned carry over to other companies",
    "3": "Pattern usable at 2–3 portfolio companies with meaningful adaptation (same function, different systems)",
    "4": "Template for a common function across many companies with modest configuration (e.g. invoice coding for any NetSuite portco)",
    "5": "Playbook deployable portfolio-wide in waves; core to the AI value-creation thesis (e.g. QBR generation for every B2B portco)",
  },
};

const SPECIALIST = {
  BUSINESS_IMPACT: {
    "1": "Minor convenience for one person; no measurable time savings",
    "2": "Saves a few hours a month for a single specialist",
    "3": "Saves meaningful weekly time for a team or removes a recurring bottleneck (e.g. board pack assembly from 5 days to 1)",
    "4": "Changes the speed or quality of a core firm workflow (e.g. reporting cycle days shorter, screening throughput up)",
    "5": "Firm-level capability shift — materially more deals screened or portfolio insight that wasn't possible before",
  },
  DATA_FEASIBILITY: {
    "1": "Source material scattered, unstructured, or access-restricted; no clear owner",
    "2": "Material exists in internal systems but no established export or access path",
    "3": "Sources known and reachable, but need cleanup, structuring, or manual pulls",
    "4": "Access confirmed (Drive, Notion, data room, reporting systems); minor structuring remains",
    "5": "Clean, structured, already-accessible sources (e.g. instrumented systems or an existing warehouse)",
  },
  SPONSORSHIP: {
    "1": "Individual request with no partner or function-lead backing",
    "2": "Team lead is interested but hasn't committed the team to using it",
    "3": "Function head sponsors it; users identified but not yet engaged",
    "4": "Partner/MD sponsor; the team has committed to piloting and giving feedback",
    "5": "Firm-leadership priority; the team is asking for it and will change its workflow on day one",
  },
  STRATEGIC_FIT: {
    "1": "One specialist's personal workflow; nobody else would use it",
    "2": "Narrow single-team utility with limited leverage elsewhere",
    "3": "Useful to one full function firm-wide (e.g. all of FP&A)",
    "4": "Reusable across multiple specialist functions with light adaptation",
    "5": "Foundation capability the whole firm uses daily (e.g. knowledge search across all teams)",
  },
};

async function main() {
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@build-lab.dev" } });
  for (const [type, rubricUpdates] of [["PORTFOLIO", PORTFOLIO], ["SPECIALIST", SPECIALIST]] as const) {
    const model = await db.scoringModel.findUniqueOrThrow({
      where: { modelType: type },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    const current = model.versions[0];
    const rubrics = {
      ...(current.rubrics as Record<string, Record<string, string>>),
      ...rubricUpdates, // TIME_TO_ARTIFACT intentionally untouched (Darren's)
    };
    await db.scoringModelVersion.create({
      data: {
        modelId: model.id,
        version: current.version + 1,
        weights: current.weights as object,
        rubrics,
        createdById: admin.id,
      },
    });
    console.log(`${type}: v${current.version} → v${current.version + 1} (TTA preserved, weights unchanged)`);
  }
}
main().finally(() => db.$disconnect());
