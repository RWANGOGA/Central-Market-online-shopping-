import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { products } from '@/db/schema';
import { requireAdmin } from '@/lib/catalogue';
import { describeStock, stockState } from '@/lib/stock';
import { error, json } from '@/lib/http';

/**
 * Staff-only stock adjustment.
 *
 * Replaces `PATCH /api/inventory`, which let anyone who could reach the API set
 * stock to any value. The public `GET /api/inventory` stays open, because the
 * shop shows remaining stock to buyers.
 *
 * `delta` is a signed change rather than an absolute figure on purpose: setting
 * a total loses whatever movement produced the previous number. Recording the
 * reason is the start of the stock ledger planned for phase 2; until
 * `stock_movements` exists the reason is returned for the caller to log.
 */

const patchSchema = z.object({
  delta: z.number().int(),
  reason: z.string().min(1).max(200),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const admin = await requireAdmin(request);
  if (!admin) return error('Not signed in', 401);

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);
  }

  const { delta, reason } = parsed.data;
  if (delta === 0) return error('delta must not be zero', 422);

  const { id } = await params;
  const key = Number(id);

  const product = await db.query.products.findFirst({
    where: Number.isInteger(key) ? eq(products.id, key) : eq(products.slug, id),
  });
  if (!product) return error(`Product "${id}" not found`, 404);

  const next = product.stock + delta;

  if (next < 0) {
    return error(
      `Cannot remove ${Math.abs(delta)} from ${product.name}: only ${product.stock}${product.unit} in stock.`,
      409,
    );
  }

  const [updated] = await db
    .update(products)
    .set({ stock: next })
    .where(eq(products.id, product.id))
    .returning();

  return json({
    data: {
      ...updated,
      state: stockState(updated.stock),
      remaining: describeStock(updated.stock, updated.unit),
    },
    meta: {
      previous: product.stock,
      delta,
      reason,
      adjustedBy: admin.email,
      // Said plainly, because nothing is persisted yet.
      ledger: 'Phase 2 writes this to stock_movements; until then the reason lives only in this response.',
    },
  });
}
