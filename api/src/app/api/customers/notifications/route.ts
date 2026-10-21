import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customerSession';
import { error, json } from '@/lib/http';
import { csrfCheck } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100);

  const where = unreadOnly
    ? and(eq(notifications.customerId, customer.id), eq(notifications.read, false))
    : eq(notifications.customerId, customer.id);

  const rows = await db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

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

const markSchema = z
  .object({
    id: z.number().int().positive().optional(),
    all: z.boolean().optional(),
  })
  .strict();

/**
 * Mark one notification, or every unread one, as read.
 *
 * The customer id is always part of the WHERE clause, so a customer cannot
 * clear somebody else's inbox by guessing an id.
 */
export async function PATCH(request: Request) {
  const blocked = csrfCheck(request);
  if (blocked) return blocked;

  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);

  const parsed = markSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.all && parsed.data.id === undefined)) {
    return error('Send { "id": number } or { "all": true }', 422);
  }

  const mine = eq(notifications.customerId, customer.id);
  const where = parsed.data.all
    ? and(mine, eq(notifications.read, false))
    : and(mine, eq(notifications.id, parsed.data.id!));

  const updated = await db
    .update(notifications)
    .set({ read: true })
    .where(where)
    .returning({ id: notifications.id });

  return json({ data: { updated: updated.length } });
}
