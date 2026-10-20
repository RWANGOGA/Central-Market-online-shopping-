import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { requireRole } from '@/lib/adminAuth';
import { error, json } from '@/lib/http';
import { recordActivity } from '@/lib/activity';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const admin = await requireRole(request, ['owner']);
  if (!admin) return error('Not signed in', 401);

  const { id } = await params;
  const key = Number(id);
  if (!Number.isInteger(key) || key <= 0) return error('A customer id is required', 400);

  const existing = await db.query.customers.findFirst({
    where: eq(customers.id, key),
  });
  if (!existing) return error(`Customer ${id} not found`, 404);

  if (!existing.active) {
    return error(`Customer ${existing.fullName} is already inactive.`, 409);
  }

  const [updated] = await db
    .update(customers)
    .set({ active: false })
    .where(eq(customers.id, existing.id))
    .returning();

  await recordActivity({
    action: 'customer.deactivate',
    entity: 'customer',
    entityId: updated.id,
    before: { active: true, fullName: existing.fullName, phone: existing.phone },
    after: { active: false, fullName: updated.fullName, phone: updated.phone },
    adminId: admin.id,
    adminEmail: admin.email,
  });

  return json({
    data: {
      id: updated.id,
      fullName: updated.fullName,
      phone: updated.phone,
      active: updated.active,
    },
    meta: { deactivatedBy: admin.email },
  });
}
