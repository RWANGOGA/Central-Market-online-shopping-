import { describe, expect, it } from 'vitest';
import { priceCart, PRICING } from './pricing';

describe('shared cart pricing', () => {
  it('charges the flat fee below the free-shipping threshold', () => {
    expect(priceCart(99_999)).toEqual({ subtotal: 99_999, discount: 0, shipping: 5_000, tax: 0, total: 104_999 });
  });

  it('waives shipping at the threshold and keeps VAT disabled pending confirmation', () => {
    expect(priceCart(100_000)).toEqual({ subtotal: 100_000, discount: 0, shipping: 0, tax: 0, total: 100_000 });
    expect(PRICING.vatRate).toBe(0);
  });

  it('takes a discount off the goods but keeps delivery priced on the full basket', () => {
    expect(priceCart(60_000, 10_000)).toEqual({
      subtotal: 60_000,
      discount: 10_000,
      shipping: 5_000,
      tax: 0,
      total: 55_000,
    });
  });

  it('never discounts more than the goods are worth', () => {
    expect(priceCart(10_000, 25_000)).toMatchObject({ discount: 10_000, total: 5_000 });
  });

  it('rejects invalid subtotals and discounts', () => {
    expect(() => priceCart(-1)).toThrow(RangeError);
    expect(() => priceCart(1.5)).toThrow(RangeError);
    expect(() => priceCart(10_000, -500)).toThrow(RangeError);
    expect(() => priceCart(10_000, 0.5)).toThrow(RangeError);
  });
});
