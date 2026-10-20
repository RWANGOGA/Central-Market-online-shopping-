import { z } from 'zod';
import { error, json } from '@/lib/http';
import { csrfCheck } from '@/lib/security';
import { requireCart } from '@/lib/cartOwnership';
import { loadCart } from '@/lib/cart';
import { allow } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/clientIp';
import { priceCart } from '@/lib/pricing';
import { evaluatePromo, lookupPromo, normalizePromoCode } from '@/lib/promotions';

/**
 * Previews a discount code against the server's own cart total.
 *
 * The browser never supplies the amount being discounted; it names the cart
 * and the code, and this route prices the real contents. The result is only a
 * quote: the order endpoint resolves and claims the code again inside its
 * transaction, so a quote cannot be replayed to keep an expired price.
 */
const bodySchema = z.object({
  cartId: z.number().int().positive(),
  code: z.string().trim().min(1).max(32),
}).strict();

export async function POST(request: Request) {
  const blocked = csrfCheck(request);
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error('Enter a promo code.', 422);

  const owner = await requireCart(request, parsed.data.cartId);
  if (!owner) return error('Cart not found', 404);

  const cart = await loadCart(parsed.data.cartId);
  if (!cart) return error('Cart not found', 404);
  if (cart.items.length === 0) return error('Add something to your basket first.', 422);

  const ip = getClientIp(request);
  if (ip && !(await allow(`promo-lookup:${ip}`, 30, 10 * 60))) {
    return error('Too many promo attempts. Try again in a few minutes.', 429);
  }

  const code = normalizePromoCode(parsed.data.code);
  if (!code) return error('Enter a valid promo code.', 422);

  const promo = await lookupPromo(code);
  if (!promo) return error('That promo code was not found.', 404);

  const evaluation = evaluatePromo(promo, cart.subtotal);
  if ('reason' in evaluation) return error(evaluation.reason, 422);

  const pricing = priceCart(cart.subtotal, evaluation.discount);

  return json({
    data: {
      code: promo.code,
      description: promo.description,
      kind: promo.kind,
      value: promo.value,
      minSubtotal: promo.minSubtotal,
      maxDiscount: promo.maxDiscount,
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      shipping: pricing.shipping,
      tax: pricing.tax,
      total: pricing.total,
      currency: 'UGX',
    },
  });
}
