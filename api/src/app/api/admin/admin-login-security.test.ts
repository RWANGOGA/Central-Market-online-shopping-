import { beforeEach, describe, expect, it, vi } from 'vitest';

const { allow, login } = vi.hoisted(() => ({ allow: vi.fn(), login: vi.fn() }));
vi.mock('@/lib/rateLimit', () => ({ allow }));
vi.mock('@/lib/adminAuth', () => ({
  login,
  sessionCookie: () => 'mk_admin_session=test',
  SESSION_HOURS: 12,
  MAX_ATTEMPTS: 8,
  ATTEMPT_WINDOW_MINUTES: 15,
}));

import { POST } from './login/route';

beforeEach(() => {
  process.env.TRUST_PROXY = 'true';
  allow.mockReset();
  login.mockReset().mockResolvedValue({ ok: false, status: 401, error: 'Email or password is incorrect.' });
});

describe('admin login attempt limiting', () => {
  it('returns 429 on the ninth attempt in the fixed window', async () => {
    let emailAndIpCount = 0;
    allow.mockImplementation(async (key: string) => {
      if (key.startsWith('admin-login:')) return ++emailAndIpCount <= 8;
      return true;
    });

    const makeRequest = () => new Request('http://localhost/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
      body: JSON.stringify({ email: 'owner@example.test', password: 'wrong-password' }),
    });
    const responses = [];
    for (let i = 0; i < 9; i += 1) responses.push(await POST(makeRequest()));

    expect(responses.slice(0, 8).every((response) => response.status === 401)).toBe(true);
    expect(responses[8].status).toBe(429);
    expect(login).toHaveBeenCalledTimes(8);
  });
});
