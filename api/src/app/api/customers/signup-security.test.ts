import { beforeEach, describe, expect, it, vi } from 'vitest';

const { allow, findFirst, insertValues, checkLocation } = vi.hoisted(() => ({
  allow: vi.fn(),
  findFirst: vi.fn(),
  insertValues: vi.fn(),
  checkLocation: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: { customers: { findFirst } },
    insert: () => ({ values: insertValues }),
    delete: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
  },
}));
vi.mock('@/lib/clientIp', () => ({ getClientIp: () => null }));
vi.mock('@/lib/rateLimit', () => ({ allow }));
// checkLocation reads the regions/districts tables. This file is about who may
// be created, not about the delivery map, so the guard is stood in for.
vi.mock('@/lib/locationGuard', () => ({ checkLocation }));

import { POST } from './signup/route';

const body = {
  fullName: 'Amina Nabirye',
  phone: '0772123456',
  email: 'amina@example.test',
  password: 'strongPassphrase82',
  region: 'Central Region',
  address: 'Market Street',
};

const makeRequest = (payload: unknown = body) =>
  new Request('http://localhost/api/customers/signup', {
    method: 'POST',
    // `host` has to be set by hand: csrfCheck skips when it cannot compare an
    // Origin against a Host, and a synthetic Request carries neither.
    headers: { 'content-type': 'application/json', origin: 'http://localhost', host: 'localhost' },
    body: JSON.stringify(payload),
  });

/** The row Postgres would hand back from `returning()`. */
const createdRow = {
  id: 41,
  fullName: 'Amina Nabirye',
  phone: '0772123456',
  email: 'amina@example.test',
  passwordHash: 'scrypt$16384$8$1$aa$bb',
  region: 'Central Region',
  district: null,
  subCounty: null,
  parish: null,
  village: null,
  address: 'Market Street',
  active: true,
  createdAt: '2026-10-21 09:00:00',
};

describe('customer signup', () => {
  beforeEach(() => {
    allow.mockReset().mockResolvedValue(true);
    findFirst.mockReset().mockResolvedValue(undefined);
    insertValues.mockReset().mockReturnValue({ returning: async () => [createdRow] });
    checkLocation.mockReset().mockImplementation(async (input: { region: string }) => ({
      ok: true,
      region: input.region,
      district: null,
      subCounty: null,
      parish: null,
      village: null,
    }));
  });

  it('creates the account and starts a session', async () => {
    const response = await POST(makeRequest());
    expect(response.status).toBe(200);

    const stored = insertValues.mock.calls[0][0];
    expect(stored.phone).toBe('0772123456');
    expect(stored.email).toBe('amina@example.test');
    // The raw password must never reach the row, and neither may a bare hash
    // of it that an offline attack could test cheaply.
    expect(stored.passwordHash).not.toContain(body.password);
    expect(stored.passwordHash.startsWith('scrypt$')).toBe(true);

    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('mk_customer_session=');
    expect(cookie).toContain('HttpOnly');
  });

  it('normalises the number, so the same phone cannot register twice by formatting it differently', async () => {
    await POST(makeRequest({ ...body, phone: '+256 772 123 456' }));
    expect(insertValues.mock.calls[0][0].phone).toBe('0772123456');
  });

  it('refuses a number that is already registered without writing anything', async () => {
    findFirst.mockResolvedValueOnce({ id: 7 });
    const response = await POST(makeRequest());
    expect(response.status).toBe(409);
    expect(insertValues).not.toHaveBeenCalled();
    const text = await response.text();
    expect(text).toContain('Sign in instead');
    // This confirms a number is registered, which login deliberately does not.
    // The trade is accepted for signup because "sign in instead" is the answer
    // people need, and the per-address and per-number ceilings bound a sweep.
    expect(text).not.toContain('0772123456');
  });

  it('refuses an email already in use', async () => {
    findFirst.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: 8 });
    const response = await POST(makeRequest());
    expect(response.status).toBe(409);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('answers a unique-index race the same as the pre-check, not with a 500', async () => {
    insertValues.mockReturnValue({
      returning: async () => {
        throw Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'customers_phone_unique',
        });
      },
    });
    const response = await POST(makeRequest());
    expect(response.status).toBe(409);
  });

  it('requires an email address', async () => {
    const { email: _email, ...withoutEmail } = body;
    const response = await POST(makeRequest(withoutEmail));
    expect(response.status).toBe(422);
    expect(insertValues).not.toHaveBeenCalled();
    // A missing field fails on its type, and Zod's wording for that is
    // "Invalid input: expected string, received undefined". A shopper cannot
    // act on that, so the label is used instead.
    const text = await response.text();
    expect(text).toContain('Please enter an email address.');
    expect(text).not.toContain('Invalid input');
  });

  it('does not promise a recovery route that does not exist yet', async () => {
    findFirst.mockResolvedValueOnce({ id: 7 });
    const response = await POST(makeRequest());
    expect(await response.text()).not.toContain('recover');
  });

  it('rejects short and common passwords', async () => {
    expect((await POST(makeRequest({ ...body, password: 'short' }))).status).toBe(422);
    expect((await POST(makeRequest({ ...body, password: 'password123' }))).status).toBe(422);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('rejects a number that is not a Ugandan mobile', async () => {
    const response = await POST(makeRequest({ ...body, phone: '0200123456' }));
    expect(response.status).toBe(422);
  });

  it('names an unexpected field instead of ignoring it', async () => {
    const response = await POST(makeRequest({ ...body, isAdmin: true }));
    expect(response.status).toBe(422);
    expect(await response.text()).toContain('isAdmin');
  });

  it('refuses a location the market cannot deliver to', async () => {
    checkLocation.mockResolvedValueOnce({ ok: false, level: 'region', message: 'Choose a real region.' });
    const response = await POST(makeRequest({ ...body, region: 'Mars Region' }));
    expect(response.status).toBe(422);
    expect(insertValues).not.toHaveBeenCalled();
    expect(await response.text()).toContain('Choose a real region.');
  });

  it('stops one number being registered over and over', async () => {
    allow.mockImplementation(async (key: string) => !key.startsWith('customer-signup-phone:'));
    const response = await POST(makeRequest());
    expect(response.status).toBe(429);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('refuses a cross-site registration', async () => {
    const response = await POST(
      new Request('http://localhost/api/customers/signup', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://evil.example',
          host: 'localhost',
        },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(403);
    expect(insertValues).not.toHaveBeenCalled();
  });
});
