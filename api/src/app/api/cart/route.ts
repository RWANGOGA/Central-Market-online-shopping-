import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { cartItems, carts } from '@/db/schema';
import { loadCart } from '@/lib/cart';
import { error, json, parsePositiveInt } from '@/lib/http';

const createSchema = z.object({
  customerId: z.number().int().positive().optional(),
});

const updateItemSchema = z.object({
  cartId: z.number().int().positive(),
  productId: z.number().int().positive(),
  quantity: z.number().int().min(0),
});

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return error('Invalid payload', 422);

  const [cart] = await db
    .insert(carts)
    .values({ customerId: parsed.data.customerId })
    .returning();

  return json({ data: await loadCart(cart.id) }, { status: 201 });
}

export async function GET(request: Request) {
  const cartId = parsePositiveInt(new URL(request.url).searchParams.get('cartId'));
  if (cartId === null) return error('Query parameter "cartId" is required', 400);

  const cart = await loadCart(cartId);
  if (!cart) return error(`Cart ${cartId} not found`, 404);

  return json({ data: cart });
}

export async function PATCH(request: Request) {
  const parsed = updateItemSchema.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const { cartId, productId, quantity } = parsed.data;

  const cart = await loadCart(cartId);
  if (!cart) return error(`Cart ${cartId} not found`, 404);
  if (!cart.items.some((line) => line.productId === productId)) {
    return error(`Product ${productId} is not in cart ${cartId}`, 404);
  }

  if (quantity === 0) {
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));
  } else {
    await db
      .update(cartItems)
      .set({ quantity })
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));
  }

  await db
    .update(carts)
    .set({ updatedAt: sql`datetime('now')` })
    .where(eq(carts.id, cartId));

  return json({ data: await loadCart(cartId) });
}