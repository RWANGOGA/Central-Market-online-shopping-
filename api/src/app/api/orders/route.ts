import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { carts, customers, orderItems, orders } from '@/db/schema';
import { loadCart } from '@/lib/cart';
import { error, json, parsePositiveInt } from '@/lib/http';
import { checkLocation } from '@/lib/locationGuard';

/**
 * All amounts are whole Ugandan shillings. The shilling has no minor unit in
 * common use, so nothing here produces decimals.
 */
const SHIPPING_FLAT_RATE = 23720;
const FREE_SHIPPING_THRESHOLD = 198000;
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

  // Re-check the administrative chain at order time. A customer row can be
  // stale relative to the hierarchy, and an order routes a real delivery, so
  // the pair is verified again rather than trusted.
  const location = await checkLocation({
    region: customer.region,
    district: customer.district,
    subCounty: customer.subCounty,
    parish: customer.parish,
    village: customer.village,
  });

  if (!location.ok) {
    return json(
      {
        error: `This customer's saved address is inconsistent: ${location.message}`,
        conflict: { level: location.level },
      },
      { status: 422 },
    );
  }

  const subtotal = cart.subtotal;
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE;
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + shipping + tax;

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
          phone: customer.phone,
          address: customer.address,
          region: customer.region,
          district: customer.district,
          subCounty: customer.subCounty,
          parish: customer.parish,
          village: customer.village,
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