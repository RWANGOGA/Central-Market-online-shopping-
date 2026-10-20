import { z } from 'zod';
import { login, sessionCookie, SESSION_HOURS, MAX_ATTEMPTS, ATTEMPT_WINDOW_MINUTES } from '@/lib/adminAuth';
import { error, json } from '@/lib/http';
import { allow } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/clientIp';

const loginSchema = z.object({
  email: z.string().min(3).max(254),
  password: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error('Enter an email and a password', 422);

  const email = parsed.data.email.trim().toLowerCase();
  const ip = getClientIp(request);
  // Never lock an account solely by email; the IP dimension prevents a third
  // party from denying access to the real administrator.
  const emailAndIpAllowed = ip
    ? await allow(`admin-login:${email}:${ip}`, MAX_ATTEMPTS, ATTEMPT_WINDOW_MINUTES * 60)
    : true;
  const ipAllowed = ip ? await allow(`admin-login-ip:${ip}`, 30, ATTEMPT_WINDOW_MINUTES * 60) : true;
  if (!emailAndIpAllowed || !ipAllowed) return error('Too many failed attempts. Try again later.', 429);

  const result = await login(
    email,
    parsed.data.password,
    request.headers.get('user-agent'),
  );

  if (!result.ok) {
    return json({ error: result.error }, { status: result.status });
  }

  return json(
    {
      data: {
        admin: result.admin,
        expiresAt: result.expiresAt,
        expiresInHours: SESSION_HOURS,
      },
    },
    {
      status: 200,
      headers: { 'set-cookie': sessionCookie(result.token, result.expiresAt) },
    },
  );
}
