import { lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { rateLimits } from '@/db/schema';

let lastPrunedMinute = -1;

/** Fixed-window, shared-database limiter. */
export async function allow(key: string, max: number, windowSec: number): Promise<boolean> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(nowSeconds / windowSec);
  const id = `${key}:${bucket}`;
  const [row] = await db
    .insert(rateLimits)
    .values({ id, count: 1, expiresAt: (bucket + 1) * windowSec })
    .onConflictDoUpdate({
      target: rateLimits.id,
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  // Run at most once per minute per process; limits remain correct if another
  // replica runs the same cleanup because expired rows are no longer in use.
  const minute = Math.floor(nowSeconds / 60);
  if (minute !== lastPrunedMinute) {
    lastPrunedMinute = minute;
    await db.delete(rateLimits).where(lt(rateLimits.expiresAt, nowSeconds));
  }

  return Number(row?.count ?? max + 1) <= max;
}
