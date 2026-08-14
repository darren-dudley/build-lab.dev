import { db } from "@/server/db";

/**
 * Durable, per-email credential-login throttle. After MAX_FAILURES failed
 * attempts the account locks for LOCK_MINUTES. Successful login clears it.
 * Keyed on lowercased email so it holds across serverless instances.
 *
 * Responses stay generic (the caller returns the same null on lock or bad
 * password) so this never becomes an account-enumeration oracle.
 */
const MAX_FAILURES = 8;
const LOCK_MINUTES = 15;

export async function isLockedOut(email: string): Promise<boolean> {
  const rec = await db.loginAttempt.findUnique({ where: { email: email.toLowerCase() } });
  if (!rec?.lockedUntil) return false;
  if (rec.lockedUntil > new Date()) return true;
  // Lock expired — reset so the counter starts fresh.
  await db.loginAttempt.update({
    where: { email: email.toLowerCase() },
    data: { failedCount: 0, lockedUntil: null },
  });
  return false;
}

export async function recordFailure(email: string): Promise<void> {
  const key = email.toLowerCase();
  const rec = await db.loginAttempt.findUnique({ where: { email: key } });
  const failedCount = (rec?.failedCount ?? 0) + 1;
  const lockedUntil =
    failedCount >= MAX_FAILURES
      ? new Date(Date.now() + LOCK_MINUTES * 60_000)
      : null;
  await db.loginAttempt.upsert({
    where: { email: key },
    update: { failedCount, lockedUntil },
    create: { email: key, failedCount, lockedUntil },
  });
}

export async function clearFailures(email: string): Promise<void> {
  await db.loginAttempt
    .deleteMany({ where: { email: email.toLowerCase() } })
    .catch(() => {});
}
