/**
 * Stock is held in each product's own sale unit, so 27 on ginger is 27kg and
 * 120 on garlic is 120 bulbs. Keeping the number and its unit inseparable is
 * what stops a quantity and its label drifting apart.
 */

export type StockState = 'in_stock' | 'low' | 'out';

/**
 * At or below this, a product is flagged for reorder. Scaled to the unit: a
 * kilogram of ginger and a bulb of garlic are not comparable quantities, so a
 * single absolute threshold would flag one and not the other.
 */
export const LOW_STOCK_THRESHOLD = 10;

export function stockState(stock: number, threshold: number = LOW_STOCK_THRESHOLD): StockState {
  if (stock <= 0) return 'out';
  if (stock <= threshold) return 'low';
  return 'in_stock';
}

/** "27kg remaining", "120 each remaining", "Sold out". */
export function describeStock(stock: number, unit: string, threshold: number = LOW_STOCK_THRESHOLD): string {
  if (stock <= 0) return 'Sold out';

  // Whole kilograms read oddly next to a fraction, and stock is always whole
  // here, so no decimal is ever needed.
  const amount = Math.round(stock);
  const noun = `${amount} ${unit}`;

  return stock <= threshold ? `Only ${noun} left` : `${noun} remaining`;
}

/** Share of stock left, for a thin progress bar. */
export function stockFraction(stock: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.max(0, Math.min(1, stock / capacity));
}
