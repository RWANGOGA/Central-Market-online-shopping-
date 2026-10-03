import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { orderItems, orders } from '@/db/schema';
import { error, json } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const key = Number(id);

  const order = await db.query.orders.findFirst({
    where: key ? eq(orders.id, key) : eq(orders.reference, id),
  });
  if (!order) return error(`Order "${id}" not found`, 404);

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  return json({ data: { ...order, items } });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const key = Number(id);

  const order = await db.query.orders.findFirst({
    where: key ? eq(orders.id, key) : eq(orders.reference, id),
  });
  if (!order) return error(`Order "${id}" not found`, 404);

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!['pending', 'paid', 'fulfilled', 'cancelled'].includes(status)) {
    return error('status must be one of pending, paid, fulfilled, cancelled', 422);
  }

  const updated = await db
    .update(orders)
    .set({ status })
    .where(eq(orders.id, order.id))
    .returning();

  return json({ data: updated[0] });
}