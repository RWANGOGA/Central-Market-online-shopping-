import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';
import { priceLabelFor, productUpdateSchema, requireAdmin } from '@/lib/catalogue';
import { describeStock, stockState } from '@/lib/stock';
import { storeProductImage } from '@/lib/uploads';
import { error, json } from '@/lib/http';

/**
 * Update or withdraw one product.
 *
 * PATCH changes fields. DELETE withdraws rather than deletes: the row stays so
 * past orders keep referring to something real, and the product can be brought
 * back by setting active to true.
 */

type Ctx = { params: Promise<{ id: string }> };

async function findProduct(id: string) {
  const key = Number(id);
  return db.query.products.findFirst({
    where: Number.isInteger(key) ? eq(products.id, key) : eq(products.slug, id),
  });
}

function present(row: typeof products.$inferSelect) {
  return {
    ...row,
    stockState: stockState(row.stock),
    remaining: describeStock(row.stock, row.unit),
    images: row.imageFiles.map((file) => `/api/assets/${file}`),
  };
}

export async function PATCH(request: Request, { params }: Ctx) {
  const admin = await requireAdmin(request);
  if (!admin) return error('Not signed in', 401);

  const { id } = await params;
  const existing = await findProduct(id);
  if (!existing) return error(`Product "${id}" not found`, 404);

  const parsed = productUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);
  }

  const input = parsed.data;

  if (input.slug && input.slug !== existing.slug) {
    const clash = await db.query.products.findFirst({ where: sql`${products.slug} = ${input.slug}` });
    if (clash) return error(`Another product already uses the slug "${input.slug}".`, 409);
  }

  const set: Partial<typeof products.$inferInsert> = {};

  if (input.name !== undefined) set.name = input.name;
  if (input.slug !== undefined) set.slug = input.slug;
  if (input.description !== undefined) set.description = input.description;
  if (input.farm !== undefined) set.farm = input.farm;
  if (input.location !== undefined) set.location = input.location;
  if (input.stock !== undefined) set.stock = input.stock;
  if (input.dietary !== undefined) set.dietary = input.dietary;
  if (input.active !== undefined) set.active = input.active;

  // Price and its label move together, so the two cannot disagree.
  if (input.priceValue !== undefined) set.priceValue = input.priceValue;
  const unit = input.unit ?? existing.unit;
  if (input.priceValue !== undefined || input.unit !== undefined) {
    set.priceLabel = priceLabelFor(input.priceValue ?? existing.priceValue, unit);
  }
  if (input.unit !== undefined) set.unit = input.unit;

  if (input.imageDataUrl) {
    try {
      const stored = await storeProductImage(input.imageDataUrl);
      // Append rather than replace, so an existing photo survives an edit that
      // only meant to change the price.
      set.imageFiles = [...existing.imageFiles, `uploads/${stored.filename}`];
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Image could not be stored', 422);
    }
  }

  const [updated] = await db.update(products).set(set).where(eq(products.id, existing.id)).returning();

  return json({ data: present(updated), meta: { updatedBy: admin.email } });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const admin = await requireAdmin(request);
  if (!admin) return error('Not signed in', 401);

  const { id } = await params;
  const existing = await findProduct(id);
  if (!existing) return error(`Product "${id}" not found`, 404);

  const [withdrawn] = await db
    .update(products)
    .set({ active: false })
    .where(eq(products.id, existing.id))
    .returning();

  return json({
    data: present(withdrawn),
    meta: {
      withdrawnBy: admin.email,
      // Said plainly, because the row is still here and can be restored.
      note: 'The row is retained so existing orders keep referring to it. PATCH with { "active": true } to restore.',
    },
  });
}
