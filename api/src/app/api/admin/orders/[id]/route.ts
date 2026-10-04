import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { orderItems, orders, payments } from '@/db/schema';
import { requireAdmin } from '@/lib/catalogue';
import { ORDER_FLOW, allowedNext, canTransition, isOrderStatus } from '@/lib/orderFlow';
import { error, json } from '@/lib/http';

/**
 * Staff-only order management.
 *
 * This replaces an unauthenticated `PATCH /api/orders/:id`, which let anyone
 * who could reach the API mark any order fulfilled or cancelled.
 *
 * The transition is validated here rather than in the UI, because the UI is
 * not the only thing that can call this.
 */

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  status: z.string().min(1),
  note: z.string().max(500).optional(),
});

export async function PATCH(request: Request, { params }: Ctx) {
  const admin = await requireAdmin(request);
  if (!admin) return error('Not signed in', 401);

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error('A status is required', 422);

  const { status, note } = parsed.data;

  const { id } = await params;
  const key = Number(id);

  const order = await db.query.orders.findFirst({
    where: Number.isInteger(key) ? eq(orders.id, key) : eq(orders.reference, id),
  });
  if (!order) return error(`Order "${id}" not found`, 404);

  if (!isOrderStatus(status)) {
    return error(
      `"${status}" is not a fulfilment state. Use one of: ${Object.keys(ORDER_FLOW).join(', ')}.`,
      422,
    );
  }

  if (!canTransition(order.status, status)) {
    const allowed = allowedNext(order.status);
    return error(
      allowed.length > 0
        ? `An order that is ${order.status} can only become: ${allowed.join(', ')}.`
        : `An order that is ${order.status} cannot change.`,
      409,
    );
  }

  const [updated] = await db
    .update(orders)
    .set({
      status,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(orders.id, order.id))
    .returning();

  // Recorded in order_status_events once that table exists in phase 1. Until
  // then the changed_by and note would have nowhere to live, so the change is
  // returned for the caller to log.
  return json({
    data: updated,
    meta: {
      changedBy: admin.email,
      previousStatus: order.status,
      note: note ?? null,
    },
  });
}

export async function GET(request: Request, { params }: Ctx) {
  const admin = await requireAdmin(request);
  if (!admin) return error('Not signed in', 401);

  const { id } = await params;
  const key = Number(id);

  const order = await db.query.orders.findFirst({
    where: Number.isInteger(key) ? eq(orders.id, key) : eq(orders.reference, id),
  });
  if (!order) return error(`Order "${id}" not found`, 404);

  const [lines, orderPayments] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(payments).where(eq(payments.orderId, order.id)),
  ]);

  return json({ data: { ...order, items: lines, payments: orderPayments } });
}
