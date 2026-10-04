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
