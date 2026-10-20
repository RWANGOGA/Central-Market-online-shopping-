import { eq, sql } from 'drizzle-orm';
import { db, queryRows } from '@/db';
import { customers, orderItems, orders, products, stockMovements } from '@/db/schema';

export type Bucket = 'day' | 'week' | 'month';

function bucketExpr(bucket: Bucket) {
  switch (bucket) {
    case 'day':
      return sql<string>`substr(${orders.createdAt}, 1, 10)`;
    case 'week':
      return sql<string>`to_char(${orders.createdAt}::timestamp, 'IYYY-"W"IW')`;
    case 'month':
      return sql<string>`substr(${orders.createdAt}, 1, 7)`;
  }
}

/** Units per order, aggregated before the join so order totals are not multiplied by line count. */
const unitsPerOrder = sql`(SELECT order_id, SUM(quantity) AS units FROM order_items GROUP BY order_id) u`;

/** Revenue counts only orders that were not cancelled and whose payment succeeded or is cash on delivery. */
const countedOrder = sql`${orders.status} <> 'cancelled' AND EXISTS (
  SELECT 1 FROM payments p WHERE p.order_id = ${orders.id} AND p.status IN ('succeeded', 'cod')
)`;

function dateRange(filters: { from?: string; to?: string }) {
  const parts = [countedOrder];
  if (filters.from) parts.push(sql`${orders.createdAt} >= ${filters.from}`);
  if (filters.to) parts.push(sql`${orders.createdAt} <= ${filters.to}`);
  return sql.join(parts, sql` AND `);
}

