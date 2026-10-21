import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  orderItems,
  orderStatusEvents,
  orders,
  payments,
  nowText,
  type Order,
} from '@/db/schema';
import { recordMovement } from '@/lib/stockLedger';

/**
 * Cancelling an order, in one place.
 *
 * Staff and customers can both end an order, and the money consequences must
 * not depend on who pressed the button: the goods go back through the stock
 * ledger, any payment still in flight is closed, and the timeline records the
 * change. Duplicating that in two routes is how the two versions drift, so
 * both call this.
 */

export type CancelActor =
  | { kind: 'admin'; adminId: number; adminEmail: string }
  | { kind: 'customer' };

export type CancelOutcome =
  /** Applied. `stockReturned` says whether goods went back. */
  | { ok: true; order: Order; stockReturned: boolean }
  /** The order moved while we were working, so nothing was written. */
  | { ok: false; reason: 'raced' };

export async function cancelOrder(
  order: Order,
  actor: CancelActor,
  note: string | null = null,
): Promise<CancelOutcome> {
  // Delivered goods are with the customer, so they are not coming back. The
  // status still changes, which is how a staff-managed return gets recorded.
  const stockReturned = order.status !== 'delivered';

  const updated = await db.transaction(async (tx) => {
    // Compare-and-set: the status we read is in the WHERE clause, so a second
    // cancellation cannot return the same stock to the ledger twice.
    const [row] = await tx
      .update(orders)
      .set({ status: 'cancelled', updatedAt: nowText })
      .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
      .returning();
    if (!row) return null;

    await tx.insert(orderStatusEvents).values({
      orderId: row.id,
      fromStatus: order.status,
      toStatus: 'cancelled',
      note,
      changedByAdminId: actor.kind === 'admin' ? actor.adminId : null,
      changedByEmail: actor.kind === 'admin' ? actor.adminEmail : 'customer',
    });

    if (stockReturned) {
      const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, row.id));
      for (const line of lines) {
        await recordMovement(
          {
            productId: line.productId,
            delta: line.quantity,
            reason: 'return',
            reference: row.reference,
            note: `Returned from cancelled order ${row.reference}`,
            actorAdminId: actor.kind === 'admin' ? actor.adminId : null,
            actorLabel: actor.kind === 'admin' ? null : 'customer',
          },
          tx,
        );
      }
    }

    // A cancelled order settles no money, so any attempt still in flight is
    // closed. Its settlement token is dropped with it: a prompt that was
    // already sent must not be able to take payment for a dead order.
    await tx
      .update(payments)
      .set({
        status: 'cancelled',
        failureReason: 'Order cancelled',
        settlementTokenHash: null,
        updatedAt: nowText,
      })
      .where(
        and(
          eq(payments.orderId, row.id),
          inArray(payments.status, ['pending', 'awaiting_approval', 'processing']),
        ),
      );

    return row;
  });

  if (!updated) return { ok: false, reason: 'raced' };
  return { ok: true, order: updated, stockReturned };
}

/**
 * Which statuses a customer may end themselves, and the explanation for every
 * refusal, live in `cancelPolicy` so the customer order view can ask them
 * without importing this module's database handle.
 */
export { CUSTOMER_CANCELLABLE, customerCancelBlocker } from '@/lib/cancelPolicy';
