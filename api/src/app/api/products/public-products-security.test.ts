import { describe, expect, it, vi } from 'vitest';

const { requireAdmin } = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const { where, orderBy } = vi.hoisted(() => ({ where: vi.fn(), orderBy: vi.fn() }));
const activeProduct = {
  id: 1, slug: 'tomato', name: 'Tomato', description: 'Fresh tomato product', farm: 'Local farm',
  location: 'Central', priceValue: 1000, priceLabel: 'USh 1,000 each', currency: 'UGX', unit: 'each',
  imageFiles: [], dietary: [], stock: 5, active: true, createdAt: '2026-01-01 00:00:00', updatedAt: '',
};

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        $dynamic: () => ({ where, orderBy }),
      }),
    }),
  },
}));
vi.mock('@/lib/catalogue', () => ({ requireAdmin }));

import { GET } from './route';

it('ignores includeInactive for a public catalogue request', async () => {
  requireAdmin.mockResolvedValue(null);
  where.mockReturnValue({ orderBy });
  orderBy.mockResolvedValue([activeProduct]);

  const response = await GET(new Request('http://localhost/api/products?includeInactive=true'));
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(requireAdmin).toHaveBeenCalledOnce();
  expect(where).toHaveBeenCalledOnce();
  expect(body.data).toHaveLength(1);
});
