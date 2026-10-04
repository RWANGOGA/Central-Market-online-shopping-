import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { requireAdmin } from '@/lib/catalogue';
import { ORDER_FLOW } from '@/lib/orderFlow';
import { error, json } from '@/lib/http';

/**
 * Staff order queue.
 *
 * Replaces `GET /api/orders`, which returned every order with customer name,
 * phone and full address to anyone who asked.
 */

const ORDER_FLOW_KEYS = Object.keys(ORDER_FLOW) as [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

const listSchema = z.object({
  // Narrowed to the fulfilment states so a typo cannot reach the query.
  status: z.enum(ORDER_FLOW_KEYS).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return error('Not signed in', 401);

  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    status: url.searchParams.get('status') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? 'Invalid query', 422);

  const { status, limit, offset } = parsed.data;

  const base = db.select().from(orders).$dynamic();
  const filtered = status ? base.where(eq(orders.status, status)) : base;

  const rows = await filtered.orderBy(desc(orders.createdAt)).limit(limit).offset(offset);

  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(orders);

  return json({
    data: rows,
    meta: {
      total: Number(total),
      limit,
      offset,
      returned: rows.length,
      requestedBy: admin.email,
    },
  });
}
