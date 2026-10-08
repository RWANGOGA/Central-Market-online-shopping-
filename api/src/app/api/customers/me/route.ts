import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { customers, orders, orderItems, orderStatusEvents, payments } from '@/db/schema';
import { error, json } from '@/lib/http';

function normalisePhone(raw: string | null): string | null {
  if (!raw) return null;
  return raw.replace(/[\s()-]/g, '').replace(/^\+?256/, '0');
}

async function customerFromRequest(request: Request): Promise<typeof customers.$inferSelect | null> {
  const url = new URL(request.url);
  const phone = normalisePhone(
    request.headers.get('x-customer-phone') ||
      url.searchParams.get('phone') ||
      ''
  );
  if (!phone) return null;
  const row = await db.query.customers.findFirst({ where: eq(customers.phone, phone) });
  return row ?? null;
}

export async function GET(request: Request) {
  const customer = await customerFromRequest(request);
  if (!customer) return error('Provide a customer phone via ?phone= or X-Customer-Phone header', 401);

  const orderCount = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.customerId, customer.id));
  const lastOrder = await db.select().from(orders).where(eq(orders.customerId, customer.id)).orderBy(desc(orders.createdAt)).limit(1);

  return json({
    data: {
      ...customer,
      orderCount: Number(orderCount[0]?.count ?? 0),
      lastOrderAt: lastOrder[0]?.createdAt ?? null,
    },
  });
}

export async function PATCH(request: Request) {
  const customer = await customerFromRequest(request);
  if (!customer) return error('Provide a customer phone via ?phone= or X-Customer-Phone header', 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return error('Invalid payload', 422);

  const allowed = ['fullName', 'email', 'region', 'district', 'subCounty', 'parish', 'village', 'address'] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) return error('No updatable fields provided', 422);

  const [updated] = await db.update(customers).set(updates).where(eq(customers.id, customer.id)).returning();

  return json({ data: updated });
}
