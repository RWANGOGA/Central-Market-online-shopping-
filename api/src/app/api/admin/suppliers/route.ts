import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { products, suppliers } from '@/db/schema';
import { requireAdmin } from '@/lib/catalogue';
import { error, json } from '@/lib/http';

/**
 * Suppliers.
 *
 * Stock inflow goes through a purchase order against a supplier rather than
 * through a bare adjustment, so "where did this come from" has an answer and
 * the cost per unit is recorded at the price actually paid.
 */

const supplierSchema = z.object({
  name: z.string().min(2).max(120),
  contactName: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  district: z.string().max(80).optional(),
  region: z.string().max(80).optional(),
});

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return error('Not signed in', 401);

  const rows = await db.query.suppliers.findMany({ orderBy: suppliers.name });

  const linked = await db.query.products.findMany({
    columns: { id: true, supplierId: true },
  });
  const counts = new Map<number, number>();
  for (const product of linked) {
    if (product.supplierId === null) continue;
    counts.set(product.supplierId, (counts.get(product.supplierId) ?? 0) + 1);
  }

  return json({
    data: rows.map((row) => ({ ...row, productCount: counts.get(row.id) ?? 0 })),
    meta: { total: rows.length },
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return error('Not signed in', 401);

  const parsed = supplierSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const name = parsed.data.name.trim();

  const clash = await db.query.suppliers.findFirst({ where: eq(suppliers.name, name) });
  if (clash) return error(`A supplier called "${name}" already exists.`, 409);

  const [created] = await db
    .insert(suppliers)
    .values({
      name,
      contactName: parsed.data.contactName?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      district: parsed.data.district?.trim() || null,
      region: parsed.data.region?.trim() || null,
    })
    .returning();

  return json({ data: created, meta: { createdBy: admin.email } }, { status: 201 });
}

/** Link a supplier to the products they provide. */
export async function PUT(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return error('Not signed in', 401);

  const parsed = z
    .object({ supplierId: z.number().int().positive() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error('A supplierId is required', 422);

  const supplier = await db.query.suppliers.findFirst({
    where: eq(suppliers.id, parsed.data.supplierId),
  });
  if (!supplier) return error(`Supplier ${parsed.data.supplierId} not found`, 404);

  const { productIds } = z
    .object({ productIds: z.array(z.number().int().positive()).default([]) })
    .parse(await request.json());

  for (const productId of productIds) {
    await db
      .update(products)
      .set({ supplierId: supplier.id })
      .where(eq(products.id, productId));
  }

  return json({ data: { supplier, linked: productIds }, meta: { updatedBy: admin.email } });
}
