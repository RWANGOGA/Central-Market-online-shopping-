import { z } from 'zod';
import { error, json } from '@/lib/http';
import { isCommonPassword } from '@/lib/customerAuth';
import { getClientIp } from '@/lib/clientIp';
import { allow } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(10).max(32)
    .transform((phone) => phone.replace(/[\s()-]/g, '').replace(/^\+?256/, '0'))
    .refine((phone) => /^07\d{8}$/.test(phone), 'Enter a valid Ugandan phone number.'),
  email: z.string().email().max(254).optional(),
  password: z.string().min(8).max(100).refine((password) => !isCommonPassword(password), 'Choose a less common password.'),
  region: z.string().trim().min(1).max(100),
  district: z.string().trim().max(100).optional(),
  address: z.string().trim().min(3).max(500),
}).strict();

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (ip && !(await allow(`customer-signup-ip:${ip}`, 5, 60 * 60))) {
    return error('Too many signup attempts. Try again later.', 429);
  }

  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  // Registration remains closed until a phone OTP provider is configured. This
  // avoids creating an account/session for a number the requester does not own.
  return json({ error: 'Phone verification is temporarily unavailable. Please try again later.' }, { status: 503 });
}
