import type { Payment, Refund } from '@/db/schema';

/**
 * What an order's money looks like, derived rather than stored.
 *
 * Paid, cash-on-delivery and refunded amounts live in separate rows, so the
 * summary is computed from them. Keeping it in one pure function means the
 * order list, the order detail and the refund route all agree on what "paid"
 * means, and the rule is testable without a database.
 */

export type MoneyState =
  | 'unpaid'
  | 'cod_due'
  | 'paid'
  | 'part_refunded'
  | 'refunded'
  | 'refund_due';

export type OrderMoney = {
  /** Money actually received. */
  paid: number;
  /** Cash a rider still has to collect. */
  codDue: number;
  /** Paid money not yet paid back; the most a refund may be. */
  refundable: number;
  refunded: number;
  /** paid minus refunded. Negative only if data was edited outside the app. */
  net: number;
  state: MoneyState;
  /** A cancelled order that still holds the customer's money. */
  refundDue: boolean;
  currency: string;
};

export type PaymentLike = Pick<Payment, 'status' | 'amount' | 'currency'>;
export type RefundLike = Pick<Refund, 'status' | 'amount'>;

export const MONEY_LABELS: Record<MoneyState, string> = {
  unpaid: 'Unpaid',
  cod_due: 'Cash to collect',
  paid: 'Paid',
  part_refunded: 'Partly refunded',
  refunded: 'Refunded',
  refund_due: 'Refund due',
};

export function summariseMoney(
  payments: readonly PaymentLike[],
  refunds: readonly RefundLike[],
  orderStatus: string,
): OrderMoney {
  let paid = 0;
  let codDue = 0;
  let currency = 'UGX';

  for (const payment of payments) {
    if (payment.status === 'succeeded') {
      paid += payment.amount;
      currency = payment.currency;
    } else if (payment.status === 'cod') {
      codDue += payment.amount;
      currency = payment.currency;
    }
    // pending/awaiting_approval/failed/cancelled hold no money yet.
  }

  // Only recorded refunds moved money; a cancelled entry is a correction.
  const refunded = refunds
    .filter((refund) => refund.status === 'recorded')
    .reduce((sum, refund) => sum + refund.amount, 0);

  const net = paid - refunded;
  const refundable = Math.max(0, net);
  const refundDue = orderStatus === 'cancelled' && net > 0;

  let state: MoneyState;
  if (refundDue) {
    state = 'refund_due';
  } else if (refunded > 0) {
    state = net > 0 ? 'part_refunded' : 'refunded';
  } else if (codDue > 0) {
    state = 'cod_due';
  } else if (paid > 0) {
    state = 'paid';
  } else {
    state = 'unpaid';
  }

  return { paid, codDue, refundable, refunded, net, state, refundDue, currency };
}
