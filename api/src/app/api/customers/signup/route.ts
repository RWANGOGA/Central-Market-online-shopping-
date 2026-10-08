import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customers, customerSessions } from '@/db/schema';
import { error, json } from '@/lib/http';
import { hashPassword, createSessionToken, sessionCookie, getSessionExpiry } from '@/lib/customerAuth';
import { checkLocation } from '@/lib/locationGuard';

const signupSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  password: z.string().min(6).max(100),
  region: z.string().min(1),
  district: z.string().optional(),
  subCounty: z.string().optional(),
  parish: z.string().optional(),
  village: z.string().optional(),
  address: z.string().min(3),
});

export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);
  }

  const input = parsed.data;

  const normalised = input.phone.replace(/[\s()-]/g, '').replace(/^\+?256/, '0');
  const existing = await db.query.customers.findFirst({ where: eq(customers.phone, normalised) });
  if (existing) {
    return error('An account with this phone number already exists.', 409);
  }

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
      { status: 422 }
    );
  }

  const passwordHash = await hashPassword(input.password);

  const [customer] = await db
    .insert(customers)
    .values({
      fullName: input.fullName.trim(),
      phone: normalised,
      email: input.email?.trim() || null,
      passwordHash,
      region: location.region,
      district: location.district,
      subCounty: location.subCounty,
      parish: location.parish,
      village: location.village,
      address: input.address.trim(),
    })
    .returning();

  const { token, tokenHash } = createSessionToken();
  const expiresAt = getSessionExpiry();

  await db.insert(customerSessions).values({
    customerId: customer.id,
    tokenHash,
    expiresAt,
    userAgent: request.headers.get('user-agent')?.slice(0, 200) || null,
  });

  return json(
    {
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
      },
      meta: { token, expiresAt },
    },
    {
      status: 201,
      headers: {
        'Set-Cookie': sessionCookie(token, expiresAt),
      },
    }
  );
}
