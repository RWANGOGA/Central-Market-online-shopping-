import { eq, desc, sql, and } from 'drizzle-orm';
import { db } from '@/db';
import { notifications, nowText } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customerSession';
import { error, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);

  const query = unreadOnly
    ? db.select().from(notifications).where(and(eq(notifications.customerId, customer.id), eq(notifications.read, false))).orderBy(desc(notifications.createdAt)).limit(limit)
    : db.select().from(notifications).where(eq(notifications.customerId, customer.id)).orderBy(desc(notifications.createdAt)).limit(limit);

  const rows = await query;

  const unreadCountRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.customerId, customer.id), eq(notifications.read, false)));

  return json({
    data: rows,
    meta: {
      total: rows.length,
      unread: Number(unreadCountRow[0]?.count ?? 0),
    },
  });
}
