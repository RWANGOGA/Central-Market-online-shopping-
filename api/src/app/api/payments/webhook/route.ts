import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { payments, orders } from '@/db/schema';

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? '';
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const given = request.headers.get('x-signature') ?? '';
  if (given.length !== expected.length ||
      !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response('bad signature', { status: 401 });
  }

  let evt: any;
  try { evt = JSON.parse(raw); } catch { return new Response('bad json', { status: 422 }); }

  await db.transaction(async (tx) => {
    const p = await tx.query.payments.findFirst({ where: eq(payments.providerRef, evt.ref) });
    if (!p || p.status === 'succeeded') return;
    if (evt.amount !== p.amount || evt.currency !== p.currency) {
      return; // wrong amount: leave payment pending for review
    }
    await tx.update(payments).set({ status: 'succeeded' }).where(eq(payments.id, p.id));
    if (p.orderId) {
      await tx.update(orders).set({ status: 'processing' }).where(eq(orders.id, p.orderId));
    }
  });

  return new Response('ok');
}
