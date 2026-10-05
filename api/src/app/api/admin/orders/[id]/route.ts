import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { orderItems, orderStatusEvents, orders, payments } from '@/db/schema';
import { requireAdmin } from '@/lib/catalogue';
import { recordMovement } from '@/lib/stockLedger';
import { ORDER_FLOW, allowedNext, canTransition, isOrderStatus } from '@/lib/orderFlow';
import { error, json } from '@/lib/http';
import { publishOrderEvent } from '@/lib/orderEvents';

/**
 * Staff order detail and fulfilment.
 *
 * Replaces an unauthenticated `PATCH /api/orders/:id`, which let anyone who
 * could reach the API mark any order fulfilled or cancelled.
 *
 * Every accepted transition writes an `order_status_events` row in the same
 * transaction as the status change, so the timeline cannot drift from the
 * order's actual state.
 */

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  status: z.string().min(1),
  note: z.string().max(500).optional(),
});

async function findOrder(id: string) {
  const key = Number(id);
  return db.query.orders.findFirst({
    where: Number.isInteger(key) ? eq(orders.id, key) : eq(orders.reference, id),
  });
}

export async function GET(request: Request, { params }: Ctx) {
  const admin = await requireAdmin(request);
  if (!admin) return error('Not signed in', 401);

  const { id } = await params;
  const order = await findOrder(id);
  if (!order) return error(`Order "${id}" not found`, 404);

  const [lines, orderPayments, timeline] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(payments).where(eq(payments.orderId, order.id)),
    db
      .select()
      .from(orderStatusEvents)
      .where(eq(orderStatusEvents.orderId, order.id))
      .orderBy(asc(orderStatusEvents.createdAt), asc(orderStatusEvents.id)),
  ]);

  return json({
    data: {
      ...order,
      items: lines,
      payments: orderPayments,
      timeline,
      // What staff may do next, so the UI does not re-implement the machine.
      nextStatuses: allowedNext(order.status),
    },
  });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const admin = await requireAdmin(request);
  if (!admin) return error('Not signed in', 401);

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error('A status is required', 422);

  const { status, note } = parsed.data;
  const { id } = await params;
  const existing = await findOrder(id);
  if (!existing) return error(`Order "${id}" not found`, 404);

  if (!isOrderStatus(status)) {
    return error(
      `"${status}" is not a fulfilment state. Use one of: ${Object.keys(ORDER_FLOW).join(', ')}.`,
      422,
    );
  }

  if (!canTransition(existing.status, status)) {
    const allowed = allowedNext(existing.status);
    return error(
      allowed.length > 0
        ? `An order that is ${existing.status} can only become: ${allowed.join(', ')}.`
        : `An order that is ${existing.status} cannot change.`,
      409,
    );
  }

  // Cancelling hands the goods back, so stock returns. It goes through the
  // ledger with a reference to this order rather than being written to
  // products.stock directly, which is what keeps SUM(delta) equal to the cached
  // figure. Anything already delivered cannot be returned.
  const returningStock = status === 'cancelled' && existing.status !== 'delivered';

  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(orders)
      .set({ status, updatedAt: sql`datetime('now')` })
      .where(eq(orders.id, existing.id))
      .returning();

    await tx.insert(orderStatusEvents).values({
      orderId: row.id,
      fromStatus: existing.status,
      toStatus: status,
      note: note ?? null,
      changedByAdminId: admin.id,
      changedByEmail: admin.email,
    });

    if (returningStock) {
      const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, row.id));
      for (const line of lines) {
        await recordMovement(
          {
            productId: line.productId,
            delta: line.quantity,
            reason: 'return',
            reference: row.reference,
            note: `Returned from cancelled order ${row.reference}`,
            actorAdminId: admin.id,
          },
          tx,
        );
      }
    }

    return [row];
  });

  const timeline = await db
    .select()
    .from(orderStatusEvents)
    .where(eq(orderStatusEvents.orderId, updated.id))
    .orderBy(asc(orderStatusEvents.createdAt), asc(orderStatusEvents.id));

  // Tell any open dashboard, so the queue moves without a refresh.
  publishOrderEvent({
    type: 'order.status',
    id: updated.id,
    reference: updated.reference,
    from: existing.status,
    to: status,
    total: updated.total,
    currency: updated.currency,
    region: updated.region,
    district: updated.district,
    customerName: updated.customerName,
    at: updated.updatedAt,
  });

  return json({
    data: { ...updated, timeline, nextStatuses: allowedNext(updated.status) },
    meta: {
      changedBy: admin.email,
      previousStatus: existing.status,
      note: note ?? null,
      // Staff need to know the goods went back, not assume it.
      stockReturned: returningStock,
      stockReturnNote: returningStock
        ? 'Each line was returned through the stock ledger, referencing this order.'
        : null,
    },
  });
}
