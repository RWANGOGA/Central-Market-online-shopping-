import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { productPriceHistory, products } from '@/db/schema';
import { requireAdmin, priceLabelFor } from '@/lib/catalogue';
import { error, json } from '@/lib/http';

const changeSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'ids is required'),
  priceValue: z.number().int().min(1).max(100_000_000).optional(),
  unit: z.enum(['kg', 'each', 'pint', 'bunch', 'crate']).optional(),
  lowStockThreshold: z.number().int().min(0).max(1_000_000).optional(),
  reorderQuantity: z.number().int().min(0).max(1_000_000).optional(),
  supplierId: z.number().int().positive().optional(),
}).refine((data) => Object.keys(data).some((key) => key !== 'ids'), {
  message: 'At least one change is required.',
  path: ['changes'],
});

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return error('Not signed in', 401);

  const parsed = changeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);
  }

  const { ids, priceValue, unit, lowStockThreshold, reorderQuantity, supplierId } = parsed.data;

  const rows = await db.query.products.findMany({
    where: (t, { inArray: inArrayOp }) => inArrayOp(t.id, ids),
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  const results = [];
  for (const id of ids) {
    const existing = byId.get(id);
    if (!existing) {
      results.push({ id, status: 'not_found' });
      continue;
    }

    const set: Partial<typeof products.$inferInsert> = {};
    set.updatedAt = sql`datetime('now')` as unknown as string;

    let priceChanged = false;
    let unitChanged = false;

    if (priceValue !== undefined) {
      set.priceValue = priceValue;
      priceChanged = priceValue !== existing.priceValue;
    }
    if (unit !== undefined) {
      set.unit = unit;
      unitChanged = unit !== existing.unit;
    }
    if (lowStockThreshold !== undefined) set.lowStockThreshold = lowStockThreshold;
    if (reorderQuantity !== undefined) set.reorderQuantity = reorderQuantity;
    if (supplierId !== undefined) set.supplierId = supplierId;

    const finalUnit = unit ?? existing.unit;
    const finalPrice = priceValue ?? existing.priceValue;
    if (priceValue !== undefined || unit !== undefined) {
      set.priceLabel = priceLabelFor(finalPrice, finalUnit);
    }

    try {
      const [updated] = await db.transaction(async (tx) => {
        const [row] = await tx.update(products).set(set).where(eq(products.id, id)).returning();

        if (priceChanged || unitChanged) {
          await tx.insert(productPriceHistory).values({
            productId: row.id,
            priceValue: row.priceValue,
            unit: row.unit,
            priceLabel: row.priceLabel,
            changedByAdminId: admin.id,
            changedByEmail: admin.email,
          });
        }

        return [row];
      });

      results.push({ id, status: 'updated', priceChanged, unitChanged });
    } catch (err) {
      results.push({ id, status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  const updatedCount = results.filter((r) => r.status === 'updated').length;
  return json({
    data: results,
    meta: {
      requested: ids.length,
      updated: updatedCount,
      failed: ids.length - updatedCount,
      changedBy: admin.email,
    },
  });
}
