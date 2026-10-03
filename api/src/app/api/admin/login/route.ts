import { z } from 'zod';
import { login, sessionCookie, SESSION_HOURS } from '@/lib/adminAuth';
import { error, json } from '@/lib/http';

const loginSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error('Enter an email and a password', 422);

  const result = await login(
    parsed.data.email,
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
