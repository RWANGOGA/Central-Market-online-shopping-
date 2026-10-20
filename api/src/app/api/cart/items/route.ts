import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { cartItems, carts, products, nowText } from '@/db/schema';
import { loadCart } from '@/lib/cart';
import { error, json } from '@/lib/http';

const addItemSchema = z.object({
  cartId: z.number().int().positive(),
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).default(1),
});

export async function POST(request: Request) {
  const parsed = addItemSchema.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const { cartId, productId, quantity } = parsed.data;

  const cart = await db.query.carts.findFirst({ where: eq(carts.id, cartId) });
  if (!cart) return error(`Cart ${cartId} not found`, 404);

  const product = await db.query.products.findFirst({ where: eq(products.id, productId) });
  if (!product || !product.active) return error(`Product ${productId} not found`, 404);

  const existing = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(cartItems)
      .set({ quantity: existing[0].quantity + quantity })
      .where(eq(cartItems.id, existing[0].id));
  } else {
    await db.insert(cartItems).values({ cartId, productId, quantity });
  }

  await db
    .update(carts)
    .set({ updatedAt: nowText })
    .where(eq(carts.id, cartId));

  return json({ data: await loadCart(cartId) }, { status: 201 });
}