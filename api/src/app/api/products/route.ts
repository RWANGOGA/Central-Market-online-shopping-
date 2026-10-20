import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';
import { json, toProductDto } from '@/lib/http';
import { requireAdmin } from '@/lib/catalogue';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim();
  const includeInactiveRequested = url.searchParams.get('includeInactive') === 'true';
  const admin = includeInactiveRequested ? await requireAdmin(request) : null;

  const query = db.select().from(products).$dynamic();
  const rows = await (includeInactiveRequested && admin
    ? query.orderBy(asc(products.id))
    : query.where(eq(products.active, true)).orderBy(asc(products.id)));
  const filtered = search
    ? rows.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()))
    : rows;

  return json({ data: filtered.map(toProductDto), meta: { total: filtered.length } });
}
