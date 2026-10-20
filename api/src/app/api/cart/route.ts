import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { cartItems, carts, nowText, products } from '@/db/schema';
import { loadCart } from '@/lib/cart';
import { error, json, parsePositiveInt } from '@/lib/http';
import { createSessionToken, cartCookie } from '@/lib/customerAuth';
import { getCurrentCustomer } from '@/lib/customerSession';
import { requireCart } from '@/lib/cartOwnership';

const updateItemSchema = z.object({
  cartId: z.number().int().positive(),
  productId: z.number().int().positive(),
  quantity: z.number().int().min(0).max(500),
});

export async function POST(request: Request) {
  const owner = createSessionToken();
  const customer = await getCurrentCustomer(request);
  const [cart] = await db.insert(carts).values({
    customerId: customer?.id ?? null,
    ownerTokenHash: owner.tokenHash,
  }).returning();

  return json({ data: await loadCart(cart.id) }, {
    status: 201,
    headers: { 'Set-Cookie': cartCookie(owner.token) },
  });
}

export async function GET(request: Request) {
  const cartId = parsePositiveInt(new URL(request.url).searchParams.get('cartId'));
  if (cartId === null) return error('Query parameter "cartId" is required', 400);

  const cart = await requireCart(request, cartId);
  if (!cart) return error('Cart not found', 404);
  const data = await loadCart(cartId);
  if (!data) return error('Cart not found', 404);
  return json({ data });
}

export async function PATCH(request: Request) {
  const parsed = updateItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);
  const { cartId, productId, quantity } = parsed.data;
  const cart = await requireCart(request, cartId);
  if (!cart) return error('Cart not found', 404);
  if (cart.status !== 'active') return error('Cart is no longer active', 409);

  try {
    await db.transaction(async (tx) => {
      const [activeCart] = await tx.update(carts)
        .set({ updatedAt: nowText })
        .where(and(eq(carts.id, cartId), eq(carts.status, 'active')))
        .returning({ id: carts.id });
      if (!activeCart) throw new Error('CART_NOT_ACTIVE');

      const [item] = await tx.select().from(cartItems)
        .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId))).limit(1);
      if (!item) throw new Error('CART_ITEM_NOT_FOUND');
      if (quantity > 0) {
        const product = await tx.query.products.findFirst({ where: eq(products.id, productId) });
        if (!product || !product.active) throw new Error('PRODUCT_NOT_FOUND');
        if (quantity > product.stock) throw new Error(`STOCK:${product.name}:${product.stock}`);
      }

      if (quantity === 0) {
        await tx.delete(cartItems).where(eq(cartItems.id, item.id));
      } else {
        await tx.update(cartItems).set({ quantity }).where(eq(cartItems.id, item.id));
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'CART_NOT_ACTIVE') return error('Cart is no longer active', 409);
    if (err instanceof Error && err.message === 'CART_ITEM_NOT_FOUND') return error('Cart item not found', 404);
    if (err instanceof Error && err.message === 'PRODUCT_NOT_FOUND') return error('Product not found', 404);
    if (err instanceof Error && err.message.startsWith('STOCK:')) {
      const [, name, stock] = err.message.split(':');
      return error(`${name} only has ${stock} left in stock`, 409);
    }
    throw err;
  }

  return json({ data: await loadCart(cartId) });
}
