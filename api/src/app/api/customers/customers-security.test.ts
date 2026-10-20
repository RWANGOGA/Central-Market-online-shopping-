import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findFirst, returning, values, insert } = vi.hoisted(() => {
  const returning = vi.fn();
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  return { findFirst: vi.fn(), returning, values, insert };
});

const customerRow = {
  id: 7,
  fullName: 'Amina Nabirye',
  phone: '0772123456',
  email: null,
  passwordHash: 'sensitive-password-hash',
  region: 'Central',
  district: null,
  subCounty: null,
  parish: null,
  village: null,
  address: 'Market Street',
  active: true,
  createdAt: '2026-01-01 00:00:00',
};

vi.mock('@/db', () => ({
  db: {
    query: { customers: { findFirst } },
    insert,
  },
}));

vi.mock('@/lib/locationGuard', () => ({
  checkLocation: vi.fn(async (input: { region: string }) => ({
    ok: true,
    region: input.region,
    district: null,
    subCounty: null,
    parish: null,
    village: null,
  })),
}));

import { GET, POST } from './route';

beforeEach(() => {
  findFirst.mockReset();
  returning.mockReset();
  values.mockClear();
  insert.mockClear();
});

describe('public customer collection routes', () => {
  it('does not return a customer row or password hash to an unauthenticated caller', async () => {
    findFirst.mockResolvedValue(customerRow);
    const response = await GET(new Request('http://localhost/api/customers?phone=0772123456'));
    const body = await response.text();

    expect([401, 404]).toContain(response.status);
    expect(body).not.toContain('passwordHash');
    expect(body).not.toContain('sensitive-password-hash');
  });

  it('does not allow unauthenticated customer creation or overwrite', async () => {
    findFirst.mockResolvedValue(null);
    returning.mockResolvedValue([customerRow]);
    const response = await POST(new Request('http://localhost/api/customers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Amina Nabirye',
        phone: '0772123456',
        region: 'Central',
        address: 'Market Street',
      }),
    }));

    expect([401, 404]).toContain(response.status);
    expect(insert).not.toHaveBeenCalled();
  });
});
