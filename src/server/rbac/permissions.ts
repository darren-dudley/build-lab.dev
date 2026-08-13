import { RoleType } from "@prisma/client";

const { REQUESTER, TRIAGE, GOVERNANCE, DELIVERY, ADMIN } = RoleType;
const ALL: RoleType[] = [REQUESTER, TRIAGE, GOVERNANCE, DELIVERY, ADMIN];

/**
 * Server-side permission matrix (docs/03-data-model.md).
 * Nav visibility is UX; THIS is security. Every server action and privileged
 * query calls requirePermission() — never rely on hidden UI.
 */
export const PERMISSIONS = {
  // Intake
  "initiative.create": ALL,
  "initiative.viewOwn": ALL,
  "initiative.respondInfo": ALL, // ownership-checked in service layer

  // Cross-portfolio visibility
  "initiative.viewAll": [TRIAGE, GOVERNANCE, DELIVERY, ADMIN],
  "initiative.viewInternal": [TRIAGE, GOVERNANCE, ADMIN],

  // Triage
  "triage.review": [TRIAGE, ADMIN],
  "triage.score": [TRIAGE, ADMIN],
  "triage.flag": [TRIAGE, ADMIN],
  "triage.requestInfo": [TRIAGE, ADMIN],

  // Governance
  "governance.viewRanking": [TRIAGE, GOVERNANCE, ADMIN],
  "governance.decide": [GOVERNANCE, ADMIN],
  "governance.assignLane": [GOVERNANCE, ADMIN],
  "project.start": [GOVERNANCE, ADMIN],

  // Delivery
  "project.view": [DELIVERY, GOVERNANCE, TRIAGE, ADMIN],
  "project.manage": [DELIVERY, ADMIN],

  // Admin
  "admin.users": [ADMIN],
  "admin.companies": [ADMIN],
  "admin.scoring": [ADMIN],
  "admin.investmentPriority": [ADMIN],
  "admin.capacity": [ADMIN],
  "admin.taxonomies": [ADMIN],
  "admin.audit": [ADMIN],
} as const satisfies Record<string, readonly RoleType[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(roles: RoleType[], permission: Permission): boolean {
  return roles.some((r) => (PERMISSIONS[permission] as readonly RoleType[]).includes(r));
}

