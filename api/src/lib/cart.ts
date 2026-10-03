import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { cartItems, carts, products } from '@/db/schema';

export type CartDto = Awaited<ReturnType<typeof loadCart>>;

export async function loadCart(cartId: number) {
  const cart = await db.query.carts.findFirst({ where: eq(carts.id, cartId) });
  if (!cart) return null;

  const items = await db
    .select({
      id: cartItems.id,
      productId: cartItems.productId,
      quantity: cartItems.quantity,
      name: products.name,
      priceLabel: products.priceLabel,
      priceValue: products.priceValue,
      stock: products.stock,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(eq(cartItems.cartId, cartId));

  const lines = items.map((item) => ({
    ...item,
    lineTotal: item.priceValue * item.quantity,
  }));

  return {
    id: cart.id,
    customerId: cart.customerId,
    status: cart.status,
    items: lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce((sum, line) => sum + line.lineTotal, 0),
  };
}