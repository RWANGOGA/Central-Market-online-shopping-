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
  discount: number;
  shipping: number;
  tax: number;
  total: number;
};

export function priceCart(subtotal: number, discount = 0): CartPricing {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) {
    throw new RangeError('Cart subtotal must be a non-negative whole number of shillings.');
  }
  if (!Number.isSafeInteger(discount) || discount < 0) {
    throw new RangeError('Discount must be a non-negative whole number of shillings.');
  }
  const shipping = subtotal >= PRICING.freeShippingOver ? 0 : PRICING.shippingFlat;
  // A discount never exceeds the goods it applies to, and shipping is decided
  // by the pre-discount subtotal so a code cannot also unlock free delivery.
  const applied = Math.min(discount, subtotal);
  const tax = Math.round((subtotal - applied) * PRICING.vatRate);
  return { subtotal, discount: applied, shipping, tax, total: subtotal - applied + shipping + tax };
}
