import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { customerAddresses } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customerSession';
import { error, json } from '@/lib/http';
import { checkLocation } from '@/lib/locationGuard';
import { ugandanPhone } from '@/lib/orderInput';
import { csrfCheck } from '@/lib/security';

type Ctx = { params: Promise<{ id: string }> };

const addressPatchSchema = z.object({
  label: z.string().trim().min(1).max(40).optional(),
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: ugandanPhone.optional(),
  region: z.string().trim().min(1).max(100).optional(),
  district: z.string().trim().max(100).nullable().optional(),
  subCounty: z.string().trim().max(100).nullable().optional(),
  parish: z.string().trim().max(100).nullable().optional(),
  village: z.string().trim().max(100).nullable().optional(),
  address: z.string().trim().min(3).max(500).optional(),
  isDefault: z.boolean().optional(),
}).strict();

/** Only the owner ever sees or edits a row; everyone else gets a 404. */
async function ownedAddress(customerId: number, rawId: string) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return db.query.customerAddresses.findFirst({
    where: and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId)),
  });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const blocked = csrfCheck(request);
  if (blocked) return blocked;

  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);

  const { id } = await params;
  const existing = await ownedAddress(customer.id, id);
  if (!existing) return error('Address not found', 404);

  const parsed = addressPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return error(parsed.success ? 'No updatable fields provided' : 'Invalid address', 422);
  }

  const input = parsed.data;
  const location = await checkLocation({
    region: input.region ?? existing.region,
    district: input.district === undefined ? existing.district : input.district,
    subCounty: input.subCounty === undefined ? existing.subCounty : input.subCounty,
    parish: input.parish === undefined ? existing.parish : input.parish,
    village: input.village === undefined ? existing.village : input.village,
  });
  if (!location.ok) {
    return json({ error: location.message, conflict: { level: location.level } }, { status: 422 });
  }

  const updated = await db.transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx
        .update(customerAddresses)
        .set({ isDefault: false })
        .where(eq(customerAddresses.customerId, customer.id));
    }

    const [row] = await tx
      .update(customerAddresses)
      .set({
        label: input.label ?? existing.label,
        fullName: input.fullName ?? existing.fullName,
        phone: input.phone ?? existing.phone,
        address: input.address ?? existing.address,
        ...location,
        ...(input.isDefault === undefined ? {} : { isDefault: input.isDefault }),
      })
      .where(and(eq(customerAddresses.id, existing.id), eq(customerAddresses.customerId, customer.id)))
      .returning();

    return row;
  });

  return json({ data: updated });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const blocked = csrfCheck(request);
  if (blocked) return blocked;

  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);

  const { id } = await params;
  const existing = await ownedAddress(customer.id, id);
  if (!existing) return error('Address not found', 404);

  await db.transaction(async (tx) => {
    await tx
      .delete(customerAddresses)
      .where(and(eq(customerAddresses.id, existing.id), eq(customerAddresses.customerId, customer.id)));

    // Deleting the default would leave the book without one, so the oldest
    // remaining address takes over.
    if (existing.isDefault) {
      const [next] = await tx
        .select()
        .from(customerAddresses)
        .where(eq(customerAddresses.customerId, customer.id))
        .orderBy(asc(customerAddresses.createdAt), asc(customerAddresses.id))
        .limit(1);
      if (next) {
        await tx
          .update(customerAddresses)
          .set({ isDefault: true })
          .where(eq(customerAddresses.id, next.id));
      }
    }
  });

  return json({ data: { id: existing.id, deleted: true } });
}
