import { json } from '@/lib/http';
import { PAYMENT_METHODS } from '@/lib/payments';

export async function GET() {
  return json({
    data: Object.entries(PAYMENT_METHODS).map(([channel, methods]) => ({
      channel,
      methods: methods.map((method) => ({ ...method, channel })),
    })),
    meta: {
      currency: 'UGX',
      requiresApproval: ['mobile_money', 'wallet'],
      note: 'The amount, delivery fee and final payable total are computed on the server when the intent is created. The client never supplies an amount.',
    },
  });
}