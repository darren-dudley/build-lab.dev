/**
 * Foundation seed (Phase 1): identity, reference data, scoring config.
 * Initiative/project seed data is added by later phases (see docs/05).
 *
 * Idempotent: uses upserts keyed on natural unique fields.
 * Demo user passwords come from SEED_PASSWORD (required).
 */
import { PrismaClient, RoleType, TaxonomyKind, DeliveryLane, ScoringModelType } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { hash } from "bcryptjs";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const SEED_PASSWORD = process.env.SEED_PASSWORD;

const USERS: { email: string; name: string; title: string; roles: RoleType[] }[] = [
  { email: "admin@build-lab.dev", name: "Alex Admin", title: "Platform Administrator", roles: [RoleType.ADMIN, RoleType.REQUESTER] },
  { email: "tara.chen@build-lab.dev", name: "Tara Chen", title: "AI Program Lead", roles: [RoleType.TRIAGE, RoleType.REQUESTER] },
  { email: "marcus.webb@build-lab.dev", name: "Marcus Webb", title: "AI Triage Analyst", roles: [RoleType.TRIAGE, RoleType.REQUESTER] },
  { email: "elena.vasquez@build-lab.dev", name: "Elena Vasquez", title: "Managing Director", roles: [RoleType.GOVERNANCE, RoleType.REQUESTER] },
  { email: "james.okafor@build-lab.dev", name: "James Okafor", title: "Operating Partner", roles: [RoleType.GOVERNANCE, RoleType.REQUESTER] },
  { email: "priya.nair@build-lab.dev", name: "Priya Nair", title: "Head of Value Creation", roles: [RoleType.GOVERNANCE, RoleType.TRIAGE, RoleType.REQUESTER] },
  { email: "dan.kowalski@build-lab.dev", name: "Dan Kowalski", title: "Rapid Deployment Lead", roles: [RoleType.DELIVERY, RoleType.REQUESTER] },
  { email: "sofia.rossi@build-lab.dev", name: "Sofia Rossi", title: "Forward Deployed Engineer", roles: [RoleType.DELIVERY, RoleType.REQUESTER] },
  { email: "leo.tanaka@build-lab.dev", name: "Leo Tanaka", title: "Forward Deployed Engineer", roles: [RoleType.DELIVERY, RoleType.REQUESTER] },
  { email: "maya.johnson@build-lab.dev", name: "Maya Johnson", title: "Sales Operations Specialist", roles: [RoleType.REQUESTER] },
  { email: "carlos.mendez@build-lab.dev", name: "Carlos Mendez", title: "FP&A Specialist", roles: [RoleType.REQUESTER] },
  { email: "grace.liu@build-lab.dev", name: "Grace Liu", title: "Portfolio Generalist", roles: [RoleType.REQUESTER] },
  { email: "sam.patel@build-lab.dev", name: "Sam Patel", title: "Portfolio Generalist", roles: [RoleType.REQUESTER] },
];

const COMPANIES: { name: string; sector: string; bc: [number, number, number] }[] = [
  { name: "Meridian Logistics", sector: "Supply Chain & Logistics", bc: [5, 4, 4] },
  { name: "Cobalt Health Partners", sector: "Healthcare Services", bc: [4, 5, 5] },
  { name: "Northwind Insurance Group", sector: "Insurance", bc: [5, 3, 2] },
  { name: "Vantage Building Products", sector: "Industrial Manufacturing", bc: [3, 4, 4] },
  { name: "Clearwater Foods", sector: "Food & Beverage", bc: [4, 3, 3] },
  { name: "Summit Dental Alliance", sector: "Healthcare Services", bc: [3, 5, 5] },
  { name: "Atlas Field Services", sector: "Facility Services", bc: [4, 4, 3] },
  { name: "Brightline Media", sector: "Media & Marketing", bc: [2, 3, 2] },
  { name: "Harbor Freight Brokerage", sector: "Transportation", bc: [3, 3, 4] },
  { name: "Pinewood Hospitality", sector: "Hospitality", bc: [2, 4, 5] },
];

const FUNCTIONS = ["Sales", "Marketing", "Finance", "Operations", "HR / People", "Product", "Technology / Engineering", "Customer Service", "Legal / Compliance", "Procurement", "Other"];

const SPECIALIST_WORKFLOWS = ["Talent & Recruiting", "Marketing", "Digital", "Artificial Intelligence", "Operations", "Finance", "IT", "Cyber Security", "Sales & GTM"];

const SYSTEMS = ["Salesforce", "HubSpot", "NetSuite", "QuickBooks", "SAP", "Oracle", "Workday", "ADP", "Zendesk", "ServiceNow", "Microsoft 365", "Google Workspace", "Slack", "Snowflake", "Tableau", "Power BI", "Shopify", "Stripe", "Notion", "Airtable"];

const VALUE_LEVERS = ["Revenue", "Cost", "Margin", "Productivity", "Customer Experience", "Quality", "Risk", "Speed", "Strategic Capability", "Other"];

const TAGS = ["PMC automation", "Sales-call preparation", "Financial variance analysis", "Customer-service agent", "Document generation", "Knowledge search", "Churn prediction", "Pricing analysis", "Contract review", "Content generation", "Recruiting workflow"];

const DIMENSIONS = ["BUSINESS_IMPACT", "TIME_TO_ARTIFACT", "DATA_FEASIBILITY", "SPONSORSHIP", "STRATEGIC_FIT"] as const;

