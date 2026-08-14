import { db } from "@/server/db";

/**
 * Durable, per-email credential-login throttle. After MAX_FAILURES failed
 * attempts within a window the account locks for LOCK_MINUTES; a successful
 * login clears it. Keyed on lowercased email so it holds across serverless
 * instances.
 *
 * Concurrency: the counter uses an atomic DB-level increment, so parallel
 * guess floods can't each read a stale zero and defeat the lock (TOCTOU).
 * isLockedOut is a pure read — it never writes — so the check can't race or
 * fail open. When a lock fires, the counter resets to zero in the same write,
 * so an expired lock naturally starts a fresh window with no reset-on-read.
 *
 * Known tradeoff: any per-account lockout lets a third party deliberately
 * lock a known email by sending failures. Acceptable for a small trusted
 * pilot; add IP-aware throttling before wider/public exposure.
 *
 * Responses stay generic (the caller returns null on lock or bad password)
 * so this never becomes an account-enumeration oracle.
 */
const MAX_FAILURES = 8;
const LOCK_MINUTES = 15;

export async function isLockedOut(email: string): Promise<boolean> {
  const rec = await db.loginAttempt.findUnique({
    where: { email: email.toLowerCase() },
    select: { lockedUntil: true },
  });
  return Boolean(rec?.lockedUntil && rec.lockedUntil > new Date());
}

export async function recordFailure(email: string): Promise<void> {
  const key = email.toLowerCase();
  // Atomic increment (create-or-increment). Returns the post-increment count.
  const rec = await db.loginAttempt.upsert({
    where: { email: key },
    create: { email: key, failedCount: 1 },
    update: { failedCount: { increment: 1 } },
    select: { failedCount: true },
  });
  if (rec.failedCount >= MAX_FAILURES) {
    // Fire the lock and reset the counter in one write, so when the lock
    // expires the next attempts begin a clean window (no reset-on-read).
    await db.loginAttempt.update({
      where: { email: key },
      data: { failedCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) },
    });
  }
}

export async function clearFailures(email: string): Promise<void> {
  await db.loginAttempt
    .deleteMany({ where: { email: email.toLowerCase() } })
    .catch(() => {});
}
