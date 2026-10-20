/**
 * Fulfilment state machine for orders.
 *
 * Kept out of the route files because Next.js only permits HTTP method exports
 * there. Payment lives on payments.status; this is about goods moving, which is
 * a different axis. A paid order that has not shipped is simply "processing".
 */

export const ORDER_FLOW = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
} as const;

export type OrderStatus = keyof typeof ORDER_FLOW;

export function isOrderStatus(value: string): value is OrderStatus {
  return Object.prototype.hasOwnProperty.call(ORDER_FLOW, value);
}

/** False for anything not explicitly permitted, so a typo cannot widen access. */
export function canTransition(from: string, to: string): boolean {
  const allowed = (ORDER_FLOW as Record<string, readonly string[]>)[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

export function allowedNext(from: string): readonly string[] {
  const allowed = (ORDER_FLOW as Record<string, readonly string[]>)[from];
  return Array.isArray(allowed) ? allowed : [];
}
