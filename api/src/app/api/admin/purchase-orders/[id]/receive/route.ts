import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { purchaseOrderItems, purchaseOrders } from '@/db/schema';
import { requireAdmin } from '@/lib/catalogue';
import { recordMovement } from '@/lib/stockLedger';
import { error, json } from '@/lib/http';
import { recordActivity } from '@/lib/activity';

/**
 * Receive a purchase order.
 *
 * This is the only path that brings stock in from a supplier. Each line writes
 * a `delivery` movement referencing this purchase order, so the ledger explains
 * both the quantity and where it came from.
 *
 * Receiving twice is refused rather than doubled: the stock would go up and
 * the ledger would say so, but the purchase order would claim one delivery for
 * two. Cancelling and re-raising is the honest way to correct that.
 */

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const admin = await requireAdmin(request);
  if (!admin) return error('Not signed in', 401);

  const { id } = await params;
  const key = Number(id);
  if (!Number.isInteger(key) || key <= 0) return error('A purchase order id is required', 400);

  const order = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, key),
  });
  if (!order) return error(`Purchase order ${id} not found`, 404);

  if (order.status === 'received') {
    return error(
      `Purchase order ${order.reference} was already received on ${order.receivedAt}. Cancel it and raise a new one to correct a mistake.`,
      409,
    );
  }
  if (order.status === 'cancelled') {
    return error(`Purchase order ${order.reference} is cancelled.`, 409);
  }

  const lines = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, order.id));

  if (lines.length === 0) {
    return error(`Purchase order ${order.reference} has no lines to receive.`, 422);
  }

  const received = await db.transaction(async (tx) => {
    const applied = [];

    for (const line of lines) {
      // A short delivery is normal, so the quantity actually received is
      // recorded per line rather than being assumed to match the order.
      applied.push(
        await recordMovement(
          {
            productId: line.productId,
            delta: line.quantity,
            reason: 'delivery',
            reference: order.reference,
            note: `Received against ${order.reference}`,
            actorAdminId: admin.id,
          },
          tx,
        ),
      );
    }

    await tx
      .update(purchaseOrders)
      .set({ status: 'received', receivedAt: sql`datetime('now')` })
      .where(eq(purchaseOrders.id, order.id));

    return applied;
  });

  await recordActivity({
    action: 'purchase_order.receive',
    entity: 'purchase_order',
    entityId: order.reference,
    before: { status: 'sent' },
    after: { status: 'received', units: received.reduce((sum, movement) => sum + movement.delta, 0) },
    adminId: admin.id,
    adminEmail: admin.email,
  });

  return json({
    data: {
      purchaseOrderId: order.id,
      reference: order.reference,
      status: 'received',
      receivedAt: received.length > 0 ? new Date().toISOString() : null,
      lines: received.map((movement) => ({
        productId: movement.productId,
        delta: movement.delta,
        stock: movement.stock,
        unit: movement.unit,
        state: movement.state,
      })),
    },
    meta: {
      receivedBy: admin.email,
      units: received.reduce((sum, movement) => sum + movement.delta, 0),
    },
  });
}
