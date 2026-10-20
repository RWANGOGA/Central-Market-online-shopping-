import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { cartItems, carts, products, nowText } from '@/db/schema';
import { loadCart } from '@/lib/cart';
import { error, json } from '@/lib/http';
import { requireCart } from '@/lib/cartOwnership';

const addItemSchema = z.object({
  cartId: z.number().int().positive(),
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(500).default(1),
});

export async function POST(request: Request) {
  const parsed = addItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);
  const { cartId, productId, quantity } = parsed.data;
  const cart = await requireCart(request, cartId);
  if (!cart) return error('Cart not found', 404);

  try {
    await db.transaction(async (tx) => {
      const [activeCart] = await tx.update(carts)
        .set({ updatedAt: nowText })
        .where(and(eq(carts.id, cartId), eq(carts.status, 'active')))
        .returning({ id: carts.id });
      if (!activeCart) throw new Error('CART_NOT_ACTIVE');

      const product = await tx.query.products.findFirst({ where: eq(products.id, productId) });
      if (!product || !product.active) throw new Error('PRODUCT_NOT_FOUND');
      const [existing] = await tx.select().from(cartItems)
        .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId))).limit(1);
      const nextQuantity = (existing?.quantity ?? 0) + quantity;
      if (nextQuantity > 500) throw new Error(`LINE_LIMIT:${product.name}`);
      if (nextQuantity > product.stock) throw new Error(`STOCK:${product.name}:${product.stock}`);

      if (existing) {
        await tx.update(cartItems).set({ quantity: nextQuantity }).where(eq(cartItems.id, existing.id));
      } else {
        await tx.insert(cartItems).values({ cartId, productId, quantity });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'CART_NOT_ACTIVE') return error('Cart is no longer active', 409);
    if (err instanceof Error && err.message === 'PRODUCT_NOT_FOUND') return error('Product not found', 404);
    if (err instanceof Error && err.message.startsWith('LINE_LIMIT:')) {
      return error(`${err.message.slice('LINE_LIMIT:'.length)} is limited to 500 per basket`, 409);
    }
    if (err instanceof Error && err.message.startsWith('STOCK:')) {
      const [, name, stock] = err.message.split(':');
      return error(`${name} only has ${stock} left in stock`, 409);
    }
    throw err;
  }

  return json({ data: await loadCart(cartId) }, { status: 201 });
}
