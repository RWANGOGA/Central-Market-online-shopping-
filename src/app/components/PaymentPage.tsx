import React, { useEffect, useMemo, useState } from 'react';
import svgPaths from '../imports/svg-toln6of0ig';
import { Input } from './ui/input';
import { formatUgx } from '../lib/currency';
import { isValidUgandanPhone, normalizeUgandanPhone } from '../lib/uganda';
import {
  createPaymentIntent,
  fetchPaymentMethods,
  settlePaymentIntent,
  type PaymentChannel,
  type PaymentIntent,
  type PaymentMethod,
  type PaymentMethods,
  type PaymentTotals,
} from '../lib/paymentApi';

interface PaymentPageProps {
  cartCount: number;
  /** Server cart id, required to price the intent. */
  cartId: number | null;
  customerName: string;
  onBack: () => void;
  onMenuClick: () => void;
  onProceedToConfirmation: (reference: string) => void;
}

type CardDetails = { number: string; expiry: string; ccv: string };

const CHANNELS: { id: PaymentChannel; label: string; blurb: string }[] = [
  { id: 'mobile_money', label: 'Mobile Money', blurb: 'MTN, Airtel or UTel' },
  { id: 'card', label: 'Card', blurb: 'Visa or Mastercard' },
  { id: 'wallet', label: 'Wallet', blurb: 'Bank or mobile wallet' },
];

const STAGES = ['details', 'approval', 'done'] as const;
type Stage = (typeof STAGES)[number];

