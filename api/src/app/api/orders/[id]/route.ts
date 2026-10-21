import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { orderItems, orderStatusEvents, orders, payments, refunds } from '@/db/schema';
import { error, json } from '@/lib/http';
import { requireAdmin } from '@/lib/catalogue';
import { getCurrentCustomer } from '@/lib/customerSession';
import { ownsOrder } from '@/lib/orderOwnership';
import { customerOrderView } from '@/lib/customerOrderView';

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

  const [items, timeline, orderPayments, orderRefunds] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db
      .select()
      .from(orderStatusEvents)
      .where(eq(orderStatusEvents.orderId, order.id))
      .orderBy(asc(orderStatusEvents.createdAt), asc(orderStatusEvents.id)),
    db
      .select()
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .orderBy(asc(payments.createdAt)),
    db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, order.id))
      .orderBy(asc(refunds.createdAt), asc(refunds.id)),
  ]);

  // This projection also drops the tracking-token hash, so the credential
  // behind the tracking link stays server-side.
  return json({ data: customerOrderView({ order, items, payments: orderPayments, refunds: orderRefunds, timeline }) });
}
