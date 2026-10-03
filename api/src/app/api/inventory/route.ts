import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { products } from '@/db/schema';
import { error, json } from '@/lib/http';
import { LOW_STOCK_THRESHOLD, describeStock, stockState, type StockState } from '@/lib/stock';

/**
 * Inventory management.
 *
 * GET  ?lowStock=true   everything at or below the reorder threshold
 * GET  ?summary=true    counts by state, for a dashboard header
 * PATCH                 adjust stock for one product
 *
 * Stock is held in the product's own sale unit, so "27" on ginger means 27kg.
 * There is no separate unit column on the row beyond `unit`, which is what
 * keeps a quantity and its label from drifting apart.
 */

const patchSchema = z.object({
  productId: z.number().int().positive(),
  /** Signed delta. Negative draws stock down, positive receives a delivery. */
  delta: z.number().int(),
  reason: z.string().max(200).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lowStockOnly = url.searchParams.get('lowStock') === 'true';
  const summaryOnly = url.searchParams.get('summary') === 'true';

  // Number(null) is 0, so an absent parameter has to be handled before
  // parsing or the threshold silently becomes zero.
  const rawThreshold = url.searchParams.get('threshold');
  const parsedThreshold = rawThreshold === null ? NaN : Number(rawThreshold);
  const effectiveThreshold =
    Number.isInteger(parsedThreshold) && parsedThreshold >= 0
      ? parsedThreshold
      : LOW_STOCK_THRESHOLD;

  const rows = await db.select().from(products).orderBy(products.name);

  const described = rows.map((row) => {
    const state = stockState(row.stock, effectiveThreshold);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      priceLabel: row.priceLabel,
      unit: row.unit,
      stock: row.stock,
      state,
      /** e.g. "27 kg remaining" — the label and the figure cannot disagree. */
      remaining: describeStock(row.stock, row.unit, effectiveThreshold),
      inStock: row.stock > 0 && row.active,
    };
  });

  const summary = {
    total: described.length,
    inStock: described.filter((p) => p.state === 'in_stock').length,
    lowStock: described.filter((p) => p.state === 'low').length,
    outOfStock: described.filter((p) => p.state === 'out').length,
    threshold: effectiveThreshold,
  };

  if (summaryOnly) return json({ data: summary });

  const data = lowStockOnly ? described.filter((p) => p.state !== 'in_stock') : described;

  return json({ data, meta: { ...summary, threshold: effectiveThreshold } });
}

export async function PATCH(request: Request) {
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const { productId, delta, reason } = parsed.data;
  if (delta === 0) return error('delta must not be zero', 422);

  const product = await db.query.products.findFirst({ where: eq(products.id, productId) });
  if (!product) return error(`Product ${productId} not found`, 404);

  const next = product.stock + delta;

  if (next < 0) {
    return error(
      `Cannot remove ${Math.abs(delta)} from ${product.name}: only ${product.stock}${product.unit} in stock.`,
      409,
    );
  }

  const [updated] = await db
    .update(products)
    .set({ stock: next })
    .where(eq(products.id, productId))
    .returning();

  const state: StockState = stockState(updated.stock);

  return json({
    data: {
      ...updated,
      state,
      remaining: describeStock(updated.stock, updated.unit),
    },
    meta: {
      previous: product.stock,
      delta,
      reason: reason ?? null,
    },
  });
}
