import { sql } from 'drizzle-orm';
import { db } from './index';
import { orderStatusEvents, orders } from './schema';

/**
 * Backfills the columns phase 1 added to `orders`.
 *
 * The denormalised customer name, phone, region and district are copied from
 * the customer row where one exists, and otherwise lifted out of the
 * shipping_address JSON. Idempotent: rows already populated are left alone, so
 * this is safe to re-run after a schema change.
 *
 * Also seeds the opening timeline entry for any order that has none, so the
 * audit trail starts from the beginning rather than at the first status change.
 */

async function backfill() {
  console.log('Backfilling denormalised order columns...');

  // libsql reports the affected count as rowsAffected; drizzle's type for
  // this call omits it, so read defensively rather than logging undefined.
  const result = (await db.run(sql`
    UPDATE orders
    SET
      customer_name = COALESCE(
        customer_name,
        (SELECT full_name FROM customers WHERE customers.id = orders.customer_id),
        json_extract(shipping_address, '$.fullName')
      ),
      phone = COALESCE(
        phone,
        (SELECT phone FROM customers WHERE customers.id = orders.customer_id),
        json_extract(shipping_address, '$.phone')
      ),
      region = COALESCE(
        region,
        (SELECT region FROM customers WHERE customers.id = orders.customer_id),
        json_extract(shipping_address, '$.region')
      ),
      district = COALESCE(
        district,
        (SELECT district FROM customers WHERE customers.id = orders.customer_id),
        json_extract(shipping_address, '$.district')
      )
    WHERE customer_name IS NULL
       OR phone IS NULL
       OR region IS NULL
  `)) as { rowsAffected?: number; changes?: number };

  const updated = result?.rowsAffected ?? result?.changes ?? 0;
  console.log(`  ${updated} order row(s) backfilled.`);

  const counts = await db
    .select({
      total: sql<number>`count(*)`,
      named: sql<number>`count(customer_name)`,
      phoned: sql<number>`count(phone)`,
      regioned: sql<number>`count(region)`,
    })
    .from(orders);

  const c = counts[0];
  console.log(
    `  coverage: name ${c.named}/${c.total}, phone ${c.phoned}/${c.total}, region ${c.regioned}/${c.total}`,
  );

  console.log('Seeding opening timeline entries...');

  const missing = await db
    .select({ id: orders.id, reference: orders.reference, status: orders.status })
    .from(orders)
    .where(
      sql`NOT EXISTS (SELECT 1 FROM order_status_events e WHERE e.order_id = ${orders.id})`,
    );

  if (missing.length > 0) {
    await db.insert(orderStatusEvents).values(
      missing.map((order) => ({
        orderId: order.id,
        fromStatus: null,
        toStatus: order.status,
        note: 'Order placed',
        changedByEmail: 'customer',
      })),
    );
  }

  console.log(`  ${missing.length} opening entr(ies) written.`);

  const eventCount = await db.select({ n: sql<number>`count(*)` }).from(orderStatusEvents);
  console.log(`Done. ${eventCount[0]?.n ?? 0} timeline entries in total.`);
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });