import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { payments } from '@/db/schema';
import { approvalInstructions } from '@/lib/payments';
import { error, json } from '@/lib/http';

type Ctx = { params: Promise<{ reference: string }> };

/**
 * Poll a single intent. Mobile money approval happens on the customer's
 * handset, so the client polls this until the gateway webhook, or the
 * customer confirms here, moves it out of awaiting_approval.
 */
export async function GET(_request: Request, { params }: Ctx) {
  const { reference } = await params;

  const payment = await db.query.payments.findFirst({
    where: eq(payments.reference, reference),
  });
  if (!payment) return error(`Payment ${reference} not found`, 404);

  return json({
    data: {
      ...payment,
      nextAction: {
        channel: payment.channel,
        provider: payment.provider,
        status: payment.status,
        ...approvalInstructions(payment.channel, payment.provider),
      },
    },
  });
}
