import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';
import { error, json } from '@/lib/http';
import { LOW_STOCK_THRESHOLD, describeStock, stockState } from '@/lib/stock';

/**
 * Inventory management.
 *
 * GET  ?lowStock=true   everything at or below the reorder threshold
 * GET  ?summary=true    counts by state, for a dashboard header
 *
 * Read only. Adjusting stock moved to PATCH /api/admin/inventory/products/:id,
 * which requires a staff session, because this route previously let anyone set
 * stock to any value.
 *
 * Stock is held in the product's own sale unit, so "27" on ginger means 27kg.
 */

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
