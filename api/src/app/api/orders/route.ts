import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { carts, cartItems, orderItems, orderStatusEvents, orders, products, nowText } from '@/db/schema';
import { error, json } from '@/lib/http';
import { csrfCheck } from '@/lib/security';
import { checkLocation } from '@/lib/locationGuard';
import { recordMovement } from '@/lib/stockLedger';
import { publishOrderEvent } from '@/lib/orderEvents';
import { StockConflict } from '@/lib/stockErrors';
import { createOrderSchema, type GuestShipping } from '@/lib/orderInput';
import { getCurrentCustomer } from '@/lib/customerSession';
import { requireCart } from '@/lib/cartOwnership';
import { hashToken, trackingCookie } from '@/lib/customerAuth';
import { allow } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/clientIp';
import { priceCart } from '@/lib/pricing';



function makeReference() {
  return `GRC-${randomBytes(5).toString('hex').toUpperCase()}`;
}

export async function POST(request: Request) {
  const blocked = csrfCheck(request);
  if (blocked) return blocked;
  const parsed = createOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const { cartId, shipping: guestShipping } = parsed.data;
  const cartOwner = await requireCart(request, cartId);
  if (!cartOwner) return error('Cart not found', 404);

  const customer = await getCurrentCustomer(request);
  if (!customer && !guestShipping) return error('Sign in or provide delivery details', 401);
  if (customer && guestShipping) return error('Do not override signed-in delivery details', 422);

  const address = customer
    ? {
        fullName: customer.fullName,
        phone: customer.phone,
        address: customer.address,
        region: customer.region,
        district: customer.district,
        subCounty: customer.subCounty,
        parish: customer.parish,
        village: customer.village,
      }
    : normalizeGuestAddress(guestShipping!);

  const location = await checkLocation(address);
  if (!location.ok) return json({ error: location.message, conflict: { level: location.level } }, { status: 422 });

  const ip = getClientIp(request);
  if (ip && !(await allow(`order-create-ip:${ip}`, 10, 60 * 60))) {
    return error('Too many order attempts. Try again later.', 429);
  }

  const reference = makeReference();
  const guestTracking = customer ? null : randomBytes(48).toString('base64url');

  let result: {
    order: typeof orders.$inferSelect;
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
    stockDrawnDown: { productId: number; quantity: number }[];
  };
  try {
    result = await db.transaction(async (tx) => {
      // This compare-and-set is the first statement in the transaction. It both
      // freezes the cart and ensures parallel requests cannot consume it twice.
      const [lockedCart] = await tx.update(carts)
        .set({ status: 'checkout', updatedAt: nowText })
        .where(and(eq(carts.id, cartId), eq(carts.status, 'active'), eq(carts.ownerTokenHash, cartOwner.ownerTokenHash!)))
        .returning({ id: carts.id });
      if (!lockedCart) throw new Error('CART_ALREADY_USED');

      const items = await tx.select({
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        priceValue: products.priceValue,
        name: products.name,
        active: products.active,
      }).from(cartItems)
        .innerJoin(products, eq(products.id, cartItems.productId))
        .where(eq(cartItems.cartId, cartId));
      if (items.length === 0) throw new Error('CART_EMPTY');
      const inactive = items.find((item) => !item.active);
      if (inactive) throw new Error(`PRODUCT_INACTIVE:${inactive.name}`);

      const subtotal = items.reduce((sum, item) => sum + item.priceValue * item.quantity, 0);
      const pricing = priceCart(subtotal);
      const { shipping, tax, total } = pricing;

      for (const item of items) {
        try {
          await recordMovement({
            productId: item.productId,
            delta: -item.quantity,
            reason: 'sale',
            reference,
            actorLabel: 'customer',
          }, tx);
        } catch (err) {
          if (!(err instanceof StockConflict)) throw err;
          throw new StockConflict(item.productId, item.name);
        }
      }

      const [order] = await tx.insert(orders).values({
        reference,
        customerId: customer?.id ?? null,
        cartId,
        trackingTokenHash: guestTracking ? hashToken(guestTracking) : null,
        status: 'pending',
        updatedAt: nowText,
        subtotal,
        shipping,
        tax,
        total,
        customerName: address.fullName,
        phone: address.phone,
        region: location.region,
        district: location.district,
        shippingAddress: { ...address, ...location },
      }).returning();

      await tx.insert(orderItems).values(items.map((line) => ({
        orderId: order.id,
        productId: line.productId,
        name: line.name,
        priceValue: line.priceValue,
        quantity: line.quantity,
        lineTotal: line.priceValue * line.quantity,
      })));
      await tx.insert(orderStatusEvents).values({
        orderId: order.id,
        fromStatus: null,
        toStatus: 'pending',
        note: 'Order placed',
        changedByEmail: customer ? 'customer' : 'guest',
      });
      await tx.update(carts).set({ status: 'converted', updatedAt: nowText })
        .where(and(eq(carts.id, cartId), eq(carts.status, 'checkout')));

      return {
        order,
        subtotal,
        shipping,
        tax,
        total,
        stockDrawnDown: items.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      };
    });
  } catch (err) {
    if (err instanceof StockConflict) {
      return json({
        error: `${err.productName} sold out while the order was being placed. Stock is unchanged.`,
        conflict: { productId: err.productId, product: err.productName },
      }, { status: 409 });
    }
    if (err instanceof Error && err.message === 'CART_ALREADY_USED') return error('Cart is no longer active', 409);
    if (err instanceof Error && err.message === 'CART_EMPTY') return error('Cart is empty', 422);
    if (err instanceof Error && err.message.startsWith('PRODUCT_INACTIVE:')) {
      return error(`${err.message.slice('PRODUCT_INACTIVE:'.length)} is no longer available`, 409);
    }
    throw err;
  }

  const created = result.order;
  publishOrderEvent({
    type: 'order.created', id: created.id, reference: created.reference, from: null,
    to: created.status, total: created.total, currency: created.currency,
    region: created.region, district: created.district, customerName: created.customerName,
    at: created.createdAt,
  });

  return json({
    data: { id: created.id, reference: created.reference, status: created.status, total: created.total, currency: created.currency },
    totals: { subtotal: result.subtotal, shipping: result.shipping, tax: result.tax, total: result.total },
    meta: { stockDrawnDown: result.stockDrawnDown },
  }, {
    status: 201,
    ...(guestTracking ? { headers: { 'Set-Cookie': trackingCookie(guestTracking) } } : {}),
  });
}

function normalizeGuestAddress(input: GuestShipping) {
  return {
    ...input,
    district: input.district ?? null,
    subCounty: input.subCounty ?? null,
    parish: input.parish ?? null,
    village: input.village ?? null,
  };
}
