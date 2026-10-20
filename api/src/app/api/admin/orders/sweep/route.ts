import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { carts, orders, payments } from '@/db/schema';
import { json } from '@/lib/http';
import { requireAdmin } from '@/lib/catalogue';
import { recordMovement } from '@/lib/stockLedger';

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return new Response('unauthorized', { status: 401 });

  const cutoff = sql`to_char(now() at time zone 'utc' - interval '15 minutes', 'YYYY-MM-DD HH24:MI:SS')`;
  const stale = await db.select().from(orders).where(and(eq(orders.status, 'pending'), lt(orders.createdAt, cutoff as any)));
  let cancelled = 0;
  for (const o of stale) {
    const p = await db.query.payments.findFirst({ where: eq(payments.orderId, o.id) });
    if (p && p.status === 'succeeded') continue;
    await db.transaction(async (tx) => {
      await tx.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, o.id));
      if (o.cartId) await tx.update(carts).set({ status: 'abandoned' }).where(eq(carts.id, o.cartId));
    });
    cancelled++;
  }
  return json({ cancelled });
}
