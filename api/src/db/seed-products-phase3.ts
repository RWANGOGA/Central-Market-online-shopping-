import { sql } from 'drizzle-orm';
import { db, queryRows } from './index';
import { productPriceHistory, products } from './schema';

/**
 * Backfills two things for products that existed before Phase 3:
 *
 * 1. `products.updated_at` — set to `created_at` so optimistic concurrency
 *    works for every row, not just ones edited after the field was added.
 * 2. `product_price_history` — one initial entry per product so the price
 *    history endpoint returns the current price as the first row, rather than
 *    appearing empty for products that have never been edited.
 *
 * Idempotent: products that already have history entries are skipped.
 */

async function backfill() {
  console.log('Backfilling product updated_at and initial price history...');

  const updated = (await db.execute(sql`
    UPDATE products
    SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at)
    WHERE updated_at IS NULL OR updated_at = ''
  `)) as { rowCount?: number; changes?: number };

  console.log(`  ${updated?.rowCount ?? updated?.changes ?? 0} product(s) updated.`);

  const inserted = (await db.execute(sql`
    INSERT INTO product_price_history (product_id, price_value, unit, price_label, changed_by_email, created_at)
    SELECT p.id, p.price_value, p.unit, p.price_label, 'system', p.created_at
    FROM products p
    WHERE NOT EXISTS (
      SELECT 1 FROM product_price_history h WHERE h.product_id = p.id
    )
  `)) as { rowCount?: number; changes?: number };

  const historyCount = inserted?.rowCount ?? inserted?.changes ?? 0;
  console.log(`  ${historyCount} initial price history row(s) written.`);

  const totals = await queryRows<{ product: string; n: number }>(sql`
    SELECT p.name AS product, COUNT(h.id) AS n
    FROM products p
    LEFT JOIN product_price_history h ON h.product_id = p.id
    GROUP BY p.id
    ORDER BY n DESC
    LIMIT 5
  `);

  console.log('  Top 5 products by history depth:');
  for (const row of totals) {
    console.log(`    ${row.product}: ${row.n} row(s)`);
  }

  console.log('Done.');
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
