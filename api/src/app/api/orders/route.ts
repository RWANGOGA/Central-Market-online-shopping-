import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { carts, customers, orderItems, orders } from '@/db/schema';
import { loadCart } from '@/lib/cart';
import { error, json, parsePositiveInt } from '@/lib/http';

const SHIPPING_FLAT_RATE = 5.99;
const FREE_SHIPPING_THRESHOLD = 50;
const TAX_RATE = 0.0825;

const createOrderSchema = z.object({
  cartId: z.number().int().positive(),
  customerId: z.number().int().positive(),
  status: z.enum(['pending', 'paid']).default('paid'),
});

function makeReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GRC-${stamp}-${rand}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const customerId = parsePositiveInt(url.searchParams.get('customerId'));
  const reference = url.searchParams.get('reference');

  if (customerId === null && !reference) {
    return error('Provide "customerId" or "reference"', 400);
  }

  const base = db.select().from(orders).$dynamic();
  const rows = await (
    reference
      ? base.where(eq(orders.reference, reference))
      : base.where(eq(orders.customerId, customerId!))
  ).orderBy(desc(orders.createdAt));

  return json({ data: rows, meta: { total: rows.length } });
}

export async function POST(request: Request) {
  const parsed = createOrderSchema.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const { cartId, customerId, status } = parsed.data;

  const cart = await loadCart(cartId);
  if (!cart) return error(`Cart ${cartId} not found`, 404);
  if (cart.items.length === 0) return error('Cart is empty', 422);
  if (cart.status !== 'active') return error(`Cart ${cartId} is already ${cart.status}`, 409);

  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, customerId),
  });
  if (!customer) return error(`Customer ${customerId} not found`, 404);

  const subtotal = cart.subtotal;
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE;
  const tax = Number((subtotal * TAX_RATE).toFixed(2));
  const total = Number((subtotal + shipping + tax).toFixed(2));

  const created = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        reference: makeReference(),
        customerId,
        status,
        subtotal,
        shipping,
        tax,
        total,
        shippingAddress: {
          fullName: customer.fullName,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          zipCode: customer.zipCode,
          country: customer.country,
        },
      })
      .returning();

    await tx.insert(orderItems).values(
      cart.items.map((line) => ({
        orderId: order.id,
        productId: line.productId,
        name: line.name,
        priceValue: line.priceValue,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
      })),
    );

    await tx
      .update(carts)
      .set({ status: 'converted', updatedAt: sql`datetime('now')` })
      .where(eq(carts.id, cartId));

    return order;
  });

  return json({ data: created }, { status: 201 });
}