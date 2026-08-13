import type { RoleType } from "@prisma/client";
import {
  hasPermission,
  type Permission,
} from "@/server/rbac";

export type NavItem = {
  label: string;
  href: string;
  permission?: Permission; // undefined = all authenticated users
};

export type NavSection = {
  label?: string;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    items: [{ label: "Home", href: "/home" }],
  },
  {
    label: "Intake",
    items: [
      { label: "Submit Initiative", href: "/intake/new" },
      { label: "My Initiatives", href: "/initiatives/mine" },
    ],
  },
  {
    label: "Initiatives",
    items: [
      { label: "All Initiatives", href: "/initiatives", permission: "initiative.viewAll" },
    ],
  },
  {
    label: "Triage",
    items: [{ label: "Triage Queue", href: "/triage", permission: "triage.review" }],
  },
  {
    label: "Governance",
    items: [
      { label: "Governance Queue", href: "/governance", permission: "governance.decide" },
      { label: "Portfolio Ranking", href: "/governance/ranking", permission: "governance.viewRanking" },
    ],
  },
  {
    label: "Delivery",
    items: [
      { label: "Rapid Deployment", href: "/delivery/rapid-deployment", permission: "project.view" },
      { label: "External FDE Pod", href: "/delivery/fde-pod", permission: "project.view" },
      { label: "Core Transformation", href: "/delivery/core-transformation", permission: "project.view" },
      { label: "Awaiting Capacity", href: "/delivery/awaiting-capacity", permission: "project.view" },
    ],
  },
  {
    label: "Projects",
    items: [{ label: "All Projects", href: "/projects", permission: "project.view" }],
  },
  {
    label: "Insights",
    items: [{ label: "Analytics", href: "/analytics", permission: "governance.viewRanking" }],
  },
  {
    label: "Admin",
    items: [
      { label: "Users", href: "/admin/users", permission: "admin.users" },
      { label: "Portfolio Companies", href: "/admin/companies", permission: "admin.companies" },
      { label: "Scoring", href: "/admin/scoring", permission: "admin.scoring" },
      { label: "Investment Priority", href: "/admin/investment-priority", permission: "admin.investmentPriority" },
      { label: "Capacity", href: "/admin/capacity", permission: "admin.capacity" },
      { label: "Taxonomies", href: "/admin/taxonomies", permission: "admin.taxonomies" },
      { label: "Settings", href: "/admin/settings", permission: "admin.audit" },
    ],
  },
];

/** Filter nav to the user's roles. Visibility only — routes enforce server-side. */
export function navForRoles(roles: RoleType[]): NavSection[] {
  return SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter(
      (i) => !i.permission || hasPermission(roles, i.permission),
    ),
  })).filter((s) => s.items.length > 0);
}
