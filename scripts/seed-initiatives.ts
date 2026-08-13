/**
 * Seeds realistic initiatives across the pre-governance lifecycle by driving
 * the REAL services (intake → triage → scoring → flags → transitions), so
 * every record carries proper transitions, audit trail, and score versions.
 * Governance decisions and projects are seeded by later phase scripts.
 *
 * Idempotent: skips any initiative whose name already exists.
 */
import { InitiativeStatus, type FlagType } from "@prisma/client";
import { db } from "@/server/db";
import { createDraft, saveDraft, submitInitiative } from "@/server/intake";
import { scoreInitiative } from "@/server/scoring";
import { saveTriageReview, setFlag, markReadyForGovernance, requestInformation } from "@/server/triage";
import { transitionInitiative } from "@/server/workflow";
import type { DraftData } from "@/lib/intake-schema";

type Blueprint = {
  name: string;
  requestType: "SPECIALIST_SPECIALIST" | "SPECIALIST_PORTCO" | "GENERALIST_PORTCO";
  company?: string; // portfolio types
  functionLabel?: string;
  specialistWorkflow?: string;
  requesterEmail: string; // seed user, or "public:Name <email>" for anonymous
  problem: string;
  today: string;
  aiTask: string;
  success: string;
  effort: "SMALL" | "MEDIUM" | "LARGE";
  tta: [number, "DAYS" | "WEEKS" | "MONTHS"];
  onlyOne: "YES" | "NO" | "UNSURE";
  owner: string;
  kpis: { metric: string; baseline?: string; target?: string; noBaseline?: boolean }[];
  sponsor?: string;
  forcing?: { date: string; event: string; consequence: string };
  // lifecycle placement
  to: "DRAFT" | "SUBMITTED" | "TRIAGE" | "NEEDS_INFORMATION" | "READY_FOR_GOVERNANCE" | "GOVERNANCE_REVIEW";
  dims?: [number, number, number, number, number]; // BI, TTA, DF, SP, SF
  flags?: { type: FlagType; note?: string }[];
};

