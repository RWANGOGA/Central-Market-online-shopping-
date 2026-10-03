/**
 * Currency for the whole app.
 *
 * Prices are stored in Ugandan shillings as whole numbers. The shilling has no
 * commonly used minor unit, so nothing here ever produces decimals.
 */

export const CURRENCY = 'UGX';

/**
 * Mid-market USD -> UGX. Re-measure before trusting these prices in a real
 * market: FX moves, and a stale rate quietly misprices the whole catalogue.
 * Values were converted at this rate on 2026-10-03.
 */
export const USD_TO_UGX = 3960;

/** Convert a USD amount from the original Figma data into whole shillings. */
export function usdToUgx(usd: number): number {
  return Math.round(usd * USD_TO_UGX);
}

/** Format whole shillings for display, e.g. 3524 -> "USh 3,524". */
export function formatUgx(amount: number): string {
  return `USh ${Math.round(amount).toLocaleString('en-US')}`;
}

/** Format with a trailing unit, e.g. formatUgxWithUnit(3524, 'each'). */
export function formatUgxWithUnit(amount: number, unit: string): string {
  return `${formatUgx(amount)} ${unit}`;
}