import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { customers, orders, orderItems, orderStatusEvents, payments } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customerSession';
import { error, json } from '@/lib/http';

export async function GET(request: Request) {
  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);

  const orderCount = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.customerId, customer.id));
  const lastOrder = await db.select().from(orders).where(eq(orders.customerId, customer.id)).orderBy(desc(orders.createdAt)).limit(1);

  return json({
    data: {
      id: customer.id,
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      region: customer.region,
      district: customer.district,
      subCounty: customer.subCounty,
      parish: customer.parish,
      village: customer.village,
      address: customer.address,
      createdAt: customer.createdAt,
      orderCount: Number(orderCount[0]?.count ?? 0),
      lastOrderAt: lastOrder[0]?.createdAt ?? null,
    },
  });
}

export async function PATCH(request: Request) {
  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return error('Invalid payload', 422);

  const allowed = ['fullName', 'email', 'region', 'district', 'subCounty', 'parish', 'village', 'address'] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) return error('No updatable fields provided', 422);

  const [updated] = await db.update(customers).set(updates).where(eq(customers.id, customer.id)).returning();

  return json({
    data: {
      id: updated.id,
      fullName: updated.fullName,
      phone: updated.phone,
      email: updated.email,
      region: updated.region,
      district: updated.district,
      subCounty: updated.subCounty,
      parish: updated.parish,
      village: updated.village,
      address: updated.address,
    },
  });
}
