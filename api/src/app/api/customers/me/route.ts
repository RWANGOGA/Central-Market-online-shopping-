import { z } from 'zod';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { customers, orders } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customerSession';
import { error, json } from '@/lib/http';
import { checkLocation } from '@/lib/locationGuard';
import { toCustomerDto } from '@/lib/customerDto';

export const dynamic = 'force-dynamic';

const profilePatchSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.union([z.string().email().max(254), z.literal(''), z.null()]).optional(),
  region: z.string().trim().min(1).max(100).optional(),
  district: z.string().trim().max(100).nullable().optional(),
  subCounty: z.string().trim().max(100).nullable().optional(),
  parish: z.string().trim().max(100).nullable().optional(),
  village: z.string().trim().max(100).nullable().optional(),
  address: z.string().trim().min(3).max(500).optional(),
}).strict();

export async function GET(request: Request) {
  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);

  const [orderCount, lastOrder] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.customerId, customer.id)),
    db.select().from(orders).where(eq(orders.customerId, customer.id)).orderBy(desc(orders.createdAt)).limit(1),
  ]);

  return json({ data: {
    ...toCustomerDto(customer),
    createdAt: customer.createdAt,
    orderCount: Number(orderCount[0]?.count ?? 0),
    lastOrderAt: lastOrder[0]?.createdAt ?? null,
  } });
}

export async function PATCH(request: Request) {
  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);

  const body = await request.json().catch(() => null);
  const parsed = profilePatchSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return error(parsed.success ? 'No updatable fields provided' : 'Invalid profile details', 422);
  }

  const updates = parsed.data;
  const mergedLocation = {
    region: updates.region ?? customer.region,
    district: updates.district === undefined ? customer.district : updates.district,
    subCounty: updates.subCounty === undefined ? customer.subCounty : updates.subCounty,
    parish: updates.parish === undefined ? customer.parish : updates.parish,
    village: updates.village === undefined ? customer.village : updates.village,
  };
  const location = await checkLocation(mergedLocation);
  if (!location.ok) return json({ error: location.message, conflict: { level: location.level } }, { status: 422 });

  const [updated] = await db.update(customers).set({
    ...updates,
    email: updates.email === '' ? null : updates.email,
    ...location,
  }).where(eq(customers.id, customer.id)).returning();
  return json({ data: toCustomerDto(updated) });
}
