/**
 * One pricing policy for cart review, payment intent creation and order totals.
 * VAT stays at 0 until the rate is confirmed by the accountant.
 */
export const PRICING = {
  freeShippingOver: 100_000,
  shippingFlat: 5_000,
  vatRate: 0,
} as const;

export type CartPricing = {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
};

export function priceCart(subtotal: number): CartPricing {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) {
    throw new RangeError('Cart subtotal must be a non-negative whole number of shillings.');
  }
  const shipping = subtotal >= PRICING.freeShippingOver ? 0 : PRICING.shippingFlat;
  const tax = Math.round(subtotal * PRICING.vatRate);
  return { subtotal, shipping, tax, total: subtotal + shipping + tax };
}
