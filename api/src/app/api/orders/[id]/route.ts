import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { orderItems, orders } from '@/db/schema';
import { error, json } from '@/lib/http';
import { requireAdmin } from '@/lib/catalogue';
import { getCurrentCustomer } from '@/lib/customerSession';
import { ownsOrder } from '@/lib/orderOwnership';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const key = Number(id);
  const order = await db.query.orders.findFirst({
    where: Number.isInteger(key) && key > 0 ? eq(orders.id, key) : eq(orders.reference, id),
  });
  if (!order) return error('Order not found', 404);

  const [admin, customer] = await Promise.all([requireAdmin(request), getCurrentCustomer(request)]);
  const isOwner = Boolean(customer && customer.id === order.customerId) || await ownsOrder(request, order);
  if (!admin && !isOwner) return error('Order not found', 404);

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  // The tracking-token hash is a credential as far as this response is
  // concerned; ownership was already proved above, the hash is not needed.
  const { trackingTokenHash: _trackingTokenHash, ...safe } = order;
  return json({ data: { ...safe, items } });
}
