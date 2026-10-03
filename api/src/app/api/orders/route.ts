import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { carts, customers, orderItems, orders, products } from '@/db/schema';
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

/** Thrown inside the transaction so a failed decrement rolls everything back. */
class StockConflict extends Error {
  constructor(
    public productId: number,
    public productName: string,
  ) {
    super(`${productName} sold out while the order was being placed`);
    this.name = 'StockConflict';
  }
}

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

  let created: typeof orders.$inferSelect;
  try {
    created = await db.transaction(async (tx) => {
    // Draw down stock inside the transaction, and only after every check has
    // passed. The update is conditional on stock still being sufficient, so two
    // concurrent orders for the last kilo cannot both succeed.
    for (const item of cart.items) {
      const result = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${item.quantity}` })
        .where(
          and(
            eq(products.id, item.productId),
            sql`${products.stock} >= ${item.quantity}`,
          ),
        )
        .returning({ id: products.id });

      if (result.length === 0) {
        // Throwing rolls the whole transaction back, so no partial decrement
        // survives and no order is created.
        throw new StockConflict(item.productId, item.name);
      }
    }

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
  } catch (err) {
    if (err instanceof StockConflict) {
      // The transaction rolled back, so stock is untouched and no order exists.
      return json(
        {
          error: `${err.productName} sold out while the order was being placed. Nothing was charged and stock is unchanged.`,
          conflict: { productId: err.productId, product: err.productName },
        },
        { status: 409 },
      );
    }
    throw err;
  }

  return json({
    data: created,
    // Stock levels after the decrement, so the client can update without a
    // second round trip.
    meta: {
      stockDrawnDown: cart.items.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
      })),
    },
  }, { status: 201 });
}