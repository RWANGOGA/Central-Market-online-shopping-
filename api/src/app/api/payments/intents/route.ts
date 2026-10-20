import { timingSafeEqual } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { cartItems, carts, payments, products } from '@/db/schema';
import { PAYMENT_METHODS, detectMobileMoneyProvider, maskCard, luhnValid, approvalInstructions, article } from '@/lib/payments';
import { createSessionToken, hashToken } from '@/lib/password';
import { error, json } from '@/lib/http';

/**
 * Mobile money fees in Uganda are charged by the sender, not the merchant, so
 * the payable total equals the cart total. Kept as named constants so a
 * deployment that absorbs fees has one place to change.
 */
const DELIVERY_FEE_UGX = 5000;
const FREE_DELIVERY_THRESHOLD_UGX = 100000;

const createSchema = z.object({
  cartId: z.number().int().positive(),
  channel: z.enum(['mobile_money', 'card', 'wallet']),
  provider: z.string().min(1),
  payerName: z.string().min(1).optional(),
  payerPhone: z.string().optional(),
  walletId: z.string().optional(),
  card: z
    .object({
      number: z.string().min(12),
      expiry: z.string().regex(/^\d{2}\/\d{2}$/),
      ccv: z.string().regex(/^\d{3,4}$/),
    })
    .optional(),
});

function makeReference() {
  return `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);
  }

  const { cartId, channel, provider, payerName, payerPhone, walletId, card } = parsed.data;

  const cart = await db.query.carts.findFirst({ where: eq(carts.id, cartId) });
  if (!cart) return error(`Cart ${cartId} not found`, 404);
  if (cart.status !== 'active') return error(`Cart ${cartId} is already ${cart.status}`, 409);

  const items = await db
    .select({
      productId: cartItems.productId,
      quantity: cartItems.quantity,
      priceValue: products.priceValue,
      stock: products.stock,
      name: products.name,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(eq(cartItems.cartId, cartId));

  if (items.length === 0) return error('Cart is empty', 422);

  const shortStock = items.find((item) => item.quantity > item.stock);
  if (shortStock) {
    return error(`${shortStock.name} only has ${shortStock.stock} left in stock`, 409);
  }

  const subtotal = items.reduce((sum, item) => sum + item.priceValue * item.quantity, 0);
  const delivery = subtotal >= FREE_DELIVERY_THRESHOLD_UGX ? 0 : DELIVERY_FEE_UGX;
  const total = subtotal + delivery;

  // Validate the instrument for the chosen channel.
  let providerRef: string | null = null;
  let status: (typeof payments.$inferInsert)['status'] = 'pending';
  let normalisedPhone: string | null = null;
  let maskedCard: string | null = null;

  if (channel === 'mobile_money') {
    const known = PAYMENT_METHODS.mobile_money.find((m) => m.id === provider);
    if (!known) return error(`Unknown mobile money provider "${provider}"`, 422);
    if (!payerPhone) return error('A mobile money number is required', 422);

    const local = payerPhone.replace(/[\s()-]/g, '').replace(/^\+?256/, '0');
    if (!/^07\d{8}$/.test(local)) {
      return error('Enter a Ugandan mobile money number, for example 0772 123 456', 422);
    }

    // A number must match the network it is being paid from.
    const detected = detectMobileMoneyProvider(local);
    if (detected !== provider) {
      const detectedLabel = PAYMENT_METHODS.mobile_money.find((m) => m.id === detected)?.label;
      return error(
        detectedLabel
          ? `That number is ${article(detectedLabel)} ${detectedLabel} number. Choose ${detectedLabel} as the provider.`
          : `That number does not match ${known.label}.`,
        422,
      );
    }

    normalisedPhone = local;
    status = 'awaiting_approval';
    providerRef = `${known.id}-${Math.random().toString(36).slice(2, 10)}`;
  } else if (channel === 'card') {
    if (!card) return error('Card details are required', 422);
    if (!luhnValid(card.number)) return error('That card number is not valid', 422);

    const scheme = card.number.replace(/\D/g, '').startsWith('4') ? 'visa' : 'mastercard';
    if (provider !== scheme) {
      return error(`That card is not a ${provider} card`, 422);
    }

    maskedCard = maskCard(card.number);
    status = 'processing';
    providerRef = `auth-${Math.random().toString(36).slice(2, 10)}`;
  } else {
    if (!walletId) return error('A wallet identifier is required', 422);
    if (!/^[A-Za-z0-9]{3,}(@[A-Za-z0-9.-]+)?$/.test(walletId)) {
      return error('Enter a wallet number, or an address like allen@stanbic', 422);
    }
    status = 'awaiting_approval';
    providerRef = `wallet-${Math.random().toString(36).slice(2, 10)}`;
  }

  const { token: settlementToken, tokenHash: settlementTokenHash } = createSessionToken();

  const [payment] = await db
    .insert(payments)
    .values({
      reference: makeReference(),
      cartId,
      channel,
      provider,
      status,
      amount: total,
      currency: 'UGX',
      payerName: payerName ?? null,
      payerPhone: normalisedPhone,
      walletId: walletId ?? null,
      maskedCard,
      providerRef,
      settlementTokenHash,
    })
    .returning();

  return json(
    {
      data: {
        ...payment,
        // Returned once, at creation, and never again. It is what lets the
        // client that opened this intent report the outcome, and nobody else.
        settlementToken,
        nextAction: { channel, provider, status, ...approvalInstructions(channel, provider) },
      },
      totals: { subtotal, delivery, total, currency: 'UGX' },
    },
    { status: 201 },
  );
}

/**
 * Status transition. A real deployment replaces the simulated resolution with
 * a webhook from the gateway; the shape of this response is what the client
 * already consumes, so only the update logic changes.
 */
/**
 * Report the outcome of an intent.
 *
 * Mobile money approval is asynchronous and, until a real gateway is wired in,
 * the browser that opened the intent is what reports the result. That must not
 * mean any browser can: the caller has to present the settlement token issued
 * when the intent was created. It is cleared on settlement, so a reference on
 * its own is not enough.
 */
export async function PATCH(request: Request) {
  const parsed = z
    .object({
      reference: z.string().min(1),
      status: z.enum(['succeeded', 'failed', 'cancelled']),
      settlementToken: z.string().min(1),
      failureReason: z.string().optional(),
    })
    .safeParse(await request.json());

  if (!parsed.success) return error('Invalid payload', 422);
  const { reference, status, settlementToken, failureReason } = parsed.data;

  const payment = await db.query.payments.findFirst({ where: eq(payments.reference, reference) });
  if (!payment) return error(`Payment ${reference} not found`, 404);

  // Compare in constant time and treat a missing hash the same as a mismatch,
  // so an already-settled intent cannot be told apart from a wrong token.
  const presented = Buffer.from(hashToken(settlementToken), 'hex');
  const stored = payment.settlementTokenHash ? Buffer.from(payment.settlementTokenHash, 'hex') : Buffer.alloc(0);

  if (presented.length !== stored.length || !timingSafeEqual(presented, stored)) {
    return error(
      'This browser did not open the payment. The settlement token is missing or does not match.',
      403,
    );
  }

  if (payment.status === 'succeeded') {
    return error(`Payment ${reference} already succeeded`, 409);
  }

  const [updated] = await db
    .update(payments)
    .set({
      status,
      failureReason: failureReason ?? null,
      // Single use: settling spends the token.
      settlementTokenHash: null,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(payments.id, payment.id))
    .returning();

  return json({ data: updated });
}
