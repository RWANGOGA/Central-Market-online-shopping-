import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';
import { json, toProductDto } from '@/lib/http';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim();
  const includeInactive = url.searchParams.get('includeInactive') === 'true';

  const base = db.select().from(products).$dynamic();
  const query = includeInactive ? base : base.where(eq(products.active, true));

  const rows = await query.orderBy(asc(products.id));

  const filtered = search
    ? rows.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()))
    : rows;

  return json({
    data: filtered.map(toProductDto),
    meta: { total: filtered.length },
  });
}