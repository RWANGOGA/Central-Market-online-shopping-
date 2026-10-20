import { sql } from 'drizzle-orm';
import { db } from './index';
import { stockMovements } from './schema';

/**
 * Seeds one opening movement per product.
 *
 * `products.stock` existed before the ledger did, so without an opening entry
 * the sum of every movement would be zero while the stock column said
 * something else, and reconciliation would report every product as wrong from
 * the first day. The opening entry is what makes the identity hold: it records
 * the balance the shop already had, so later movements explain only later
 * changes.
 *
 * Idempotent: only products with no movements at all are seeded.
 */

async function seedOpeningBalances() {
  console.log('Seeding opening stock balances...');

  const result = (await db.run(sql`
    INSERT INTO stock_movements (product_id, delta, reason, reference, note, actor_label, created_at)
    SELECT
      p.id,
      p.stock,
      'opening',
      NULL,
      'Balance carried over when the stock ledger was introduced',
      'system',
      COALESCE(p.created_at, datetime('now'))
    FROM products p
    WHERE p.stock > 0
      AND NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.product_id = p.id)
  `)) as { rowsAffected?: number; changes?: number };

  const inserted = result?.rowsAffected ?? result?.changes ?? 0;
  console.log(`  ${inserted} opening balance(s) written.`);

  // Anything already adjusted before the ledger existed shows up as drift.
  // Rather than silently reseting a database or quietly editing the stock
  // column, write a correction movement so the difference becomes visible and
  // stays auditable. This is a one-time reconciliation for historical data.
  const corrected = await db.all<{ id: number; name: string; stock: number; ledger_total: number; drift: number }>(sql`
    SELECT p.id, p.name, p.stock,
           COALESCE(SUM(m.delta), 0) AS ledger_total,
           p.stock - COALESCE(SUM(m.delta), 0) AS drift
    FROM products p
    LEFT JOIN stock_movements m ON m.product_id = p.id
    GROUP BY p.id
    HAVING p.stock <> COALESCE(SUM(m.delta), 0)
  `);

  if (corrected.length > 0) {
    console.log(`  reconciling ${corrected.length} product(s) changed before the ledger existed:`);
    await db.run(sql`
      INSERT INTO stock_movements (product_id, delta, reason, reference, note, actor_label, created_at)
      SELECT p.id,
             p.stock - COALESCE(SUM(m.delta), 0),
             'correction',
             NULL,
             'Opening balance reconciled after the stock ledger was introduced',
             'system',
             datetime('now')
      FROM products p
      LEFT JOIN stock_movements m ON m.product_id = p.id
      GROUP BY p.id
      HAVING p.stock <> COALESCE(SUM(m.delta), 0)
    `);
    for (const row of corrected) {
      console.log(`    ${row.name}: ${row.stock} on hand vs ${row.ledger_total} in the ledger, recorded ${row.drift >= 0 ? '+' : ''}${row.drift}`);
    }
  } else {
    console.log('  no pre-ledger drift to reconcile.');
  }

  // The reconciliation identity, checked rather than assumed.
  const drift = await db.all<{ name: string; stock: number; ledger_total: number }>(sql`
    SELECT p.id, p.name, p.stock,
           COALESCE(SUM(m.delta), 0) AS ledger_total
    FROM products p
    LEFT JOIN stock_movements m ON m.product_id = p.id
    GROUP BY p.id
    HAVING p.stock <> COALESCE(SUM(m.delta), 0)
  `);

  if (drift.length > 0) {
    console.error('  Stock does not reconcile:');
    for (const row of drift) {
      console.error(`    ${row.name}: stock ${row.stock}, ledger ${row.ledger_total}`);
    }
    process.exitCode = 1;
    return;
  }

  const totals = await db.all<{ reason: string; n: number; total: number }>(sql`
    SELECT reason, COUNT(*) AS n, SUM(delta) AS total
    FROM stock_movements GROUP BY reason
  `);
  for (const row of totals) {
    console.log(`  ${row.reason}: ${row.n} movement(s), net ${row.total}`);
  }
  console.log('Done. Stock reconciles against the ledger.');
}

seedOpeningBalances()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error('Opening balance seed failed:', err);
    process.exit(1);
  });