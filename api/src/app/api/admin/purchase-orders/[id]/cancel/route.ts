import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { purchaseOrders } from '@/db/schema';
import { requireRole } from '@/lib/adminAuth';
import { error, json } from '@/lib/http';
import { recordActivity } from '@/lib/activity';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const admin = await requireRole(request, ['owner', 'manager']);
  if (!admin) return error('Not signed in', 401);

  const { id } = await params;
  const key = Number(id);
  if (!Number.isInteger(key) || key <= 0) return error('A purchase order id is required', 400);

  const order = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, key),
  });
  if (!order) return error(`Purchase order ${id} not found`, 404);

  if (order.status === 'cancelled') {
    return error(`Purchase order ${order.reference} is already cancelled.`, 409);
  }
  if (order.status === 'received') {
    return error(
      `Purchase order ${order.reference} was already received and cannot be cancelled.`,
      409,
    );
  }

  const [updated] = await db
    .update(purchaseOrders)
    .set({ status: 'cancelled' })
    .where(eq(purchaseOrders.id, order.id))
    .returning();

  await recordActivity({
    action: 'purchase_order.cancel',
    entity: 'purchase_order',
    entityId: order.reference,
    before: { status: order.status },
    after: { status: 'cancelled' },
    adminId: admin.id,
    adminEmail: admin.email,
  });

  return json({
    data: {
      purchaseOrderId: updated.id,
      reference: updated.reference,
      status: updated.status,
    },
    meta: { cancelledBy: admin.email },
  });
}
