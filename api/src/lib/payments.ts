import type { Payment } from '@/db/schema';

/**
 * What a client is allowed to know about a payment. Payer instrument details,
 * wallet identifiers, provider references and the settlement token hash stay
 * on the server.
 */
export type PaymentDto = {
  reference: string;
  status: Payment['status'];
  amount: number;
  currency: string;
  channel: Payment['channel'];
  provider: string;
  maskedCard: string | null;
  failureReason: string | null;
};

export function toPaymentDto(payment: Payment): PaymentDto {
  return {
    reference: payment.reference,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    channel: payment.channel,
    provider: payment.provider,
    maskedCard: payment.maskedCard,
    failureReason: payment.failureReason,
  };
}

/**
 * Payment channels offered to customers.
 *
 * Mobile money carries real provider identifiers because the aggregator needs
 * them to route the USSD prompt. Card is deliberately absent: the browser must
 * use the gateway's hosted page, so no PAN ever reaches this server. Legacy
 * rows may still carry `channel = 'card'`; the type stays wide enough for them.
 */

export const PAYMENT_METHODS = {
  mobile_money: [
    {
      id: 'mtn_momo',
      provider: 'MTN Mobile Money',
      label: 'MTN MoMo',
      ussd: '*165#',
      // MTN prefixes are 077, 078 and 079 in the local 07 form.
      prefixes: ['077', '078', '079'],
      instructions: 'Dial *165#, choose Mobile Money, then Pay Bill and enter your Mu Katale number.',
    },
    {
      id: 'airtel_money',
      provider: 'Airtel Money',
      label: 'Airtel Money',
      ussd: '*185#',
      // Airtel Uganda uses 070 and 075.
      prefixes: ['070', '075'],
      instructions: 'Dial *185#, choose Mobile Money, then Pay Bill and enter your Mu Katale number.',
    },
    {
      id: 'utel_money',
      provider: 'Uganda Telecom Money',
      label: 'UTel Money',
      ussd: '*111#',
      prefixes: ['071'],
      instructions: 'Dial *111# and follow the prompts to approve the payment.',
    },
  ],
  cod: [
    {
      id: 'cod',
      provider: 'Cash on Delivery',
      label: 'Cash on Delivery',
      instructions: 'Pay the rider on delivery.',
    },
  ],
  wallet: [
    {
      id: 'interoperability',
      provider: 'Bank and mobile wallet',
      label: 'Bank or mobile wallet',
      instructions:
        'Pay from any wallet that supports the Uganda interbank and mobile money interoperability switch.',
    },
  ],
} as const;

export type MobileMoneyProviderId = (typeof PAYMENT_METHODS.mobile_money)[number]['id'];

/** Detect the mobile money network from a Ugandan phone number. */
export function detectMobileMoneyProvider(phone: string) {
  const local = phone.replace(/[\s()-]/g, '').replace(/^\+?256/, '0');
  for (const method of PAYMENT_METHODS.mobile_money) {
    if (method.prefixes.some((prefix) => local.startsWith(prefix))) return method.id;
  }
  return null;
}

/** "Airtel" takes "an", "MTN" takes "a". */
export function article(word: string) {
  return /^[AEIOU]/i.test(word) ? 'an' : 'a';
}

/**
 * Approval instructions for a pending intent, so the client and the gateway
 * agree on what the customer is being told to do.
 */
export function approvalInstructions(channel: string, provider: string) {
  if (channel === 'mobile_money') {
    const method = PAYMENT_METHODS.mobile_money.find((m) => m.id === provider);
    return { instructions: method?.instructions ?? null, ussd: method?.ussd ?? null };
  }
  if (channel === 'card') {
    return { instructions: 'Your bank will ask you to approve this payment.', ussd: null };
  }
  if (channel === 'cod') {
    return { instructions: 'Pay the rider when your order arrives.', ussd: null };
  }
  return { instructions: 'Approve the payment prompt in your wallet app.', ussd: null };
}