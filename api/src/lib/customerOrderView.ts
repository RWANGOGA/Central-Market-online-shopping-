import type {
  Order,
  OrderItem,
  OrderStatusEvent,
  Payment,
  Refund,
} from '@/db/schema';
import { toPaymentDto, type PaymentDto } from '@/lib/payments';
import { toTimelineDto, type PublicTimelineEvent } from '@/lib/orderTimeline';
import { summariseMoney, MONEY_LABELS, type OrderMoney } from '@/lib/orderMoney';
import { customerCancelBlocker } from '@/lib/cancelPolicy';

/**
 * One order as the person who placed it is allowed to see it.
 *
 * History and the tracking page used to show a status and a total and nothing
 * about money, so a customer could not tell whether they had paid, whether a
 * rider was still coming for cash, or whether a refund had been recorded. The
 * derived summary answers that, and it is derived here rather than stored so
 * the customer and staff consoles cannot disagree.
 */

export type CustomerRefundDto = {
  reference: string;
  amount: number;
  currency: string;
  method: Refund['method'];
  reason: string;
  status: Refund['status'];
  createdAt: string;
};

/**
 * Which staff refund a customer may see.
 *
 * `cancelled` entries void a mistaken record, so including them would show
 * money coming back that was never handed over. Only recorded money counts.
 */
export function toRefundDto(refund: Refund): CustomerRefundDto {
  return {
    reference: refund.reference,
    amount: refund.amount,
    currency: refund.currency,
    method: refund.method,
    reason: refund.reason,
    status: refund.status,
    createdAt: refund.createdAt,
  };
}

export type CustomerOrderView = Omit<Order, 'trackingTokenHash'> & {
  items: OrderItem[];
  timeline: PublicTimelineEvent[];
  payments: PaymentDto[];
  /** Money actually handed back, newest first is not assumed. */
  refunds: CustomerRefundDto[];
  money: OrderMoney & { label: string };
  cancel: {
    allowed: boolean;
    /** Why not, in a sentence the interface can show as it stands. */
    reason: string | null;
  };
};

export function customerOrderView(input: {
  order: Order;
  items: OrderItem[];
  payments: Payment[];
  refunds: Refund[];
  timeline: OrderStatusEvent[];
}): CustomerOrderView {
  const { order, payments, refunds, timeline, items } = input;

  // The hash is the credential behind the tracking link. Ownership has already
  // been proved by whoever called this, so it never belongs in a response.
  const { trackingTokenHash: _trackingTokenHash, ...safe } = order;

  const money = summariseMoney(payments, refunds, order.status);
  const blocker = customerCancelBlocker(order.status);

  return {
    ...safe,
    items,
    timeline: timeline.map(toTimelineDto),
    payments: payments.map(toPaymentDto),
    refunds: refunds.filter((refund) => refund.status === 'recorded').map(toRefundDto),
    money: { ...money, label: MONEY_LABELS[money.state] },
    cancel: { allowed: blocker === null, reason: blocker },
  };
}