const B: Blueprint[] = [
  // ── High-priority, governance-ready portfolio opportunities ──
  {
    name: "Automated QBR deck generation", requestType: "SPECIALIST_PORTCO", company: "Meridian Logistics",
    functionLabel: "Sales", requesterEmail: "maya.johnson@build-lab.dev", sponsor: "Rick Alvarez, VP Sales",
    problem: "Account managers spend 5–7 hours assembling each quarterly business review deck by hand.",
    today: "AMs export CRM reports, copy usage data from the ops dashboard, and rebuild slides in PowerPoint. ~40 QBRs per quarter, ~6 hours each.",
    aiTask: "Create first-pass QBR decks using CRM, customer usage, and support data.",
    success: "80% of QBRs start from a generated deck; AM prep time under 90 minutes.",
    effort: "MEDIUM", tta: [3, "WEEKS"], onlyOne: "YES", owner: "Rick Alvarez, VP Sales",
    kpis: [{ metric: "Hours per QBR deck", baseline: "6", target: "1.5" }],
    to: "READY_FOR_GOVERNANCE", dims: [4, 5, 4, 5, 5],
    flags: [{ type: "SIMILAR_REQUESTS_EXIST", note: "Sales-call prep request from Harbor is closely related." }],
  },
  {
    name: "FP&A variance narrative drafts", requestType: "SPECIALIST_PORTCO", company: "Cobalt Health Partners",
    functionLabel: "Finance", requesterEmail: "carlos.mendez@build-lab.dev", sponsor: "Dana Wu, CFO",
    problem: "Monthly close variance commentary takes the FP&A team 3 days of analyst time.",
    today: "Two analysts compare GL actuals to budget in Excel and write narratives by hand, every month.",
    aiTask: "Draft variance narratives from GL exports and budget files for analyst review.",
    success: "Narratives drafted within 4 hours of close; analysts edit rather than write.",
    effort: "SMALL", tta: [2, "WEEKS"], onlyOne: "YES", owner: "Dana Wu, CFO",
    kpis: [{ metric: "Days to variance commentary", baseline: "3", target: "0.5" }],
    to: "READY_FOR_GOVERNANCE", dims: [4, 5, 5, 5, 4],
  },
  {
    name: "Customer support agent for order status", requestType: "GENERALIST_PORTCO", company: "Clearwater Foods",
    functionLabel: "Customer Service", requesterEmail: "grace.liu@build-lab.dev", sponsor: "Tom Igwe, COO",
    problem: "60% of inbound support contacts are where-is-my-order questions handled manually.",
    today: "A 12-person support team answers phone/email; order lookups span the ERP and the carrier portal.",
    aiTask: "An AI agent that answers order-status questions using ERP and carrier tracking data, escalating exceptions.",
    success: "Half of order-status contacts resolved without a human; CSAT holds or improves.",
    effort: "MEDIUM", tta: [4, "WEEKS"], onlyOne: "NO", owner: "Tom Igwe, COO",
    kpis: [{ metric: "% contacts auto-resolved", baseline: "0", target: "50" }, { metric: "CSAT", baseline: "4.2", target: "4.2+" }],
    to: "READY_FOR_GOVERNANCE", dims: [5, 3, 3, 4, 5],
    flags: [{ type: "THIRD_PARTY_DEPENDENCY", note: "Carrier tracking API contract under review." }],
  },
  {
    name: "Contract review acceleration", requestType: "SPECIALIST_PORTCO", company: "Northwind Insurance Group",
    functionLabel: "Legal / Compliance", requesterEmail: "maya.johnson@build-lab.dev", sponsor: "Priya Shah, GC",
    problem: "Broker agreement reviews queue for 2–3 weeks in legal.",
    today: "Two attorneys review ~30 agreements/month against a playbook; most clauses are standard.",
    aiTask: "Pre-screen broker agreements against the clause playbook, flagging deviations for attorney review.",
    success: "Standard agreements turned around in 3 days; attorneys focus on flagged deviations only.",
    effort: "MEDIUM", tta: [6, "WEEKS"], onlyOne: "UNSURE", owner: "Priya Shah, GC",
    kpis: [{ metric: "Median review turnaround (days)", baseline: "15", target: "3" }],
    to: "READY_FOR_GOVERNANCE", dims: [4, 3, 3, 4, 4],
    flags: [{ type: "SENSITIVE_DATA", note: "Contracts contain counterparty PII." }, { type: "SECURITY_REVIEW_REQUIRED" }],
  },
  {
    name: "Churn-risk identification for key accounts", requestType: "GENERALIST_PORTCO", company: "Atlas Field Services",
    functionLabel: "Sales", requesterEmail: "sam.patel@build-lab.dev", sponsor: "Lena Brooks, CRO",
    problem: "Account churn surprises leadership; warning signs live in scattered systems.",
    today: "No systematic review. CSMs rely on gut feel; churn post-mortems find missed signals in tickets and usage.",
    aiTask: "Score key accounts weekly for churn risk from support tickets, usage trends, and billing history, with reasons.",
    success: "Top-decile risk accounts get proactive outreach; churn on covered accounts drops measurably.",
    effort: "LARGE", tta: [2, "MONTHS"], onlyOne: "NO", owner: "Lena Brooks, CRO",
    kpis: [{ metric: "Logo churn (covered accounts)", baseline: "14%/yr", target: "10%/yr" }],
    to: "GOVERNANCE_REVIEW", dims: [5, 2, 2, 3, 4],
    flags: [{ type: "DATA_ACCESS_UNCONFIRMED", note: "Billing system export owner not identified." }, { type: "MEASUREMENT_BASELINE_MISSING" }],
  },
  {
    name: "Marketing content localization pipeline", requestType: "GENERALIST_PORTCO", company: "Pinewood Hospitality",
    functionLabel: "Marketing", requesterEmail: "grace.liu@build-lab.dev", sponsor: "Ana Costa, CMO",
    problem: "Property marketing copy is rewritten manually for 40 properties and 3 languages.",
    today: "A 3-person content team adapts brand copy per property; a backlog of 200+ pieces exists.",
    aiTask: "Generate property-specific, brand-consistent marketing copy variants from master templates.",
    success: "Backlog cleared; new campaigns localized in days not weeks.",
    effort: "SMALL", tta: [2, "WEEKS"], onlyOne: "NO", owner: "Ana Costa, CMO",
    kpis: [{ metric: "Localization turnaround (days)", baseline: "21", target: "3" }],
    to: "GOVERNANCE_REVIEW", dims: [3, 5, 4, 3, 4],
  },
  // ── In triage (scored, not yet ready) ──
  {
    name: "Sales-call preparation briefs", requestType: "SPECIALIST_PORTCO", company: "Harbor Freight Brokerage",
    functionLabel: "Sales", requesterEmail: "maya.johnson@build-lab.dev", sponsor: "Omar Reed, VP Sales",
    problem: "Reps go into carrier and shipper calls with little account context.",
    today: "Reps skim CRM notes and old emails for 20–30 minutes before important calls, or skip prep entirely.",
    aiTask: "Generate one-page pre-call briefs from CRM history, recent emails, and load data.",
    success: "Briefs exist for every scheduled call; prep time under 5 minutes.",
    effort: "SMALL", tta: [10, "DAYS"], onlyOne: "UNSURE", owner: "Omar Reed, VP Sales",
    kpis: [{ metric: "Prep time per call (min)", baseline: "25", target: "5" }],
    to: "TRIAGE", dims: [3, 5, 4, 3, 5],
  },
  {
    name: "Recruiting screen summarization", requestType: "SPECIALIST_PORTCO", company: "Summit Dental Alliance",
    functionLabel: "HR / People", requesterEmail: "carlos.mendez@build-lab.dev", sponsor: "Joy Park, VP People",
    problem: "Clinic hiring stalls on resume screening volume — 800 applications/month across 30 clinics.",
    today: "Regional recruiters screen manually; time-to-first-review averages 6 days.",
    aiTask: "Summarize and pre-rank applications against role rubrics, with recruiter review of every decision.",
    success: "First review within 24 hours; recruiter time per hire down 40%.",
    effort: "MEDIUM", tta: [3, "WEEKS"], onlyOne: "NO", owner: "Joy Park, VP People",
    kpis: [{ metric: "Time to first review (days)", baseline: "6", target: "1" }],
    to: "TRIAGE", dims: [4, 4, 3, 4, 4],
    flags: [{ type: "SIGNIFICANT_CHANGE_MANAGEMENT", note: "Recruiter workflow change across 30 clinics." }],
  },
  {
    name: "Knowledge search across SOPs", requestType: "SPECIALIST_SPECIALIST",
    specialistWorkflow: "Portfolio Reporting", requesterEmail: "carlos.mendez@build-lab.dev",
    problem: "Finding the right SOP or precedent across our internal drive takes ages.",
    today: "Team members search Drive/Notion manually or ask in Slack; answers are inconsistent.",
    aiTask: "Semantic search + Q&A over our SOPs, templates, and past reports.",
    success: "Median time-to-answer under a minute; new joiners self-serve.",
    effort: "SMALL", tta: [2, "WEEKS"], onlyOne: "NO", owner: "Priya Nair",
    kpis: [{ metric: "Time to find answer", noBaseline: true }],
    to: "TRIAGE", dims: [3, 4, 4, 3, 4],
    flags: [{ type: "MEASUREMENT_BASELINE_MISSING" }],
  },
  // ── Awaiting first triage touch ──
  {
    name: "Pricing analysis copilot", requestType: "GENERALIST_PORTCO", company: "Vantage Building Products",
    functionLabel: "Sales", requesterEmail: "sam.patel@build-lab.dev", sponsor: "Hal Ford, VP Commercial",
    problem: "Quote pricing varies widely by rep; win/loss patterns aren't analyzed.",
    today: "Reps price from a stale spreadsheet; discounting is inconsistent across regions.",
    aiTask: "Analyze historical quotes and outcomes to recommend price bands per product/region at quote time.",
    success: "Discount variance narrows; win rate holds while average margin improves 1–2 points.",
    effort: "LARGE", tta: [2, "MONTHS"], onlyOne: "UNSURE", owner: "Hal Ford, VP Commercial",
    kpis: [{ metric: "Average realized margin", baseline: "22.1%", target: "23.5%" }],
    to: "SUBMITTED",
  },
  {
    name: "Invoice intake and coding", requestType: "GENERALIST_PORTCO", company: "Meridian Logistics",
    functionLabel: "Finance", requesterEmail: "grace.liu@build-lab.dev", sponsor: "Kim Osei, Controller",
    problem: "AP clerks hand-key 3,000 invoices a month into NetSuite.",
    today: "PDFs arrive by email; 4 clerks key header + line data and code to GL accounts.",
    aiTask: "Extract invoice data and propose GL coding for clerk approval.",
    success: "Touchless rate above 60%; AP processing cost halved.",
    effort: "MEDIUM", tta: [5, "WEEKS"], onlyOne: "NO", owner: "Kim Osei, Controller",
    kpis: [{ metric: "Cost per invoice", baseline: "$4.10", target: "$1.80" }],
    to: "SUBMITTED",
  },
  {
    name: "Deal memo first drafts", requestType: "SPECIALIST_SPECIALIST",
    specialistWorkflow: "Deal Sourcing & Screening", requesterEmail: "maya.johnson@build-lab.dev",
    problem: "Associates spend two days per deal memo assembling company research.",
    today: "Manual research across data rooms, news, and financials into a memo template.",
    aiTask: "Draft deal memo sections (market, competition, financial summary) from the data room and public sources.",
    success: "First drafts in an hour; associates focus on judgment, not assembly.",
    effort: "MEDIUM", tta: [3, "WEEKS"], onlyOne: "YES", owner: "James Okafor",
    kpis: [{ metric: "Analyst days per memo", baseline: "2", target: "0.5" }],
    to: "SUBMITTED",
  },
  {
    name: "Maintenance ticket triage", requestType: "GENERALIST_PORTCO", company: "Pinewood Hospitality",
    functionLabel: "Operations", requesterEmail: "public:Jordan Reyes <jordan.reyes@pinewoodhosp.com>",
    sponsor: "Ana Costa, CMO",
    problem: "Guest-reported maintenance issues are triaged manually at each property.",
    today: "Front desk logs issues in a shared inbox; engineers pick severity by experience.",
    aiTask: "Classify and prioritize maintenance tickets, routing urgent safety issues immediately.",
    success: "Urgent issues dispatched within 15 minutes around the clock.",
    effort: "SMALL", tta: [2, "WEEKS"], onlyOne: "NO", owner: "Property GM council",
    kpis: [{ metric: "Urgent dispatch time (min)", baseline: "120", target: "15" }],
    to: "SUBMITTED",
  },
  {
    name: "Payer denial letter analysis", requestType: "SPECIALIST_PORTCO", company: "Cobalt Health Partners",
    functionLabel: "Operations", requesterEmail: "carlos.mendez@build-lab.dev", sponsor: "Dana Wu, CFO",
    problem: "Claim denial letters are read and categorized manually before appeal.",
    today: "A revenue-cycle team of 6 reads ~500 denial letters weekly and drafts appeals.",
    aiTask: "Extract denial reasons, categorize, and draft first-pass appeal letters.",
    success: "Appeal drafting time down 70%; appeal rate up because capacity frees.",
    effort: "MEDIUM", tta: [4, "WEEKS"], onlyOne: "UNSURE", owner: "Dana Wu, CFO",
    kpis: [{ metric: "Appeals filed per week", baseline: "180", target: "300" }],
    to: "SUBMITTED",
  },
  // ── Needs information ──
  {
    name: "Field service scheduling optimizer", requestType: "GENERALIST_PORTCO", company: "Atlas Field Services",
    functionLabel: "Operations", requesterEmail: "sam.patel@build-lab.dev", sponsor: "TBD",
    problem: "Technician routing is manual and travel time is high.",
    today: "Dispatchers assign jobs each morning from a whiteboard process.",
    aiTask: "Suggest optimal daily technician schedules from job locations, skills, and SLAs.",
    success: "Jobs per tech-day up 15% without SLA misses.",
    effort: "LARGE", tta: [3, "MONTHS"], onlyOne: "NO", owner: "Ops director",
    kpis: [{ metric: "Jobs per tech-day", baseline: "4.2", target: "4.8" }],
    to: "NEEDS_INFORMATION", dims: [4, 2, 2, 2, 3],
    flags: [{ type: "SPONSOR_UNCONFIRMED", note: "No named executive sponsor yet." }],
  },
  // ── Drafts (incomplete) ──
  {
    name: "Board pack assembly", requestType: "SPECIALIST_SPECIALIST",
    specialistWorkflow: "Portfolio Reporting", requesterEmail: "carlos.mendez@build-lab.dev",
    problem: "Quarterly board packs consume a full week across the team.",
    today: "Slides assembled from portfolio company reports by hand.",
    aiTask: "Draft board pack sections from portfolio reporting submissions.",
    success: "Pack assembly in a day.",
    effort: "MEDIUM", tta: [4, "WEEKS"], onlyOne: "NO", owner: "Priya Nair",
    kpis: [{ metric: "Days to assemble pack", baseline: "5", target: "1" }],
    to: "DRAFT",
  },
  {
    name: "Website chat concierge", requestType: "GENERALIST_PORTCO", company: "Pinewood Hospitality",
    functionLabel: "Marketing", requesterEmail: "public:Casey Kim <casey.kim@pinewoodhosp.com>",
    problem: "Booking questions go unanswered overnight.",
    today: "Front desks answer chat during business hours only.",
    aiTask: "Answer booking and amenity questions on property sites around the clock.",
    success: "Overnight conversion improves.",
    effort: "SMALL", tta: [10, "DAYS"], onlyOne: "NO", owner: "Ana Costa",
    kpis: [{ metric: "Overnight booking conversion", noBaseline: true }],
    to: "DRAFT",
  },
];

