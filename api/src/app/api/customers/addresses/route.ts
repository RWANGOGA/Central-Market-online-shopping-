import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { customerAddresses } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customerSession';
import { error, json } from '@/lib/http';
import { checkLocation } from '@/lib/locationGuard';
import { ugandanPhone } from '@/lib/orderInput';
import { csrfCheck } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * A saved delivery address.
 *
 * The administrative chain is validated by the same guard the order endpoint
 * uses, so anything stored here can be handed to checkout unmodified.
 */
const addressInputSchema = z.object({
  label: z.string().trim().min(1).max(40),
  fullName: z.string().trim().min(2).max(120),
  phone: ugandanPhone,
  region: z.string().trim().min(1).max(100),
  district: z.string().trim().max(100).nullable().optional(),
  subCounty: z.string().trim().max(100).nullable().optional(),
  parish: z.string().trim().max(100).nullable().optional(),
  village: z.string().trim().max(100).nullable().optional(),
  address: z.string().trim().min(3).max(500),
  isDefault: z.boolean().optional(),
}).strict();

const MAX_ADDRESSES = 10;

export async function GET(request: Request) {
  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);

  const rows = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customer.id))
    .orderBy(desc(customerAddresses.isDefault), asc(customerAddresses.createdAt), asc(customerAddresses.id));

  return json({ data: rows });
}

export async function POST(request: Request) {
  const blocked = csrfCheck(request);
  if (blocked) return blocked;

  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);

  const parsed = addressInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? 'Invalid address', 422);

  const input = parsed.data;
  const location = await checkLocation(input);
  if (!location.ok) {
    return json({ error: location.message, conflict: { level: location.level } }, { status: 422 });
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customer.id));
  const count = Number(countRow?.count ?? 0);
  if (count >= MAX_ADDRESSES) {
    return error(`You can save up to ${MAX_ADDRESSES} addresses. Delete one to add another.`, 409);
  }

  // The first address is the default by definition; later ones only when asked.
  const makeDefault = input.isDefault === true || count === 0;

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(customerAddresses)
      .values({
        customerId: customer.id,
        label: input.label,
        fullName: input.fullName,
        phone: input.phone,
        region: location.region,
        district: location.district,
        subCounty: location.subCounty,
        parish: location.parish,
        village: location.village,
        address: input.address,
        isDefault: makeDefault,
      })
      .returning();

    if (makeDefault) {
      await tx
        .update(customerAddresses)
        .set({ isDefault: false })
        .where(and(eq(customerAddresses.customerId, customer.id), ne(customerAddresses.id, row.id)));
    }

    return row;
  });

  return json({ data: created }, { status: 201 });
}
