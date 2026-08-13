"use server";

import { z } from "zod";
import { requireSession } from "@/server/rbac";
import { hasPermission } from "@/server/rbac/permissions";
import { db } from "@/server/db";

export type SearchResult = {
  group: string;
  label: string;
  sublabel?: string;
  href: string;
};

/** Global search across initiatives, companies, projects, people, tags. */
export async function globalSearchAction(rawQuery: string): Promise<SearchResult[]> {
  const session = await requireSession();
  const q = z.string().min(2).max(100).parse(rawQuery.trim());
  const internal = hasPermission(session.user.roles, "initiative.viewAll");
  const contains = { contains: q, mode: "insensitive" as const };

  const [initiatives, companies, projects, users] = await Promise.all([
    db.initiative.findMany({
      where: {
        deletedAt: null,
        // Requesters search only their own initiatives
        ...(internal ? {} : { requesterId: session.user.id }),
        OR: [
          { name: contains },
          { requesterName: contains },
          { intakeResponse: { businessProblem: contains } },
          { intakeResponse: { aiTask: contains } },
          { triageReview: { normalizedName: contains } },
          { sponsor: { name: contains } },
          { tags: { some: { tag: { label: contains } } } },
        ],
      },
      take: 6,
      include: { portfolioCompany: { select: { name: true } } },
    }),
    internal
      ? db.portfolioCompany.findMany({
          where: { deletedAt: null, name: contains },
          take: 4,
        })
      : Promise.resolve([]),
    internal && hasPermission(session.user.roles, "project.view")
      ? db.project.findMany({
          where: { deletedAt: null, name: contains },
          take: 5,
          include: { initiative: { select: { portfolioCompany: { select: { name: true } } } } },
        })
      : Promise.resolve([]),
    internal
      ? db.user.findMany({
          where: { deletedAt: null, OR: [{ name: contains }, { email: contains }] },
          take: 4,
        })
      : Promise.resolve([]),
  ]);

  const results: SearchResult[] = [
    ...initiatives.map((i) => ({
      group: "Initiatives",
      label: i.name,
      sublabel: i.portfolioCompany?.name ?? "Specialist",
      href: `/initiatives/${i.id}`,
    })),
    ...projects.map((p) => ({
      group: "Projects",
      label: p.name,
      sublabel: p.initiative.portfolioCompany?.name ?? "Specialist",
      href: `/projects/${p.id}`,
    })),
    ...companies.map((c) => ({
      group: "Companies",
      label: c.name,
      sublabel: c.sector ?? undefined,
      href: `/governance/ranking`,
    })),
    ...users.map((u) => ({
      group: "People",
      label: u.name,
      sublabel: u.title ?? u.email,
      href: `/initiatives`,
    })),
  ];
  return results;
}
