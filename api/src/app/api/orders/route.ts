import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { carts, customers, orderItems, orderStatusEvents, orders, products, nowText } from '@/db/schema';
import { loadCart } from '@/lib/cart';
import { error, json, parsePositiveInt } from '@/lib/http';
import { checkLocation } from '@/lib/locationGuard';
import { recordMovement } from '@/lib/stockLedger';
import { publishOrderEvent } from '@/lib/orderEvents';
import { StockConflict } from '@/lib/stockErrors';

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
  /**
   * Accepted for the caller's intent only. The row is always created as
   * "pending": orders.status is fulfilment state, and money is tracked on
   * payments.status. Payment outcome must not set a fulfilment state.
   */
  paymentIntent: z.enum(['pending', 'paid']).default('paid'),
});

function makeReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GRC-${stamp}-${rand}`;
}

export async function POST(request: Request) {
  const parsed = createOrderSchema.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const { cartId, customerId } = parsed.data;

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

  const reference = makeReference();

  let created: typeof orders.$inferSelect;
  try {
    created = await db.transaction(async (tx) => {
    // Draw down stock through the ledger, inside the transaction and only
    // after every check has passed. recordMovement writes products.stock and
    // its stock_movements row together, so a failure leaves neither behind and
    // the ledger stays reconcilable.
    for (const item of cart.items) {
      try {
        await recordMovement(
          {
            productId: item.productId,
            delta: -item.quantity,
            reason: 'sale',
            reference: reference,
            actorLabel: 'customer',
          },
          tx,
        );
      } catch (err) {
        if (!(err instanceof StockConflict)) throw err;
        throw new StockConflict(item.productId, item.name);
      }
    }

    const [order] = await tx
      .insert(orders)
      .values({
        reference,
        customerId,
        status: 'pending' as const,
        // Set explicitly rather than relying on the column default. The
        // existing column was added by ALTER TABLE, where SQLite refuses a
        // non-constant default like datetime('now'), so it holds '' until
        // this writes it.
        updatedAt: nowText,
        subtotal,
        shipping,
        tax,
        total,
        // Copied rather than joined, so order search and the regional
        // reporting in phase 4 have an indexable column to work from.
        customerName: customer.fullName,
        phone: customer.phone,
        region: customer.region,
        district: customer.district,
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

    // The opening entry, so the timeline starts when the order does rather
    // than at the first status change.
    await tx.insert(orderStatusEvents).values({
      orderId: order.id,
      fromStatus: null,
      toStatus: 'pending',
      note: 'Order placed',
      changedByEmail: 'customer',
    });

    await tx
      .update(carts)
      .set({ status: 'converted', updatedAt: nowText })
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

  // Push to any open staff dashboard. Fired after the transaction commits, so a
  // subscriber never sees an order that then fails to save.
  publishOrderEvent({
    type: 'order.created',
    id: created.id,
    reference: created.reference,
    from: null,
    to: created.status,
    total: created.total,
    currency: created.currency,
    region: created.region,
    district: created.district,
    customerName: created.customerName,
    at: created.createdAt,
  });

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