import { z } from 'zod';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { customers, orders } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customerSession';
import { error, json } from '@/lib/http';
import { checkLocation } from '@/lib/locationGuard';
import { toCustomerDto } from '@/lib/customerDto';
import { ugandanPhone } from '@/lib/orderInput';
import { isUniqueViolationOn } from '@/lib/dbErrors';

export const dynamic = 'force-dynamic';

const profilePatchSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  /** The sign-in number. Changing it is allowed, but it must still be free. */
  phone: ugandanPhone.optional(),
  email: z.union([z.string().email().max(254), z.literal(''), z.null()]).optional(),
  region: z.string().trim().min(1).max(100).optional(),
  district: z.string().trim().max(100).nullable().optional(),
  subCounty: z.string().trim().max(100).nullable().optional(),
  parish: z.string().trim().max(100).nullable().optional(),
  village: z.string().trim().max(100).nullable().optional(),
  address: z.string().trim().min(3).max(500).optional(),
}).strict();

const LOCATION_KEYS = ['region', 'district', 'subCounty', 'parish', 'village'] as const;

/**
 * Names what the client got wrong.
 *
 * A strict schema rejects unknown keys, and the Details form once sent a field
 * the schema had never heard of. Every save then failed with one opaque string
 * and nothing pointed at the cause.
 */
function describeIssues(issues: z.ZodError['issues']): string {
  const unknown = issues.find((issue) => issue.code === 'unrecognized_keys');
  if (unknown) {
    const keys = (unknown as { keys?: string[] }).keys ?? [];
    return `Unsupported ${keys.length === 1 ? 'field' : 'fields'}: ${keys.join(', ')}`;
  }
  return issues[0]?.message ?? 'Invalid profile details';
}

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
  if (!parsed.success) return error(describeIssues(parsed.error.issues), 422);

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) return error('No updatable fields provided', 422);

  const email = updates.email === undefined ? undefined : updates.email === '' ? null : updates.email;

  if (updates.phone !== undefined && updates.phone !== customer.phone) {
    const taken = await db.query.customers.findFirst({
      where: and(eq(customers.phone, updates.phone), ne(customers.id, customer.id)),
      columns: { id: true },
    });
    if (taken) {
      return error('That number already belongs to another account. Sign in with it instead.', 409);
    }
  }

  if (email && email !== customer.email) {
    const taken = await db.query.customers.findFirst({
      where: and(eq(customers.email, email), ne(customers.id, customer.id)),
      columns: { id: true },
    });
    if (taken) return error('That email already belongs to another account.', 409);
  }

  const set: Partial<typeof customers.$inferInsert> = {};
  if (updates.fullName !== undefined) set.fullName = updates.fullName;
  if (updates.address !== undefined) set.address = updates.address;
  if (updates.phone !== undefined) set.phone = updates.phone;
  if (email !== undefined) set.email = email;

  /**
   * The geo guard only runs when the address was actually edited.
   *
   * Rows written before the region/district tables existed hold names the
   * guard rejects, so re-validating an untouched address would lock a shopper
   * out of saving their own name. Their stored location stays exactly as it is
   * until they change it, and then it has to be real.
   */
  const locationTouched = LOCATION_KEYS.some(
    (key) => updates[key] !== undefined && (updates[key] ?? '') !== (customer[key] ?? ''),
  );

  if (locationTouched) {
    const location = await checkLocation({
      region: updates.region ?? customer.region,
      district: updates.district === undefined ? customer.district : updates.district,
      subCounty: updates.subCounty === undefined ? customer.subCounty : updates.subCounty,
      parish: updates.parish === undefined ? customer.parish : updates.parish,
      village: updates.village === undefined ? customer.village : updates.village,
    });
    if (!location.ok) {
      return json({ error: location.message, conflict: { level: location.level } }, { status: 422 });
    }

    const { ok: _ok, ...resolved } = location;
    Object.assign(set, resolved);
  }

  let updated;
  try {
    [updated] = await db.update(customers).set(set).where(eq(customers.id, customer.id)).returning();
  } catch (err) {
    // The checks above race; the unique indexes are the real authority.
    if (isUniqueViolationOn(err, ['phone'])) {
      return error('That number already belongs to another account. Sign in with it instead.', 409);
    }
    if (isUniqueViolationOn(err, ['email'])) return error('That email already belongs to another account.', 409);
    throw err;
  }

  return json({ data: toCustomerDto(updated) });
}
