/**
 * Seeds the real portfolio companies from "Seed Portfolio Company Info"
 * (fund, equity check USD, current value USD). Coherent and Dessert Holdings
 * appear in Funds XII and XIII — merged with combined figures.
 *
 * For each company, appends a BC Investment Priority reference derived
 * transparently from the financials (see src/server/admin/bc-derive.ts).
 * Deactivates the fictional demo companies (history preserved).
 *
 * Idempotent: skips companies that already exist by name.
 */
import { db } from "@/server/db";
import { deriveBcInputs, DERIVATION_NOTE } from "@/server/admin/bc-derive";
import { computeBcPriority } from "@/server/scoring/engine";

type Row = [name: string, fund: string, check: number, value: number];

const ROWS: Row[] = [
  ["Virgin Voyages", "Fund XI", 531_604_000, 228_589_720],
  ["Innocor", "Fund XI", 172_226_000, 303_117_760],
  ["Blue Nile", "Fund XI", 213_641_000, 53_410_250],
  ["Aveanna", "Fund XI", 351_126_000, 586_380_420],
  ["Stada", "Fund XI", 383_403_000, 843_486_600],
  ["Surgery Partners", "Fund XI", 576_360_000, 1_492_772_400],
  ["Diversey / Solenis", "Fund XI", 503_027_000, 1_524_171_810],
  ["Axis Bank LTD", "Fund XII", 287_948_000, 434_801_480],
  ["KIOXIA Holdings (Toshiba)", "Fund XII", 551_932_000, 4_525_842_400],
  ["CentralSquare", "Fund XII", 426_458_000, 895_561_800],
  ["Varsity Brands", "Fund XII", 542_180_000, 1_344_606_400],
  ["Cereval", "Fund XII", 295_858_000, 2_207_100_680],
  ["Rocket Software", "Fund XII", 427_034_000, 1_622_729_200],
  ["Dealer Tire", "Fund XII", 744_364_000, 1_898_128_200],
  ["eSure", "Fund XII", 262_244_000, 262_244_000],
  ["Imperial Dade", "Fund XII", 420_946_000, 2_058_425_940],
  ["US Renal Care", "Fund XII", 484_810_000, 1_027_797_200],
  ["Zelis", "Fund XII", 756_975_000, 4_700_814_750],
  ["Nutanix", "Fund XII", 352_806_000, 1_425_336_240],
  ["Virgin Australia", "Fund XII", 144_659_000, 695_809_790],
  ["US LBM", "Fund XII", 731_289_000, 3_641_819_220],
  // Cross-fund positions merged (XII + XIII)
  ["Coherent", "Fund XII / XIII", 811_619_000, 2_516_018_900],
  ["Dessert Holdings", "Fund XII / XIII", 553_376_000, 1_743_134_400],
  ["Arxada", "Fund XII", 252_388_000, 499_728_240],
  ["Proterial", "Fund XII", 721_083_000, 1_326_792_720],
  ["ExtraHop", "Fund XIII", 468_247_000, 931_811_530],
  ["PartsSource", "Fund XIII", 710_338_000, 1_633_777_400],
  ["Cardurion", "Fund XIII", 110_826_000, 465_469_200],
  ["InnovaCare", "Fund XIII", 446_554_000, 0],
  ["athenahealth", "Fund XIII", 915_060_000, 3_998_812_200],
  ["EnterpriseDB", "Fund XIII", 303_629_000, 704_419_280],
  ["LeanTaas", "Fund XIII", 328_542_000, 811_498_740],
  ["CitiusTech", "Fund XIII", 293_506_000, 507_765_380],
  ["Evident Scientific", "Fund XIII", 755_957_000, 1_557_271_420],
  ["Fogo de Chao", "Fund XIII", 425_322_000, 1_118_596_860],
  ["Harrington Process Solutions", "Fund XIII", 296_545_000, 848_118_700],
  ["Guidehouse", "Fund XIII", 782_546_000, 2_684_132_780],
  ["1440 Foods", "Fund XIII", 332_190_000, 810_543_600],
  ["PowerSchool", "Fund XIII", 697_580_000, 1_834_635_400],
  ["Envestnet", "Fund XIII", 658_436_000, 2_153_085_720],
  ["Frontline", "Fund XIII", 497_000_000, 1_242_500_000],
  ["Sizzling Platter", "Fund XIII", 400_274_000, 1_000_685_000],
  ["HealthEdge", "Fund XIV", 1_018_022_000, 2_545_055_000],
  ["Tanabe Pharma", "Fund XIV", 272_062_000, 680_155_000],
  ["Bymmunity Therapeutics", "Fund XIV", 54_612_000, 158_374_800],
  ["PCI Pharma Services", "Fund XIV", 957_993_000, 2_394_982_500],
  ["Kailera Therapeutics", "Fund XIV", 210_042_000, 525_105_000],
  ["Concert Golf", "Fund XIV", 400_938_000, 1_002_345_000],
  ["Service Logic", "Fund XIV", 927_544_000, 2_318_860_000],
  ["Madison Scott", "Fund XIV", 900_000_000, 2_250_000_000],
];

const DEMO_COMPANIES = [
  "Meridian Logistics", "Cobalt Health Partners", "Northwind Insurance Group",
  "Vantage Building Products", "Clearwater Foods", "Summit Dental Alliance",
  "Atlas Field Services", "Brightline Media", "Harbor Freight Brokerage",
  "Pinewood Hospitality",
];

async function main() {
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@build-lab.dev" } });
  const peerChecks = ROWS.map((r) => r[2]);
  const peerValues = ROWS.map((r) => r[3]);

  let created = 0;
  for (const [name, fund, check, value] of ROWS) {
    const existing = await db.portfolioCompany.findUnique({ where: { name } });
    if (existing) continue;

    const company = await db.portfolioCompany.create({
      data: { name, fundNumber: fund, equityCheckUsd: check, valueUsd: value },
    });
    const inputs = deriveBcInputs({
      equityCheckUsd: check, valueUsd: value, fundNumber: fund,
      peerChecks, peerValues,
    });
    await db.investmentPriorityReference.create({
      data: {
        companyId: company.id,
        version: 1,
        effectiveDate: new Date("2026-08-13"),
        ...inputs,
        calculatedPriority: computeBcPriority(
          inputs.checkSizeScore, inputs.remainingValueScore, inputs.runwayScore,
        ),
        adminNotes: DERIVATION_NOTE,
        createdById: admin.id,
      },
    });
    created++;
  }

  const deactivated = await db.portfolioCompany.updateMany({
    where: { name: { in: DEMO_COMPANIES }, isActive: true },
    data: { isActive: false },
  });

  console.log(`Seeded ${created} portfolio companies (skipped ${ROWS.length - created} existing).`);
  console.log(`Deactivated ${deactivated.count} demo companies.`);
  const sample = await db.investmentPriorityReference.findMany({
    where: { company: { name: { in: ["Zelis", "Blue Nile", "HealthEdge"] } } },
    include: { company: { select: { name: true } } },
  });
  for (const r of sample) {
    console.log(`${r.company.name}: check ${r.checkSizeScore}, value ${r.remainingValueScore}, runway ${r.runwayScore} → ${r.calculatedPriority.toFixed(2)}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
