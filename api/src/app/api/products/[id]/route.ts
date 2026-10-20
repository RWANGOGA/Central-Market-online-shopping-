import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';
import { error, json, toProductDto } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const key = Number(id);

  const row = Number.isInteger(key)
    ? await db.query.products.findFirst({ where: eq(products.id, key) })
    : await db.query.products.findFirst({ where: eq(products.slug, id) });

  if (!row) return error(`Product "${id}" not found`, 404);
  return json({ data: toProductDto(row) });
}