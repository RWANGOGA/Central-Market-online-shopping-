import { describe, expect, it } from 'vitest';
import { priceCart, PRICING } from './pricing';

describe('shared cart pricing', () => {
  it('charges the flat fee below the free-shipping threshold', () => {
    expect(priceCart(99_999)).toEqual({ subtotal: 99_999, shipping: 5_000, tax: 0, total: 104_999 });
  });

  it('waives shipping at the threshold and keeps VAT disabled pending confirmation', () => {
    expect(priceCart(100_000)).toEqual({ subtotal: 100_000, shipping: 0, tax: 0, total: 100_000 });
    expect(PRICING.vatRate).toBe(0);
  });

  it('rejects invalid subtotals', () => {
    expect(() => priceCart(-1)).toThrow(RangeError);
    expect(() => priceCart(1.5)).toThrow(RangeError);
  });
});
