import { beforeEach, describe, expect, it, vi } from 'vitest';

const { upsertAndReturn, deleteWhere } = vi.hoisted(() => ({
  upsertAndReturn: vi.fn(),
  deleteWhere: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({ returning: upsertAndReturn }),
      }),
    }),
    delete: () => ({ where: deleteWhere }),
  },
}));

import { allow } from './rateLimit';

describe('database-backed fixed-window limiter', () => {
  beforeEach(() => {
    upsertAndReturn.mockReset();
    deleteWhere.mockReset().mockResolvedValue(undefined);
  });

  it('blocks the ninth request when the limit is eight', async () => {
    let count = 0;
    upsertAndReturn.mockImplementation(async () => [{ count: ++count }]);
    const results = await Promise.all(Array.from({ length: 9 }, () => allow('admin-login:test', 8, 15 * 60)));

    expect(results.filter(Boolean)).toHaveLength(8);
    expect(results[8]).toBe(false);
  });
});
