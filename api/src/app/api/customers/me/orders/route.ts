import { desc, eq, sql, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { customers, orderItems, orderStatusEvents, orders, payments, nowText } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customerSession';
import { toPaymentDto } from '@/lib/payments';
import { toTimelineDto } from '@/lib/orderTimeline';
import { error, json } from '@/lib/http';

/**
 * A customer's own order history.
 *
 * Payments are projected through `toPaymentDto`. The raw rows carry the
 * settlement-token hash, the payer's phone and the gateway reference, none of
 * which belongs in a browser response.
 */
export async function GET(request: Request) {
  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  const ordersList = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, customer.id))
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  const orderIds = ordersList.map((o) => o.id);

  const [allItems, allTimeline, allPayments] = await Promise.all([
    orderIds.length > 0
      ? db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
      : Promise.resolve([]),
    orderIds.length > 0
      ? db.select().from(orderStatusEvents).where(inArray(orderStatusEvents.orderId, orderIds))
      : Promise.resolve([]),
    orderIds.length > 0
      ? db.select().from(payments).where(inArray(payments.orderId, orderIds))
      : Promise.resolve([]),
  ]);

  const itemsByOrder = new Map<number, typeof allItems[0][]>();
  const timelineByOrder = new Map<number, typeof allTimeline[0][]>();
  const paymentsByOrder = new Map<number, typeof allPayments[0][]>();

  for (const item of allItems) {
    const arr = itemsByOrder.get(item.orderId) ?? [];
    arr.push(item);
    itemsByOrder.set(item.orderId, arr);
  }
  for (const ev of allTimeline) {
    const arr = timelineByOrder.get(ev.orderId) ?? [];
    arr.push(ev);
    timelineByOrder.set(ev.orderId, arr);
  }
  for (const pay of allPayments) {
    const key = Number(pay.orderId);
    const arr = paymentsByOrder.get(key) ?? [];
    arr.push(pay);
    paymentsByOrder.set(key, arr);
  }

  const data = ordersList.map((order) => {
    // The tracking hash and staff emails stay on the server; history shows the
    // same public timeline as the single-order endpoint.
    const { trackingTokenHash: _trackingTokenHash, ...safe } = order;
    return {
      ...safe,
      items: itemsByOrder.get(order.id) ?? [],
      timeline: (timelineByOrder.get(order.id) ?? [])
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map(toTimelineDto),
      payments: (paymentsByOrder.get(order.id) ?? []).map(toPaymentDto),
    };
  });

  const totalRow = await db.select({ total: sql<number>`count(*)` }).from(orders).where(eq(orders.customerId, customer.id));

  return json({
    data,
    meta: {
      total: Number(totalRow[0]?.total ?? 0),
      limit,
      offset,
      returned: data.length,
    },
  });
}
