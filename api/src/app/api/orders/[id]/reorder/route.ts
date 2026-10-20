import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { cartItems, carts, orderItems, orders, products, nowText } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customerSession';
import { requireCart } from '@/lib/cartOwnership';
import { loadCart } from '@/lib/cart';
import { error, json } from '@/lib/http';
import { csrfCheck } from '@/lib/security';

type Ctx = { params: Promise<{ id: string }> };

const reorderSchema = z.object({ cartId: z.number().int().positive() }).strict();

const LINE_LIMIT = 500;

/**
 * Put a past order's lines back into the current basket.
 *
 * The order is proof of what the customer bought, but the catalogue is the
 * truth about what can be bought now: withdrawn products are skipped and a
 * shortfall is added only up to the stock that exists. A partial result is
 * reported rather than failing the whole reorder, because one sold-out item
 * should not stop the rest of the basket.
 *
 * The path accepts the numeric id or the reference, matching the GET route in
 * the parent segment.
 */
export async function POST(request: Request, { params }: Ctx) {
  const blocked = csrfCheck(request);
  if (blocked) return blocked;

  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Sign in to reorder', 401);

  const parsed = reorderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error('Invalid payload', 422);
  const { cartId } = parsed.data;

  const { id } = await params;
  const key = Number(id);
  const order = await db.query.orders.findFirst({
    where: and(
      Number.isInteger(key) && key > 0 ? eq(orders.id, key) : eq(orders.reference, id),
      eq(orders.customerId, customer.id),
    ),
  });
  if (!order) return error('Order not found', 404);

  const cart = await requireCart(request, cartId);
  if (!cart) return error('Cart not found', 404);

  const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  if (lines.length === 0) return error('This order has no items to reorder', 409);

  const result = await db.transaction(async (tx) => {
    // The cart simply has to still be usable. Its status is checked in the
    // same transaction that writes to it.
    const [activeCart] = await tx
      .update(carts)
      .set({ updatedAt: nowText })
      .where(and(eq(carts.id, cart.id), eq(carts.status, 'active')))
      .returning({ id: carts.id });
    if (!activeCart) throw new Error('CART_NOT_ACTIVE');

    const added: { productId: number; name: string; quantity: number }[] = [];
    const skipped: { name: string; reason: string }[] = [];

    for (const line of lines) {
      const product = await tx.query.products.findFirst({ where: eq(products.id, line.productId) });
      if (!product || !product.active) {
        skipped.push({ name: line.name, reason: 'No longer in the catalogue' });
        continue;
      }

      const [existing] = await tx
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, product.id)))
        .limit(1);
      const already = existing?.quantity ?? 0;
      const room = Math.min(product.stock, LINE_LIMIT) - already;

      if (room <= 0) {
        skipped.push({
          name: product.name,
          reason: product.stock === 0
            ? 'Out of stock'
            : 'Your basket already holds all the stock available',
        });
        continue;
      }

      const quantity = Math.min(line.quantity, room);
      if (existing) {
        await tx.update(cartItems).set({ quantity: already + quantity }).where(eq(cartItems.id, existing.id));
      } else {
        await tx.insert(cartItems).values({ cartId: cart.id, productId: product.id, quantity });
      }

      if (quantity < line.quantity) {
        skipped.push({
          name: product.name,
          reason: `Only ${quantity} of the ${line.quantity} ordered were still available`,
        });
      }
      added.push({ productId: product.id, name: product.name, quantity });
    }

    return { added, skipped };
  }).catch((err) => {
    if (err instanceof Error && err.message === 'CART_NOT_ACTIVE') return null;
    throw err;
  });

  if (!result) return error('Cart is no longer active', 409);

  return json({ data: { ...result, cart: await loadCart(cart.id) } });
}
