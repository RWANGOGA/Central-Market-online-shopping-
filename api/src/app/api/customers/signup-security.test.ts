import { beforeEach, describe, expect, it, vi } from 'vitest';

const { allow } = vi.hoisted(() => ({ allow: vi.fn() }));
vi.mock('@/db', () => ({ db: { insert: vi.fn() } }));
vi.mock('@/lib/clientIp', () => ({ getClientIp: () => null }));
vi.mock('@/lib/rateLimit', () => ({ allow }));

import { POST } from './signup/route';

const body = {
  fullName: 'Amina Nabirye',
  phone: '0772123456',
  password: 'strongPassphrase82',
  region: 'Central',
  address: 'Market Street',
};
const makeRequest = (payload = body) => new Request('http://localhost/api/customers/signup', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});

describe('customer signup protection', () => {
  beforeEach(() => allow.mockReset().mockResolvedValue(true));

  it('does not query or write accounts before phone ownership verification is configured', async () => {
    const first = await POST(makeRequest());
    const second = await POST(makeRequest({ ...body, phone: '0772999999' }));
    const firstBody = await first.text();
    const secondBody = await second.text();

    expect(first.status).toBe(503);
    expect(second.status).toBe(503);
    expect(firstBody).toBe(secondBody);
    expect(firstBody).not.toContain('0772123456');
    expect(first.headers.get('set-cookie')).toBeNull();
    expect(second.headers.get('set-cookie')).toBeNull();
  });

  it('rejects passwords under eight characters', async () => {
    const response = await POST(makeRequest({ ...body, password: 'short' }));
    expect(response.status).toBe(422);
  });
});
