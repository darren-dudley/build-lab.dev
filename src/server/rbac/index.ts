import { auth } from "@/server/auth";
import { hasPermission, type Permission } from "./permissions";

export * from "./permissions";

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
