import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { customerSessions, customers } from '@/db/schema';
import { error, json } from '@/lib/http';
import { verifyPassword, createSessionToken, sessionCookie, clearedCookie, getSessionExpiry } from '@/lib/customerAuth';

const loginSchema = z.object({
  phone: z.string().min(10),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);
  }

  const normalised = parsed.data.phone.replace(/[\s()-]/g, '').replace(/^\+?256/, '0');
  const customer = await db.query.customers.findFirst({ where: eq(customers.phone, normalised) });
  if (!customer) {
    return error('No account found with this phone number.', 401);
  }

  if (!customer.active) {
    return error('This account has been deactivated. Contact support.', 403);
  }

  const valid = await verifyPassword(parsed.data.password, customer.passwordHash);
  if (!valid) {
    return error('Incorrect password.', 401);
  }

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
      headers: {
        'Set-Cookie': sessionCookie(token, expiresAt),
      },
    }
  );
}
