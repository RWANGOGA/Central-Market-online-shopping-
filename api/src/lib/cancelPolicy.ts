/**
 * Who may end an order, and why not.
 *
 * Kept apart from `orderCancellation` on purpose: the transactional half needs
 * a database, while this decision is pure. The customer-facing order view needs
 * the rule, and being able to ask it without opening a connection keeps the
 * projection testable.
 */

/**
 * Which statuses a customer may end themselves.
 *
 * Deliberately narrower than the staff machine. Once picking starts the goods
 * may already be packed and a rider assigned, so the customer has to ask rather
 * than cancel.
 */
export const CUSTOMER_CANCELLABLE: readonly string[] = ['pending'];

export function customerCancelBlocker(status: string): string | null {
  if (CUSTOMER_CANCELLABLE.includes(status)) return null;
  switch (status) {
    case 'processing':
      return 'Picking has already started, so this order needs staff to cancel it. Send a note to the market team.';
    case 'shipped':
      return 'A rider is already carrying this order, so it cannot be cancelled here. Refuse the delivery, or contact us once it arrives.';
    case 'delivered':
      return 'This order was delivered. Anything wrong with it is a return or a refund, which staff handle.';
    case 'cancelled':
      return 'This order is already cancelled.';
    default:
      return 'This order cannot be cancelled right now.';
  }
}