function draftRubric(dimension: string): Record<string, string> {
  const names: Record<string, [string, string]> = {
    BUSINESS_IMPACT: ["minimal measurable outcome", "transformative, company-level outcome"],
    TIME_TO_ARTIFACT: ["6+ months to a usable artifact", "usable artifact within days to 2 weeks"],
    DATA_FEASIBILITY: ["data inaccessible, fragmented, or unavailable", "data accessible, clean, and confirmed"],
    SPONSORSHIP: ["no clear owner or sponsor", "committed executive sponsor and engaged owner"],
    STRATEGIC_FIT: ["one-off with no reuse potential", "core strategic use case, highly repeatable"],
  };
  const [low, high] = names[dimension];
  return {
    "1": `DRAFT — pending official rubric: ${low}.`,
    "2": "DRAFT — pending official rubric: below average.",
    "3": "DRAFT — pending official rubric: moderate.",
    "4": "DRAFT — pending official rubric: strong.",
    "5": `DRAFT — pending official rubric: ${high}.`,
  };
}

const RD_PHASES = ["Discovery", "Solution Design", "Data / Access", "Build", "QA", "User Testing", "Pilot", "Production", "Measurement", "Complete"];

async function main() {
  if (!SEED_PASSWORD) throw new Error("SEED_PASSWORD env var is required");
  const passwordHash = await hash(SEED_PASSWORD, 10);

  // Users + roles
  for (const u of USERS) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: { name: u.name, title: u.title },
      create: { email: u.email, name: u.name, title: u.title, passwordHash },
    });
    for (const role of u.roles) {
      await db.userRole.upsert({
        where: { userId_role: { userId: user.id, role } },
        update: {},
        create: { userId: user.id, role },
      });
    }
  }
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@build-lab.dev" } });

  // Portfolio companies + BC Investment Priority reference v1
  for (const c of COMPANIES) {
    const company = await db.portfolioCompany.upsert({
      where: { name: c.name },
      update: { sector: c.sector },
      create: { name: c.name, sector: c.sector },
    });
    const [checkSize, remaining, runway] = c.bc;
    await db.investmentPriorityReference.upsert({
      where: { companyId_version: { companyId: company.id, version: 1 } },
      update: {},
      create: {
        companyId: company.id,
        version: 1,
        effectiveDate: new Date("2026-07-01"),
        checkSizeScore: checkSize,
        remainingValueScore: remaining,
        runwayScore: runway,
        calculatedPriority: Math.round(((checkSize + remaining + runway) / 3) * 100) / 100,
        adminNotes: "Initial Q3 2026 reference data (seed).",
        createdById: admin.id,
      },
    });
  }

  // Taxonomies
  const tax: [TaxonomyKind, string[]][] = [
    [TaxonomyKind.FUNCTION, FUNCTIONS],
    [TaxonomyKind.SPECIALIST_WORKFLOW, SPECIALIST_WORKFLOWS],
    [TaxonomyKind.SYSTEM, SYSTEMS],
    [TaxonomyKind.VALUE_LEVER, VALUE_LEVERS],
    [TaxonomyKind.TAG, TAGS],
  ];
  for (const [kind, labels] of tax) {
    for (const [i, label] of labels.entries()) {
      await db.taxonomyItem.upsert({
        where: { kind_label: { kind, label } },
        update: { sortOrder: i },
        create: { kind, label, sortOrder: i },
      });
    }
  }

  // Scoring models + v1 versions (weights per docs/04; rubrics are labeled drafts)
  const models: { type: ScoringModelType; name: string; weights: Record<string, number> }[] = [
    {
      type: ScoringModelType.PORTFOLIO,
      name: "Portfolio Priority Score",
      weights: { BUSINESS_IMPACT: 17, TIME_TO_ARTIFACT: 17, DATA_FEASIBILITY: 13, SPONSORSHIP: 9, STRATEGIC_FIT: 9, BC_INVESTMENT_PRIORITY: 35 },
    },
    {
      type: ScoringModelType.SPECIALIST,
      name: "Specialist Priority Score",
      weights: { BUSINESS_IMPACT: 27, TIME_TO_ARTIFACT: 27, DATA_FEASIBILITY: 20, SPONSORSHIP: 13, STRATEGIC_FIT: 13 },
    },
  ];
  for (const m of models) {
    const model = await db.scoringModel.upsert({
      where: { modelType: m.type },
      update: {},
      create: { modelType: m.type, name: m.name },
    });
    const rubrics = Object.fromEntries(DIMENSIONS.map((d) => [d, draftRubric(d)]));
    await db.scoringModelVersion.upsert({
      where: { modelId_version: { modelId: model.id, version: 1 } },
      update: {},
      create: { modelId: model.id, version: 1, weights: m.weights, rubrics, createdById: admin.id },
    });
  }

  // Capacity settings
  const capacities: [DeliveryLane, number][] = [
    [DeliveryLane.RAPID_DEPLOYMENT, 10],
    [DeliveryLane.EXTERNAL_FDE_POD, 5],
    [DeliveryLane.CORE_TRANSFORMATION, 3],
  ];
  for (const [lane, capacity] of capacities) {
    await db.capacitySetting.upsert({ where: { lane }, update: {}, create: { lane, capacity } });
  }

  // Phase templates (all lanes share the RD template in V1 per docs/05 assumption 7)
  for (const lane of [DeliveryLane.RAPID_DEPLOYMENT, DeliveryLane.EXTERNAL_FDE_POD, DeliveryLane.CORE_TRANSFORMATION]) {
    for (const [i, name] of RD_PHASES.entries()) {
      const existing = await db.phaseTemplate.findUnique({ where: { lane_sortOrder: { lane, sortOrder: i } } });
      if (!existing) await db.phaseTemplate.create({ data: { lane, name, sortOrder: i } });
    }
  }

  console.log(`Seeded: ${USERS.length} users, ${COMPANIES.length} companies, taxonomies, scoring models, capacity, phase templates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
