import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { error, json } from '@/lib/http';
import { checkLocation } from '@/lib/locationGuard';

/**
 * Upsert a customer by mobile number.
 *
 * The administrative chain is validated before anything is written, so a
 * payload pairing Central Region with a Northern district is rejected with 422
 * and an explanation rather than stored. The client cascade prevents that
 * from being reachable through the UI; this is what stops it being reachable
 * any other way.
 */

const phoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s()-]/g, '').replace(/^\+?256/, '0'))
  .refine((value) => /^07\d{8}$/.test(value), {
    message: 'Enter a Ugandan number, for example 0772 123 456',
  });

const customerSchema = z.object({
  fullName: z.string().min(1),
  phone: phoneSchema,
  email: z.string().email().optional(),
  region: z.string().min(1),
  district: z.string().optional(),
  subCounty: z.string().optional(),
  parish: z.string().optional(),
  village: z.string().optional(),
  address: z.string().min(3),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const phone = url.searchParams.get('phone')?.replace(/[\s()-]/g, '').replace(/^\+?256/, '0');
  const email = url.searchParams.get('email');

  if (!phone && !email) {
    return error('Provide "phone" or "email"', 400);
  }

  const row = phone
    ? await db.query.customers.findFirst({ where: eq(customers.phone, phone) })
    : await db.query.customers.findFirst({ where: eq(customers.email, email!) });

  if (!row) return error('No customer with that phone or email', 404);

  return json({ data: row });
}

export async function POST(request: Request) {
  const parsed = customerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);
  }

  const input = parsed.data;

  // Enforce top-down integrity before touching the database.
  const location = await checkLocation({
    region: input.region,
    district: input.district,
    subCounty: input.subCounty,
    parish: input.parish,
    village: input.village,
  });

  if (!location.ok) {
    return json(
      {
        error: location.message,
        conflict: { level: location.level },
      },
      { status: 422 },
    );
  }

  const record = {
    fullName: input.fullName,
    phone: input.phone,
    email: input.email ?? null,
    address: input.address,
    region: location.region,
    district: location.district,
    subCounty: location.subCounty,
    parish: location.parish,
    village: location.village,
  };

  const existing = await db.query.customers.findFirst({
    where: eq(customers.phone, input.phone),
  });

  const row = existing
    ? await db.update(customers).set(record).where(eq(customers.id, existing.id)).returning()
    : await db.insert(customers).values(record).returning();

  return json({ data: row[0] }, { status: existing ? 200 : 201 });
}
