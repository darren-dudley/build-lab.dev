import { RoleType } from "@prisma/client";
import { auth } from "@/server/auth";

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

export class AuthorizationError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Returns the session or throws. Use inside server actions/queries. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new AuthorizationError("Not authenticated");
  return session;
}

/** Returns the session if it holds the permission; throws otherwise. */
export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!hasPermission(session.user.roles, permission)) {
    throw new AuthorizationError(`Missing permission: ${permission}`);
  }
  return session;
}
