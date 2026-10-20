import { json } from '@/lib/http';

/**
 * Payment channels available in Uganda.
 *
 * Mobile money carries real provider identifiers because the aggregator needs
 * them to route the USSD prompt. Card and wallet are card-network schemes
 * rather than single providers, so they carry a scheme instead.
 */

export type Channel = 'mobile_money' | 'card' | 'wallet' | 'cod';

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
  card: [
    {
      id: 'visa',
      provider: 'Visa',
      label: 'Visa',
      schemes: ['visa'],
      instructions: 'A one-time authorisation is placed on your card and released once the rider hands over.',
    },
    {
      id: 'mastercard',
      provider: 'Mastercard',
      label: 'Mastercard',
      schemes: ['mastercard'],
      instructions: 'A one-time authorisation is placed on your card and released once the rider hands over.',
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

/** Keep only the last four digits for display; never store a full PAN. */
export function maskCard(number: string) {
  const digits = number.replace(/\D/g, '');
  return `•••• ${digits.slice(-4)}`;
}

/**
 * Luhn check so an obviously invalid card is rejected before an authorisation
 * is attempted. The authoritative check belongs to the gateway.
 */
export function luhnValid(number: string) {
  const digits = number.replace(/\D/g, '');
  if (digits.length < 12) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
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
  return { instructions: 'Approve the payment prompt in your wallet app.', ussd: null };
}

export async function GET() {
  return json({
    data: Object.entries(PAYMENT_METHODS).map(([channel, methods]) => ({
      channel,
      methods: methods.map((m) => ({ ...m, channel })),
    })),
    meta: {
      currency: 'UGX',
      // Every channel is authoritative server-side on amount; the client only
      // chooses the channel and supplies the instrument.
      requiresApproval: ['mobile_money', 'wallet'],
      note: 'Amount, fees and the final payable total are computed on the server when the intent is created.',
    },
  });
}