export async function salesTrend(filters: {
  from?: string;
  to?: string;
  bucket?: Bucket;
  limit?: number;
}) {
  const bucket = filters.bucket ?? 'day';
  const limit = filters.limit ?? 60;
  const b = bucketExpr(bucket);

  const rows = await queryRows<{ bucket: string; orders: string; revenue: string; units: string }>(sql`
    SELECT ${b} AS bucket,
           count(*) AS orders,
           coalesce(sum(${orders.total}), 0) AS revenue,
           coalesce(sum(u.units), 0) AS units
    FROM ${orders}
    LEFT JOIN ${unitsPerOrder} ON u.order_id = ${orders.id}
    WHERE ${dateRange(filters)}
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    bucket: String(row.bucket),
    orders: Number(row.orders),
    revenue: Number(row.revenue),
    units: Number(row.units),
  }));
}

export async function productPerformance(filters: { from?: string; to?: string; limit?: number }) {
  const limit = filters.limit ?? 50;

    const rows = await db
    .select({
      productId: orderItems.productId,
      name: products.name,
      unit: products.unit,
      orders: sql<number>`count(DISTINCT ${orders.id})`,
      units: sql<number>`sum(${orderItems.quantity})`,
      revenue: sql<number>`sum(${orderItems.lineTotal})`,
    })
    .from(orderItems)
    .innerJoin(orders, sql`${orders.id} = ${orderItems.orderId}`)
    .innerJoin(products, sql`${products.id} = ${orderItems.productId}`)
    .where(dateRange(filters))
    .groupBy(orderItems.productId, products.name, products.unit)
    .orderBy(sql`sum(${orderItems.lineTotal}) DESC`)
    .limit(limit);

  return rows.map((row) => ({
    productId: Number(row.productId),
    name: String(row.name),
    unit: String(row.unit),
    orders: Number(row.orders),
    units: Number(row.units),
    revenue: Number(row.revenue),
  }));
}

/** Every order in the window, cancelled included. Pipeline counts need those. */
function orderWindow(filters: { from?: string; to?: string }) {
  const parts = [sql`1 = 1`];
  if (filters.from) parts.push(sql`${orders.createdAt} >= ${filters.from}`);
  if (filters.to) parts.push(sql`${orders.createdAt} <= ${filters.to}`);
  return sql.join(parts, sql` AND `);
}

/**
 * One payload for the staff dashboard: money, pipeline, payment mix, promo
 * redemptions, stock risk and signups, all over the same window.
 */
export async function overview(filters: { from?: string; to?: string }) {
  const [totalsRow] = await db
    .select({
      orders: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${orders.total}), 0)`,
      discounts: sql<number>`coalesce(sum(${orders.discount}), 0)`,
    })
    .from(orders)
    .where(dateRange(filters));

  const [unitsRow] = await db
    .select({ units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)` })
    .from(orderItems)
    .innerJoin(orders, sql`${orders.id} = ${orderItems.orderId}`)
    .where(dateRange(filters));

  const statusRows = await db
    .select({ status: orders.status, count: sql<number>`count(*)` })
    .from(orders)
    .where(orderWindow(filters))
    .groupBy(orders.status);

  const paymentRows = await queryRows<{ status: string; count: string; amount: string }>(sql`
    SELECT p.status AS status, count(*) AS count, coalesce(sum(p.amount), 0) AS amount
    FROM payments p
    INNER JOIN ${orders} ON ${orders.id} = p.order_id
    WHERE ${orderWindow(filters)}
    GROUP BY 1
    ORDER BY 2 DESC
  `);

  const promoRows = await db
    .select({
      code: orders.promoCode,
      uses: sql<number>`count(*)`,
      discount: sql<number>`coalesce(sum(${orders.discount}), 0)`,
    })
    .from(orders)
    .where(sql`${orders.promoCode} IS NOT NULL AND ${dateRange(filters)}`)
    .groupBy(orders.promoCode)
    .orderBy(sql`count(*) DESC`)
    .limit(5);

  const signupParts = [sql`1 = 1`];
  if (filters.from) signupParts.push(sql`${customers.createdAt} >= ${filters.from}`);
  if (filters.to) signupParts.push(sql`${customers.createdAt} <= ${filters.to}`);
  const [signupsRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(customers)
    .where(sql.join(signupParts, sql` AND `));

  const stockRows = await db
    .select({
      stock: products.stock,
      threshold: sql<number>`coalesce(${products.lowStockThreshold}, 10)`,
    })
    .from(products)
    .where(eq(products.active, true));

  const ordersCount = Number(totalsRow?.orders ?? 0);
  const revenue = Number(totalsRow?.revenue ?? 0);

  return {
    totals: {
      orders: ordersCount,
      units: Number(unitsRow?.units ?? 0),
      revenue,
      discounts: Number(totalsRow?.discounts ?? 0),
      averageOrderValue: ordersCount > 0 ? Math.round(revenue / ordersCount) : 0,
    },
    status: statusRows.map((row) => ({
      status: String(row.status),
      count: Number(row.count),
    })),
    payments: paymentRows.map((row) => ({
      status: String(row.status),
      count: Number(row.count),
      amount: Number(row.amount),
    })),
    promos: promoRows.map((row) => ({
      code: String(row.code),
      uses: Number(row.uses),
      discount: Number(row.discount),
    })),
    inventory: {
      activeProducts: stockRows.length,
      lowStock: stockRows.filter((row) => Number(row.stock) > 0 && Number(row.stock) <= Number(row.threshold)).length,
      outOfStock: stockRows.filter((row) => Number(row.stock) <= 0).length,
    },
    newCustomers: Number(signupsRow?.total ?? 0),
  };
}

export async function regionalDemand(filters: { from?: string; to?: string }) {
  const rows = await queryRows<{ region: string | null; district: string | null; orders: string; revenue: string; units: string }>(sql`
    SELECT ${orders.region} AS region,
           ${orders.district} AS district,
           count(*) AS orders,
           coalesce(sum(${orders.total}), 0) AS revenue,
           coalesce(sum(u.units), 0) AS units
    FROM ${orders}
    LEFT JOIN ${unitsPerOrder} ON u.order_id = ${orders.id}
    WHERE ${dateRange(filters)}
    GROUP BY 1, 2
    ORDER BY 4 DESC
  `);

  return rows.map((row) => ({
    region: String(row.region ?? 'Unknown'),
    district: row.district ?? null,
    orders: Number(row.orders),
    revenue: Number(row.revenue),
    units: Number(row.units),
  }));
}

export async function forecast() {
  const last7 = sql`to_char((now() at time zone 'utc') - interval '7 days', 'YYYY-MM-DD HH24:MI:SS')`;
  const last30 = sql`to_char((now() at time zone 'utc') - interval '30 days', 'YYYY-MM-DD HH24:MI:SS')`;

  const [revenue7, revenue30] = await Promise.all([
    db
      .select({ revenue: sql<number>`coalesce(sum(${orders.total}), 0)` })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${last7} AND ${countedOrder}`),
    db
      .select({ revenue: sql<number>`coalesce(sum(${orders.total}), 0)` })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${last30} AND ${countedOrder}`),
  ]);

  const inventory = await db
    .select({
      productId: products.id,
      name: products.name,
      unit: products.unit,
      stock: products.stock,
      threshold: sql<number>`coalesce(${products.lowStockThreshold}, 10)`,
    })
    .from(products)
    .where(eq(products.active, true));

  const salesByProduct = await db
    .select({
      productId: orderItems.productId,
      units: sql<number>`sum(${orderItems.quantity})`,
    })
    .from(orderItems)
    .innerJoin(orders, sql`${orders.id} = ${orderItems.orderId}`)
    .where(sql`${orders.createdAt} >= ${last30} AND ${orders.status} <> 'cancelled'`)
    .groupBy(orderItems.productId);

  const salesMap = new Map<number, number>();
  for (const row of salesByProduct) {
    salesMap.set(Number(row.productId), Number(row.units));
  }

  const daysOfCover = inventory.map((row) => {
    const sold = salesMap.get(Number(row.productId)) ?? 0;
    const daily = sold / 30;
    const cover = daily > 0 ? Number((row.stock / daily).toFixed(1)) : null;
    return {
      productId: Number(row.productId),
      name: String(row.name),
      unit: String(row.unit),
      stock: Number(row.stock),
      threshold: Number(row.threshold),
      sold30d: sold,
      dailyAverage: Number(daily.toFixed(2)),
      daysOfCover: cover,
    };
  });

  return {
    trailing: {
      revenue7d: Number(revenue7[0]?.revenue ?? 0),
      revenue30d: Number(revenue30[0]?.revenue ?? 0),
      dailyAverage7d: Number(((Number(revenue7[0]?.revenue ?? 0)) / 7).toFixed(2)),
      dailyAverage30d: Number(((Number(revenue30[0]?.revenue ?? 0)) / 30).toFixed(2)),
    },
    inventory: daysOfCover,
  };
}

export function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100) || 'export.csv';
}

export function toCsv(rows: Record<string, unknown>[], rawFilename: string): Response {
  const filename = safeFilename(rawFilename);
  if (!rows.length) {
    return new Response(`# ${filename}\n# no data\n`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  const headers = Object.keys(rows[0]);
  const escape = (value: unknown): string => {
    let text = String(value ?? '');
    // Spreadsheet formula injection: a cell starting with = + - @ would be executed.
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(',')),
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
