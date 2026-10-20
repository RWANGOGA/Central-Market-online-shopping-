import { eq, desc, sql, and } from 'drizzle-orm';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { requireAdmin } from '@/lib/catalogue';
import { error, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return error('Not signed in', 401);

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);

  const query = unreadOnly
    ? db.select().from(notifications).where(and(eq(notifications.adminId, admin.id), eq(notifications.read, false))).orderBy(desc(notifications.createdAt)).limit(limit)
    : db.select().from(notifications).where(eq(notifications.adminId, admin.id)).orderBy(desc(notifications.createdAt)).limit(limit);

  const rows = await query;

  const unreadCountRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.adminId, admin.id), eq(notifications.read, false)));

  return json({
    data: rows,
    meta: {
      total: rows.length,
      unread: Number(unreadCountRow[0]?.count ?? 0),
    },
  });
}
