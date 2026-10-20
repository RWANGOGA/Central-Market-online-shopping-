import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { payments } from '@/db/schema';
import { approvalInstructions } from '@/lib/payments';
import { error, json } from '@/lib/http';
import { requireCart } from '@/lib/cartOwnership';
import { ownsOrder } from '@/lib/orderOwnership';
import { orders } from '@/db/schema';
import { requireAdmin } from '@/lib/catalogue';

type Ctx = { params: Promise<{ reference: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { reference } = await params;
  const payment = await db.query.payments.findFirst({ where: eq(payments.reference, reference) });
  if (!payment) return error('Payment not found', 404);

  const [admin, cartOwner, order] = await Promise.all([
    requireAdmin(request),
    payment.cartId ? requireCart(request, payment.cartId) : Promise.resolve(null),
    payment.orderId ? db.query.orders.findFirst({ where: eq(orders.id, payment.orderId) }) : Promise.resolve(null),
  ]);
  const orderOwner = order ? await ownsOrder(request, order) : false;
  if (!admin && !cartOwner && !orderOwner) return error('Payment not found', 404);

  return json({ data: {
    reference: payment.reference,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    channel: payment.channel,
    provider: payment.provider,
    nextAction: {
      channel: payment.channel,
      provider: payment.provider,
      status: payment.status,
      ...approvalInstructions(payment.channel, payment.provider),
    },
  } });
}