export default function PaymentPage({
  cartCount,
  cartId,
  customerName,
  onBack,
  onMenuClick,
  onProceedToConfirmation,
}: PaymentPageProps) {
  const [methods, setMethods] = useState<PaymentMethods | null>(null);
  const [methodsError, setMethodsError] = useState<string | null>(null);

  const [channel, setChannel] = useState<PaymentChannel>('mobile_money');
  const [provider, setProvider] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [walletId, setWalletId] = useState('');
  const [card, setCard] = useState<CardDetails>({ number: '', expiry: '', ccv: '' });

  const [stage, setStage] = useState<Stage>('details');
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [settlementToken, setSettlementToken] = useState<string>('');
  const [totals, setTotals] = useState<PaymentTotals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchPaymentMethods().then((result) => {
      if (!result) {
        setMethodsError('Payment service unavailable. Start the API with npm run dev --prefix api.');
        return;
      }
      setMethods(result);
      const first = result.groups[0]?.methods[0];
      if (first) setProvider(first.id);
    });
  }, []);

  const activeMethods = useMemo<PaymentMethod[]>(
    () => methods?.groups.find((g) => g.channel === channel)?.methods ?? [],
    [methods, channel],
  );

  // Keep the provider valid whenever the channel changes.
  useEffect(() => {
    if (activeMethods.length === 0) return;
    if (!activeMethods.some((m) => m.id === provider)) {
      setProvider(activeMethods[0].id);
    }
  }, [activeMethods, provider]);

  const selectedMethod = activeMethods.find((m) => m.id === provider) ?? null;
  const phoneValid = isValidUgandanPhone(phone);

  const isFormValid = useMemo(() => {
    if (!provider) return false;
    if (channel === 'mobile_money') return phoneValid;
    if (channel === 'card') {
      return card.number.replace(/\D/g, '').length >= 12 && /^\d{2}\/\d{2}$/.test(card.expiry) && /^\d{3,4}$/.test(card.ccv);
    }
    return walletId.trim().length >= 3;
  }, [provider, channel, phoneValid, card, walletId]);

  const handlePay = async () => {
    if (!isFormValid || busy) return;

    if (cartId === null) {
      setError(
        'No active basket was found on the server, so the amount cannot be verified. Add an item and try again.',
      );
      return;
    }

    setBusy(true);
    setError(null);

    const result = await createPaymentIntent({
      cartId,
      channel,
      provider,
      payerName: customerName || undefined,
      payerPhone: channel === 'mobile_money' ? (normalizeUgandanPhone(phone) ?? phone) : undefined,
      walletId: channel === 'wallet' ? walletId.trim() : undefined,
      card: channel === 'card' ? card : undefined,
    });

    setBusy(false);

    if (!result) {
      setError('Could not reach the payment service. Check that the API is running.');
      return;
    }
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setIntent(result.data.data);
    // Kept for the approval step; the server issues it once and never returns
    // it again.
    setSettlementToken(result.data.data.settlementToken);
    setTotals(result.data.totals ?? null);
    setStage('approval');
  };

  const confirmPayment = async () => {
    if (!intent || busy) return;
    setBusy(true);

    const result = await settlePaymentIntent(intent.reference, settlementToken, 'succeeded');

    setBusy(false);

    if (!result) {
      setError('Could not reach the payment service to confirm the payment.');
      return;
    }
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setIntent(result.data.data);
    setStage('done');
  };

  const cancelPayment = async () => {
    if (!intent || busy) return;
    setBusy(true);
    await settlePaymentIntent(intent.reference, settlementToken, 'cancelled', 'Cancelled by the customer');
    setBusy(false);
    setStage('details');
  };

  return (
    <div className="bg-[#ffffff] relative size-full">
      <StatusBar />
      <Header cartCount={cartCount} onBack={onBack} onMenuClick={onMenuClick} />
      <ProgressIndicators />

      <div className="absolute h-0 left-6 right-6 top-[222px]">
        <div className="absolute bottom-0 left-0 right-0 top-[-1px]">
          <svg className="block size-full" fill="none" viewBox="0 0 327 1">
            <line stroke="var(--stroke-0, #E5E5E5)" x2="327" y1="0.5" y2="0.5" />
          </svg>
        </div>
      </div>

      <div className="absolute left-6 top-[190px] text-[24px] text-[#426b1f] font-['Newsreader:Regular',_sans-serif] translate-y-[-50%]">
        <p className="leading-[32px]">Payment</p>
      </div>

      <div className="absolute left-6 top-[258px] text-[16px] text-[#000000] font-['Inter:Regular',_sans-serif] translate-y-[-50%]">
        <p className="leading-[1.5] whitespace-pre">
          {stage === 'details' ? 'Choose how you want to pay' : stage === 'approval' ? 'Approve the payment' : 'Payment received'}
        </p>
      </div>

      {/* Scrollable body so the channel cards and fields never sit under the footer. */}
      <div className="absolute left-0 right-0 top-[286px] bottom-[124px] overflow-y-auto">
        <div className="px-6 pb-6 pt-1 space-y-4">
          {stage === 'details' && (
            <>
              {methodsError && <Notice tone="error">{methodsError}</Notice>}

              <div className="grid grid-cols-3 gap-2">
                {CHANNELS.map((option) => {
                  const active = channel === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setChannel(option.id)}
                      className={`rounded-xl border px-2 py-3 text-left transition-colors ${
                        active
                          ? 'border-[#426b1f] bg-[#426b1f]/8'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <span
                        className={`block text-[13px] font-['Inter:Medium',_sans-serif] ${
                          active ? 'text-[#426b1f]' : 'text-[#000000]'
                        }`}
                      >
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-[14px] font-['Inter:Regular',_sans-serif] text-[#757575]">
                        {option.blurb}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeMethods.length > 1 && (
                <div className="space-y-2">
                  <p className="text-[14px] text-[#757575] font-['Inter:Regular',_sans-serif]">
                    {channel === 'mobile_money' ? 'Network' : 'Provider'}
                  </p>
                  <div className="space-y-1.5">
                    {activeMethods.map((method) => {
                      const active = method.id === provider;
                      return (
                        <button
                          key={method.id}
                          onClick={() => setProvider(method.id)}
                          className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 ${
                            active ? 'border-[#426b1f] bg-[#426b1f]/5' : 'border-neutral-200'
                          }`}
                        >
                          <span className="text-left">
                            <span className="block text-[14px] font-['Inter:Medium',_sans-serif] text-[#000000]">
                              {method.label}
                            </span>
                            {method.ussd && (
                              <span className="block text-[11px] font-['Inter:Regular',_sans-serif] text-[#757575]">
                                {method.ussd}
                              </span>
                            )}
                          </span>
                          <span
                            className={`size-4 rounded-full border-2 flex items-center justify-center ${
                              active ? 'border-[#426b1f]' : 'border-neutral-300'
                            }`}
                          >
                            {active && <span className="size-2 rounded-full bg-[#426b1f]" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {channel === 'mobile_money' && (
                <Field label="Mobile money number">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="07XX XXX XXX"
                    className={`bg-white border rounded-lg px-4 py-2 w-full font-['Inter:Regular',_sans-serif] text-[16px] ${
                      phone.length > 0 && !phoneValid ? 'border-red-500' : 'border-neutral-200'
                    }`}
                  />
                  {selectedMethod && (
                    <p className="mt-1 text-[11px] leading-[16px] font-['Inter:Regular',_sans-serif] text-[#757575]">
                      {phoneValid
                        ? selectedMethod.instructions
                        : `Starts with ${selectedMethod.prefixes?.join(', ')} for ${selectedMethod.label}`}
                    </p>
                  )}
                </Field>
              )}

              {channel === 'card' && (
                <div className="space-y-3">
                  <Field label="Card number">
                    <Input
                      value={card.number}
                      onChange={(e) =>
                        setCard((c) => ({
                          ...c,
                          number: formatCardNumber(e.target.value),
                        }))
                      }
                      inputMode="numeric"
                      placeholder="1234 5678 9012 3456"
                      className="bg-white border border-neutral-200 rounded-lg px-4 py-2 w-full font-['Inter:Regular',_sans-serif] text-[16px]"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Expiry">
                      <Input
                        value={card.expiry}
                        onChange={(e) => setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                        inputMode="numeric"
                        placeholder="MM/YY"
                        className="bg-white border border-neutral-200 rounded-lg px-4 py-2 w-full font-['Inter:Regular',_sans-serif] text-[16px]"
                      />
                    </Field>
                    <Field label="CVV">
                      <Input
                        value={card.ccv}
                        onChange={(e) =>
                          setCard((c) => ({
                            ...c,
                            ccv: e.target.value.replace(/\D/g, '').slice(0, 4),
                          }))
                        }
                        inputMode="numeric"
                        placeholder="123"
                        className="bg-white border border-neutral-200 rounded-lg px-4 py-2 w-full font-['Inter:Regular',_sans-serif] text-[16px]"
                      />
                    </Field>
                  </div>
                </div>
              )}

              {channel === 'wallet' && (
                <Field label="Wallet number or address">
                  <Input
                    value={walletId}
                    onChange={(e) => setWalletId(e.target.value)}
                    placeholder="allen@stanbic"
                    className="bg-white border border-neutral-200 rounded-lg px-4 py-2 w-full font-['Inter:Regular',_sans-serif] text-[16px]"
                  />
                  <p className="mt-1 text-[11px] leading-[16px] font-['Inter:Regular',_sans-serif] text-[#757575]">
                    Works with any wallet on the Uganda interbank and mobile money switch.
                  </p>
                </Field>
              )}

              {error && <Notice tone="error">{error}</Notice>}
            </>
          )}

          {stage === 'approval' && intent && (
            <>
              <div className="rounded-xl border border-[#426b1f]/25 bg-[#426b1f]/5 p-4 space-y-2">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-[#426b1f]">
                  {intent.nextAction.ussd ? `Dial ${intent.nextAction.ussd}` : 'Awaiting approval'}
                </p>
                <p className="text-[14px] leading-[20px] font-['Inter:Regular',_sans-serif] text-[#000000]">
                  {intent.nextAction.instructions}
                </p>
                {intent.payerPhone && (
                  <p className="text-[12px] font-['Inter:Regular',_sans-serif] text-[#757575]">
                    Requested from {intent.payerPhone}
                  </p>
                )}
                {intent.maskedCard && (
                  <p className="text-[12px] font-['Inter:Regular',_sans-serif] text-[#757575]">
                    Card {intent.maskedCard}
                  </p>
                )}
                <p className="text-[11px] font-['Inter:Regular',_sans-serif] text-[#757575]">
                  Reference {intent.reference}
                </p>
              </div>

              {totals && (
                <dl className="rounded-xl border border-neutral-200 p-4 space-y-1.5">
                  <Row label="Subtotal" value={formatUgx(totals.subtotal)} />
                  <Row
                    label="Delivery"
                    value={totals.delivery === 0 ? 'Free' : formatUgx(totals.delivery)}
                  />
                  <div className="border-t border-neutral-100 pt-1.5 mt-1.5">
                    <Row label="Total" value={formatUgx(totals.total)} strong />
                  </div>
                </dl>
              )}

              {error && <Notice tone="error">{error}</Notice>}

              <div className="space-y-2">
                <button
                  onClick={confirmPayment}
                  disabled={busy}
                  className="w-full bg-[#426b1f] text-white rounded-lg py-3 text-[14px] font-['Inter:Medium',_sans-serif] disabled:opacity-60"
                >
                  {busy ? 'Confirming…' : 'I have approved the payment'}
                </button>
                <button
                  onClick={cancelPayment}
                  disabled={busy}
                  className="w-full border border-neutral-300 rounded-lg py-2.5 text-[13px] font-['Inter:Regular',_sans-serif] text-[#000000] disabled:opacity-60"
                >
                  Cancel payment
                </button>
              </div>
            </>
          )}

          {stage === 'done' && intent && (
            <div className="space-y-3">
              <Notice tone="success">
                {formatUgx(intent.amount)} received by {intent.provider}.
              </Notice>
              <dl className="rounded-xl border border-neutral-200 p-4 space-y-1.5">
                <Row label="Channel" value={intent.provider} />
                <Row label="Reference" value={intent.reference} />
                {intent.payerPhone && <Row label="Number" value={intent.payerPhone} />}
                {intent.maskedCard && <Row label="Card" value={intent.maskedCard} />}
              </dl>
              <button
                onClick={() => onProceedToConfirmation(intent.reference)}
                className="w-full bg-[#426b1f] text-white rounded-lg py-3 text-[14px] font-['Inter:Medium',_sans-serif]"
              >
                Continue to confirmation
              </button>
            </div>
          )}
        </div>
      </div>

      {stage === 'details' && (
        <Footer
          isFormValid={isFormValid && !methodsError}
          busy={busy}
          label={cartId === null ? 'Basket unavailable' : 'Pay now'}
          onPay={handlePay}
        />
      )}
    </div>
  );
}

function formatCardNumber(value: string) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{4})(?=\d)/g, '$1 ')
    .slice(0, 19);
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length >= 3 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[13px] font-['Inter:Regular',_sans-serif] text-[#757575]">{label}</dt>
      <dd
        className={`text-[13px] font-['Inter:Regular',_sans-serif] ${
          strong ? 'text-[#426b1f] font-semibold' : 'text-[#000000]'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[14px] font-['Inter:Regular',_sans-serif] text-[#757575]">{label}</p>
      {children}
    </div>
  );
}

function Notice({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  const styles =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-[#426b1f]/25 bg-[#426b1f]/8 text-[#426b1f]';
  return (
    <div className={`rounded-lg border px-3 py-2 text-[13px] leading-[19px] font-['Inter:Regular',_sans-serif] ${styles}`}>
      {children}
    </div>
  );
}

function Footer({
  isFormValid,
  busy,
  label,
  onPay,
}: {
  isFormValid: boolean;
  busy: boolean;
  label: string;
  onPay: () => void;
}) {
  return (
    <div className="absolute bg-[#ffffff] bottom-0 h-[124px] left-0 overflow-clip right-0 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.1)]">
      <button
        onClick={isFormValid && !busy ? onPay : undefined}
        disabled={!isFormValid || busy}
        className={`absolute left-6 right-6 rounded-lg top-6 ${
          isFormValid ? 'bg-[#426b1f] cursor-pointer' : 'bg-neutral-200 cursor-not-allowed'
        }`}
      >
        <div className="flex flex-row items-center relative size-full">
          <div className="flex flex-row items-center justify-start pl-6 pr-4 py-2 relative w-full">
            <p className="text-[14px] font-['Inter:Regular',_sans-serif] text-[#ffffff] grow">
              {busy ? 'Working…' : label}
            </p>
            <div className="size-8 shrink-0">
              <svg className="block size-full" fill="none" viewBox="0 0 32 32">
                <path d={svgPaths.p3d7c1f80} fill="var(--fill-0, white)" />
              </svg>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="absolute h-[47px] left-0 overflow-clip right-0 top-0">
      <div className="absolute h-[33px] top-[-2px] translate-x-[-50%] w-[156px]" style={{ left: 'calc(50% + 0.499992px)' }}>
        <svg className="block size-full" fill="none" viewBox="0 0 156 33">
          <g>
            <path d={svgPaths.p28770100} fill="black" />
            <path d={svgPaths.p28f48b80} fill="var(--fill-0, black)" />
            <path d={svgPaths.p14d82600} fill="var(--fill-0, black)" />
          </g>
        </svg>
      </div>
      <div className="absolute h-[21px] rounded-3xl top-3.5 translate-x-[-50%] w-[54px]" style={{ left: 'calc(50% - 135.5px)' }}>
        <p className="font-['SF_Pro_Display:Bold',_sans-serif] h-5 leading-[0] not-italic text-[#000000] text-[17px] text-center tracking-[-0.408px] translate-x-[-50%] w-[54px]">
          <span className="adjustLetterSpacing block leading-[22px]">9:41</span>
        </p>
      </div>
      <div className="absolute h-[13px] top-[19px] translate-x-[-50%] w-[27.401px]" style={{ left: 'calc(50% + 150.201px)' }}>
        <svg className="block size-full" fill="none" viewBox="0 0 28 13">
          <g>
            <path d={svgPaths.p3f827980} opacity="0.35" stroke="var(--stroke-0, black)" />
            <path d={svgPaths.p5fdc300} fill="var(--fill-0, black)" opacity="0.4" />
            <path d={svgPaths.pbee4a00} fill="var(--fill-0, black)" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function Header({
  cartCount,
  onBack,
  onMenuClick,
}: {
  cartCount: number;
  onBack: () => void;
  onMenuClick: () => void;
}) {
  return (
    <div className="absolute bg-[#ffffff] h-[149px] left-0 right-0 top-0">
      <div className="absolute border-[0px_0px_1px] border-neutral-200 border-solid inset-0 pointer-events-none shadow-[0px_0px_20px_0px_rgba(0,0,0,0.1)]" />

      <div
        className="absolute left-0 right-0 top-[31px] text-[24px] text-center font-['Newsreader:Medium',_sans-serif] text-[#426b1f] translate-y-[-50%]"
        style={{ top: 'calc(31px + 36px)' }}
      >
        <p className="adjustLetterSpacing leading-none whitespace-pre">Mu Katale</p>
      </div>

      <div className="absolute right-5 rounded-2xl size-8 top-[18px]">
        <svg className="block size-full" fill="none" viewBox="0 0 32 32">
          <path d={svgPaths.p2003cd00} fill="var(--fill-0, black)" />
        </svg>
        {cartCount > 0 && (
          <div className="absolute bg-[#426b1f] left-[17px] rounded-lg size-4 top-[-1px] flex items-center justify-center">
            <p className="text-[#ffffff] text-[9px] leading-none">{cartCount}</p>
          </div>
        )}
      </div>

      <button
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        className="absolute left-5 rounded-2xl size-8 top-[18px] flex items-center justify-center cursor-pointer"
      >
        <div className="h-1.5 w-[18px]">
          <svg className="block size-full" fill="none" viewBox="0 0 18 8">
            <line stroke="var(--stroke-0, black)" strokeWidth="1.5" x2="18" y1="1.25" y2="1.25" />
            <line stroke="var(--stroke-0, black)" strokeWidth="1.5" x2="18" y1="7.25" y2="7.25" />
          </svg>
        </div>
      </button>

      <div className="absolute left-6 right-6 top-[103px]">
        <div className="flex flex-row font-normal items-center justify-start w-full">
          <div className="flex flex-col font-['Newsreader:Regular',_sans-serif] grow justify-center text-[#000000] text-[24px] tracking-[-0.48px]">
            <p className="block leading-[32px] text-[24px]">Checkout</p>
          </div>
          <button
            onClick={onBack}
            className="cursor-pointer flex items-center font-['Inter:Regular',_sans-serif] not-italic shrink-0 text-[#426b1f] text-[14px] tracking-[-0.14px]"
          >
            <div className="flex flex-row items-center gap-2">
              <div className="w-3 h-3">
                <svg className="block size-full" fill="none" viewBox="0 0 12 12">
                  <path d="M7.5 9L4.5 6L7.5 3" stroke="#426b1f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="adjustLetterSpacing block leading-[24px] whitespace-pre">Back</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgressIndicators() {
  return (
    <>
      <div className="absolute left-6 top-[174px] size-8">
        <svg className="block size-full" fill="none" viewBox="0 0 32 32">
          <circle cx="16" cy="16" fill="var(--fill-0, #426B1F)" r="16" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-['Roboto:Regular',_sans-serif] text-[#ffffff] text-[16px] leading-none">1</span>
        </div>
      </div>
      <div className="absolute size-8 top-[174px]" style={{ left: 'calc(50% + 93.5px)' }}>
        <svg fill="none" viewBox="0 0 32 32" className="block size-full">
          <circle cx="16" cy="16" fill="var(--fill-0, #426B1F)" r="16" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-['Roboto:Regular',_sans-serif] text-[#ffffff] text-[16px] leading-none">2</span>
        </div>
      </div>
      <div className="absolute size-8 top-[174px]" style={{ left: 'calc(50% + 131.5px)' }}>
        <svg fill="none" viewBox="0 0 32 32" className="block size-full">
          <circle cx="16" cy="16" fill="var(--fill-0, #757575)" r="16" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-['Roboto:Regular',_sans-serif] text-[#ffffff] text-[16px] leading-none">3</span>
        </div>
      </div>
    </>
  );
}