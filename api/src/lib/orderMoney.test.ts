import { describe, expect, it } from 'vitest';
import { summariseMoney, type PaymentLike, type RefundLike } from './orderMoney';

function payment(status: PaymentLike['status'], amount: number): PaymentLike {
  return { status, amount, currency: 'UGX' };
}

function refund(status: RefundLike['status'], amount: number): RefundLike {
  return { status, amount };
}

describe('summariseMoney', () => {
  it('treats an order with no payment rows as unpaid', () => {
    const money = summariseMoney([], [], 'pending');
    expect(money).toMatchObject({ paid: 0, codDue: 0, state: 'unpaid', refundDue: false });
  });

  it('counts only succeeded payments as paid', () => {
    const money = summariseMoney(
      [payment('awaiting_approval', 5000), payment('succeeded', 12000), payment('failed', 900)],
      [],
      'processing',
    );
    expect(money.paid).toBe(12000);
    expect(money.state).toBe('paid');
  });

  it('reports cash on delivery as due until it is collected', () => {
    const money = summariseMoney([payment('cod', 25000)], [], 'processing');
    expect(money.codDue).toBe(25000);
    expect(money.paid).toBe(0);
    expect(money.state).toBe('cod_due');
  });

  it('flags a cancelled order that still holds money as a refund due', () => {
    const money = summariseMoney([payment('succeeded', 25000)], [], 'cancelled');
    expect(money.refundDue).toBe(true);
    expect(money.state).toBe('refund_due');
    expect(money.refundable).toBe(25000);
  });

  it('stops calling a cancelled order refund due once the money is back', () => {
    const money = summariseMoney(
      [payment('succeeded', 25000)],
      [refund('recorded', 25000)],
      'cancelled',
    );
    expect(money.refundDue).toBe(false);
    expect(money.refundable).toBe(0);
    expect(money.state).toBe('refunded');
  });

  it('keeps the remaining balance refundable after a partial refund', () => {
    const money = summariseMoney(
      [payment('succeeded', 40000)],
      [refund('recorded', 15000)],
      'delivered',
    );
    expect(money.refunded).toBe(15000);
    expect(money.refundable).toBe(25000);
    expect(money.state).toBe('part_refunded');
  });

  it('sums several refunds and ignores voided ones', () => {
    const money = summariseMoney(
      [payment('succeeded', 40000)],
      [refund('recorded', 10000), refund('recorded', 5000), refund('cancelled', 20000)],
      'delivered',
    );
    expect(money.refunded).toBe(15000);
    expect(money.refundable).toBe(25000);
  });

  it('never reports a negative refundable amount', () => {
    const money = summariseMoney(
      [payment('succeeded', 10000)],
      [refund('recorded', 12000)],
      'delivered',
    );
    expect(money.net).toBe(-2000);
    expect(money.refundable).toBe(0);
    expect(money.state).toBe('refunded');
  });
});
