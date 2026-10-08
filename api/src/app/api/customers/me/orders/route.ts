import { desc, eq, sql, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { customers, orderItems, orderStatusEvents, orders, payments } from '@/db/schema';
import { error, json } from '@/lib/http';

function normalisePhone(raw: string | null): string | null {
  if (!raw) return null;
  return raw.replace(/[\s()-]/g, '').replace(/^\+?256/, '0');
}

async function customerFromRequest(request: Request): Promise<typeof customers.$inferSelect | null> {
  const url = new URL(request.url);
  const phone = normalisePhone(
    request.headers.get('x-customer-phone') ||
      url.searchParams.get('phone') ||
      ''
  );
  if (!phone) return null;
  const row = await db.query.customers.findFirst({ where: eq(customers.phone, phone) });
  return row ?? null;
}

export async function GET(request: Request) {
  const customer = await customerFromRequest(request);
  if (!customer) return error('Provide a customer phone via ?phone= or X-Customer-Phone header', 401);

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);

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

  const data = ordersList.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) ?? [],
    timeline: (timelineByOrder.get(order.id) ?? []).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    payments: paymentsByOrder.get(order.id) ?? [],
  }));

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
