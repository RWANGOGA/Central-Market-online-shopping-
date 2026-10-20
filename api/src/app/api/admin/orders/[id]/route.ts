import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { orderItems, orderStatusEvents, orders, payments, nowText } from '@/db/schema';
import { requireAdmin } from '@/lib/catalogue';
import { guardAdmin } from '@/lib/adminAuth';
import { recordMovement } from '@/lib/stockLedger';
import { ORDER_FLOW, allowedNext, canTransition, isOrderStatus } from '@/lib/orderFlow';
import { error, json } from '@/lib/http';
import { publishOrderEvent } from '@/lib/orderEvents';
import { recordActivity } from '@/lib/activity';
import { createCustomerNotification } from '@/lib/notifications';

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
  const guard = await guardAdmin(request, 'orders.write');
  if (!guard.ok) return error(guard.message, guard.status);
  const admin = guard.admin;

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

  // Payment gates fulfilment. Stock is reserved when the order is placed, so a
  // pending order is goods held for someone who has not paid yet; staff must
  // not start picking it on the strength of the order existing.
  if (existing.status === 'pending' && status === 'processing') {
    const paid = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(eq(payments.orderId, existing.id), inArray(payments.status, ['succeeded', 'cod'])),
      )
      .limit(1);
    if (paid.length === 0) {
      return error('This order has not been paid. Take payment before starting fulfilment.', 409);
    }
  }

  // Cancelling hands the goods back, so stock returns. It goes through the
  // ledger with a reference to this order rather than being written to
  // products.stock directly, which is what keeps SUM(delta) equal to the cached
  // figure. Anything already delivered cannot be returned.
  const returningStock = status === 'cancelled' && existing.status !== 'delivered';

  const updated = await db.transaction(async (tx) => {
    // Compare-and-set: the expected status is in the WHERE clause, so a
    // request racing this one loses instead of applying the transition (and
    // returning the stock) a second time.
    const [row] = await tx
      .update(orders)
      .set({ status, updatedAt: nowText })
      .where(and(eq(orders.id, existing.id), eq(orders.status, existing.status)))
      .returning();
    if (!row) return null;

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

    // An order that is cancelled settles no money: any attempt still in flight
    // is closed so the dashboard does not show a payment awaiting approval on
    // a dead order.
    if (status === 'cancelled') {
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
    }

    return row;
  });

  if (!updated) {
    return error(
      'This order changed while you were working on it. Reload and check its current status.',
      409,
    );
  }

  await recordActivity({
    action: 'order.status',
    entity: 'order',
    entityId: updated.reference,
    before: { status: existing.status },
    after: { status: updated.status },
    adminId: admin.id,
    adminEmail: admin.email,
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

  // Signed-in customers hear about the change in their inbox. Guest orders
  // have no customerId and are tracked by reference instead.
  if (updated.customerId) {
    await createCustomerNotification({
      customerId: updated.customerId,
      type: 'order',
      title:
        status === 'cancelled'
          ? 'Order cancelled'
          : status === 'delivered'
            ? 'Order delivered'
            : status === 'shipped'
              ? 'Order on its way'
              : 'Order update',
      message:
        status === 'cancelled'
          ? `Order ${updated.reference} was cancelled. Any stock held for it has been returned.`
          : `Order ${updated.reference} is now ${status}.`,
    });
  }

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
