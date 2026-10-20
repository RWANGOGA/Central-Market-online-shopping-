import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';
import { requireAdmin } from '@/lib/catalogue';
import { describeStock, stockState } from '@/lib/stock';
import { error, json } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const admin = await requireAdmin(_request);
  if (!admin) return error('Not signed in', 401);

  const { id } = await params;
  const key = Number(id);
  const existing = await db.query.products.findFirst({
    where: Number.isInteger(key) ? eq(products.id, key) : eq(products.slug, id),
  });
  if (!existing) return error(`Product "${id}" not found`, 404);
  if (existing.active) return error(`Product "${id}" is already active.`, 409);

  const [updated] = await db
    .update(products)
    .set({ active: true, updatedAt: sql`datetime('now')` as unknown as string })
    .where(eq(products.id, existing.id))
    .returning();

  return json({
    data: {
      ...updated,
      stockState: stockState(updated.stock),
      remaining: describeStock(updated.stock, updated.unit),
      images: updated.imageFiles.map((file) => `/api/assets/${file}`),
    },
    meta: {
      restoredBy: admin.email,
      note: 'Product is visible in the catalogue again.',
    },
  });
}
