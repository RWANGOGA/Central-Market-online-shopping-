import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { customerSessions, customers } from '@/db/schema';
import { error, json } from '@/lib/http';
import { checkCustomerPassword, createSessionToken, sessionCookie, getSessionExpiry } from '@/lib/customerAuth';
import { pruneExpiredCustomerSessions } from '@/lib/customerSession';
import { allow } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/clientIp';
import { toCustomerDto } from '@/lib/customerDto';

const loginSchema = z.object({
  phone: z.string().trim().min(10).max(32)
    .transform((phone) => phone.replace(/[\s()-]/g, '').replace(/^\+?256/, '0'))
    .refine((phone) => /^07\d{8}$/.test(phone)),
  password: z.string().min(1).max(100),
});
const DUMMY_HASH = 'scrypt$16384$8$1$00000000000000000000000000000000$' +
  '0000000000000000000000000000000000000000000000000000000000000000' +
  '0000000000000000000000000000000000000000000000000000000000000000';

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error('Phone or password is incorrect', 401);

  const normalised = parsed.data.phone;
  const ip = getClientIp(request);
  const phoneAllowed = await allow(`customer-login-phone:${normalised}`, 10, 15 * 60);
  const ipAllowed = ip ? await allow(`customer-login-ip:${ip}`, 30, 15 * 60) : true;
  if (!phoneAllowed || !ipAllowed) return error('Too many login attempts. Try again later.', 429);

  const customer = await db.query.customers.findFirst({ where: eq(customers.phone, normalised) });
  const result = await checkCustomerPassword(parsed.data.password, customer?.passwordHash || DUMMY_HASH);
  if (!customer || !customer.passwordHash || !customer.active || !result.ok) {
    return error('Phone or password is incorrect', 401);
  }

  if (result.upgrade) {
    await db.update(customers).set({ passwordHash: result.upgrade }).where(eq(customers.id, customer.id));
  }

  await pruneExpiredCustomerSessions();
  const { token, tokenHash } = createSessionToken();
  const expiresAt = getSessionExpiry();
  await db.insert(customerSessions).values({
    customerId: customer.id,
    tokenHash,
    expiresAt,
    userAgent: request.headers.get('user-agent')?.slice(0, 200) || null,
  });

  return json(
    { data: toCustomerDto(customer) },
    { headers: { 'Set-Cookie': sessionCookie(token, expiresAt) } },
  );
}
