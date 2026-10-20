import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customerSession';
import { hashToken, readCookie } from '@/lib/customerAuth';

export async function ownsOrder(request: Request, order: typeof orders.$inferSelect): Promise<boolean> {
  const customer = await getCurrentCustomer(request);
  if (customer && order.customerId === customer.id) return true;

  const token = readCookie(request.headers.get('cookie'), 'mk_order_tracking');
  if (!token || !order.trackingTokenHash) return false;

  const owned = await db.query.orders.findFirst({
    where: and(eq(orders.id, order.id), eq(orders.trackingTokenHash, hashToken(token))),
  });
  return Boolean(owned);
}
