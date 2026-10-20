import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { orderItems, orders, products, stockMovements } from '@/db/schema';

export type Bucket = 'day' | 'week' | 'month';

function bucketExpr(bucket: Bucket) {
  switch (bucket) {
    case 'day':
      return sql`date(${orders.createdAt})`;
    case 'week':
      return sql`strftime('%Y-W', ${orders.createdAt})`;
    case 'month':
      return sql`strftime('%Y-%m', ${orders.createdAt})`;
  }
}

function bucketLabel(bucket: Bucket, value: string) {
  if (bucket === 'week') return value;
  return value;
}

export async function salesTrend(filters: {
  from?: string;
  to?: string;
  bucket?: Bucket;
  limit?: number;
}) {
  const bucket = filters.bucket ?? 'day';
  const limit = filters.limit ?? 60;

  const where = [];
  if (filters.from) where.push(sql`${orders.createdAt} >= ${filters.from}`);
  if (filters.to) where.push(sql`${orders.createdAt} <= ${filters.to}`);

  const rows = await db
    .select({
      bucket: bucketExpr(bucket),
      orders: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${orders.total}), 0)`,
      units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
    })
    .from(orders)
    .leftJoin(orderItems, sql`${orderItems.orderId} = ${orders.id}`)
    .where(where.length > 0 ? sql`${where[0]} ${where.slice(1)}` : undefined)
    .groupBy(sql`${bucketExpr(bucket)}`)
    .orderBy(sql`${bucketExpr(bucket)} DESC`)
    .limit(limit);

  return rows.map((row) => ({
    bucket: bucketLabel(bucket, String(row.bucket)),
    orders: Number(row.orders),
    revenue: Number(row.revenue),
    units: Number(row.units),
  }));
}

export async function productPerformance(filters: { from?: string; to?: string; limit?: number }) {
  const limit = filters.limit ?? 50;

  const where = [];
  if (filters.from) where.push(sql`${orders.createdAt} >= ${filters.from}`);
  if (filters.to) where.push(sql`${orders.createdAt} <= ${filters.to}`);

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
    .where(where.length > 0 ? sql`${where[0]} ${where.slice(1)}` : undefined)
    .groupBy(orderItems.productId)
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

export async function regionalDemand(filters: { from?: string; to?: string }) {
  const where = [];
  if (filters.from) where.push(sql`${orders.createdAt} >= ${filters.from}`);
  if (filters.to) where.push(sql`${orders.createdAt} <= ${filters.to}`);

  const rows = await db
    .select({
      region: orders.region,
      district: orders.district,
      orders: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${orders.total}), 0)`,
      units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
    })
    .from(orders)
    .leftJoin(orderItems, sql`${orderItems.orderId} = ${orders.id}`)
    .where(where.length > 0 ? sql`${where[0]} ${where.slice(1)}` : undefined)
    .groupBy(sql`${orders.region}, ${orders.district}`)
    .orderBy(sql`sum(${orders.total}) DESC`);

  return rows.map((row) => ({
    region: String(row.region),
    district: row.district ?? null,
    orders: Number(row.orders),
    revenue: Number(row.revenue),
    units: Number(row.units),
  }));
}

export async function forecast() {
  const now = sql`datetime('now')`;
  const last7 = sql`datetime('now', '-7 days')`;
  const last30 = sql`datetime('now', '-30 days')`;

  const [revenue7, revenue30] = await Promise.all([
    db
      .select({ revenue: sql<number>`coalesce(sum(${orders.total}), 0)` })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${last7}`),
    db
      .select({ revenue: sql<number>`coalesce(sum(${orders.total}), 0)` })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${last30}`),
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
    .where(sql`${products.active} = 1`);

  const salesByProduct = await db
    .select({
      productId: orderItems.productId,
      units: sql<number>`sum(${orderItems.quantity})`,
    })
    .from(orderItems)
    .innerJoin(orders, sql`${orders.id} = ${orderItems.orderId}`)
    .where(sql`${orders.createdAt} >= ${last30}`)
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

export function toCsv(rows: Record<string, unknown>[], filename: string): Response {
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
    const text = String(value ?? '');
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