async function main() {
  const users = Object.fromEntries(
    (await db.user.findMany({ select: { id: true, email: true } })).map((u) => [u.email, u.id]),
  );
  const companies = Object.fromEntries(
    (await db.portfolioCompany.findMany({ select: { id: true, name: true } })).map((c) => [c.name, c.id]),
  );
  const functions = Object.fromEntries(
    (await db.taxonomyItem.findMany({ where: { kind: "FUNCTION" }, select: { id: true, label: true } })).map(
      (f) => [f.label, f.id],
    ),
  );
  const triager = users["tara.chen@build-lab.dev"];
  const triager2 = users["marcus.webb@build-lab.dev"];

  let created = 0;
  for (const [idx, b] of B.entries()) {
    const exists = await db.initiative.findFirst({ where: { name: b.name } });
    if (exists) continue;

    const isPublic = b.requesterEmail.startsWith("public:");
    const requesterId = isPublic ? null : users[b.requesterEmail];
    const publicMatch = isPublic ? b.requesterEmail.match(/^public:(.+) <(.+)>$/) : null;

    const draft = await createDraft(requesterId, b.requestType);
    const data: DraftData = {
      name: b.name,
      requesterName: publicMatch?.[1],
      requesterEmail: publicMatch?.[2],
      portfolioCompanyId: b.company ? companies[b.company] : null,
      functionId: b.functionLabel ? functions[b.functionLabel] : null,
      specialistWorkflow: b.specialistWorkflow ?? null,
      sponsorName: b.sponsor?.split(",")[0] ?? null,
      sponsorTitle: b.sponsor?.split(",")[1]?.trim() ?? null,
      businessProblem: b.problem,
      currentProcess: b.today,
      aiTask: b.aiTask,
      successDefinition: b.success,
      effortEstimate: b.effort,
      timeToArtifactValue: b.tta[0],
      timeToArtifactUnit: b.tta[1],
      onlyOneAnswer: b.onlyOne,
      onlyOneWhy: b.onlyOne === "YES" ? "Highest-leverage opportunity we see this quarter." : "Other candidates exist.",
      outcomeOwnerName: b.owner.split(",")[0],
      outcomeOwnerTitle: b.owner.split(",")[1]?.trim(),
      kpis: b.kpis.map((k) => ({ metric: k.metric, baseline: k.baseline ?? null, target: k.target ?? null, noBaseline: k.noBaseline ?? false })),
      noBaselineExists: b.kpis.some((k) => k.noBaseline),
      forcingEventDate: b.forcing?.date ?? null,
      forcingEvent: b.forcing?.event ?? null,
      forcingConsequence: b.forcing?.consequence ?? null,
    };
    await saveDraft(draft.id, requesterId, data);

    if (b.to !== "DRAFT") {
      const sub = await submitInitiative(draft.id, requesterId);
      if (!sub.ok) throw new Error(`${b.name}: submit failed — ${sub.missing.join(", ")}`);
      // Stagger submission dates for realism
      await db.initiative.update({
        where: { id: draft.id },
        data: { submittedAt: new Date(Date.now() - (B.length - idx) * 36e5 * 20) },
      });
    }

    const scorer = idx % 2 === 0 ? triager : triager2;
    if (b.dims) {
      const [bi, tta, df, sp, sf] = b.dims;
      await scoreInitiative({
        initiativeId: draft.id,
        scorerId: scorer,
        components: [
          { dimension: "BUSINESS_IMPACT", value: bi, rationale: "Seed rationale: impact assessment from intake evidence." },
          { dimension: "TIME_TO_ARTIFACT", value: tta, rationale: "Seed rationale: based on requester TTA and data access." },
          { dimension: "DATA_FEASIBILITY", value: df, rationale: "Seed rationale: data source confirmation status." },
          { dimension: "SPONSORSHIP", value: sp, rationale: "Seed rationale: sponsor seniority and engagement." },
          { dimension: "STRATEGIC_FIT", value: sf, rationale: "Seed rationale: repeatability across portfolio." },
        ],
      });
      await saveTriageReview({
        initiativeId: draft.id,
        reviewerId: scorer,
        normalizedName: b.name,
        normalizedProblem: b.problem,
        normalizedAsk: b.aiTask,
      });
    }
    for (const f of b.flags ?? []) {
      await setFlag({ initiativeId: draft.id, flagType: f.type, note: f.note, actorId: scorer, active: true });
    }

    if (b.to === "READY_FOR_GOVERNANCE" || b.to === "GOVERNANCE_REVIEW") {
      await markReadyForGovernance({ initiativeId: draft.id, actorId: scorer });
      if (b.to === "GOVERNANCE_REVIEW") {
        await transitionInitiative({ initiativeId: draft.id, to: InitiativeStatus.GOVERNANCE_REVIEW, actorId: users["elena.vasquez@build-lab.dev"] });
      }
    } else if (b.to === "NEEDS_INFORMATION") {
      await requestInformation({
        initiativeId: draft.id,
        actorId: scorer,
        message: "Who is the executive sponsor, and can ops confirm access to the scheduling data?",
      });
    }
    created++;
  }
  console.log(`Seeded ${created} initiatives (skipped ${B.length - created} existing).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
