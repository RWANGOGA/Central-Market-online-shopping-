import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ORDER_STATUSES,
  getOrder,
  listOrders,
  setOrderStatus,
  subscribeToOrders,
  type OrderDetail,
  type OrderListMeta,
  type OrderRow,
  type OrderStatus,
} from '../lib/orderApi';
import { formatUgx } from '../lib/currency';

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: 'bg-[#b07d2b]/12 text-[#b07d2b] border-[#b07d2b]/25',
  processing: 'bg-[#426b1f]/10 text-[#426b1f] border-[#426b1f]/20',
  shipped: 'bg-[#2b6cb0]/10 text-[#2b6cb0] border-[#2b6cb0]/20',
  delivered: 'bg-[#2f855a]/10 text-[#2f855a] border-[#2f855a]/20',
  cancelled: 'bg-neutral-100 text-[#757575] border-neutral-200',
};

const PAGE_SIZE = 25;

export default function OrderQueue({
  onBack,
}: {
  onBack?: () => void;
}) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [meta, setMeta] = useState<OrderListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [offset, setOffset] = useState(0);

  const [live, setLive] = useState(false);
  const [flash, setFlash] = useState<string[]>([]);
  const [selected, setSelected] = useState<OrderDetail | null>(null);

  const load = useCallback(async () => {
    const result = await listOrders({
      q: query || undefined,
      status: status || undefined,
      region: region || undefined,
      limit: PAGE_SIZE,
      offset,
    });

    if (!result) {
      setError('Could not reach the service.');
      setLoading(false);
      return;
    }
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setOrders(result.data.data);
    setMeta(result.data.meta);
    setError(null);
    setLoading(false);
  }, [query, status, region, offset]);

  useEffect(() => {
    load();
  }, [load]);

  // Live feed, with polling underneath as a safety net. The stream is
  // process-local, so on a multi-instance deployment it adds latency rather
  // than failing loudly, and the interval keeps the queue honest either way.
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      (event) => {
        setFlash((current) => [event.reference, ...current].slice(0, 5));
        window.setTimeout(() => {
          setFlash((current) => current.filter((ref) => ref !== event.reference));
        }, 6000);
        loadRef.current();
      },
      setLive,
    );

    const poll = window.setInterval(() => loadRef.current(), 30_000);
    return () => {
      unsubscribe();
      window.clearInterval(poll);
    };
  }, []);

  const openOrder = async (row: OrderRow) => {
    const result = await getOrder(row.reference);
    if (!result) {
      setError('Could not reach the service.');
      return;
    }
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelected(result.data.data);
  };

  const move = async (order: OrderDetail, next: string) => {
    const result = await setOrderStatus(order.reference, next);
    if (!result) {
      setError('Could not reach the service.');
      return;
    }
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelected(result.data.data);
    setError(null);
    load();
  };

  if (selected) {
    return (
      <OrderDetailPanel
        order={selected}
        onBack={() => setSelected(null)}
        onMove={(next) => move(selected, next)}
        onError={setError}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f7f7f5] pb-6">
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[16px] font-['Newsreader:Medium',_sans-serif] text-[#426b1f] leading-[22px]">
              Orders
            </p>
            <p className="text-[11px] font-['Inter:Regular',_sans-serif] text-[#757575]">
              {meta ? `${meta.total} total` : 'Loading'}
              {live ? ' · live' : ' · refreshing every 30s'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${live ? 'bg-[#2f855a]' : 'bg-neutral-300'}`}
              aria-label={live ? 'Live updates connected' : 'Not connected to live updates'}
            />
            {onBack && (
              <button
                onClick={onBack}
                className="text-[12px] font-['Inter:Medium',_sans-serif] text-[#426b1f]"
              >
                Back
              </button>
            )}
          </div>
        </div>

        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOffset(0);
          }}
          placeholder="Search reference, name or phone"
          className="mt-2 w-full border border-neutral-200 rounded-lg px-3 py-2 text-[13px] font-['Inter:Regular',_sans-serif]"
        />

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          <FilterChip active={status === ''} onClick={() => { setStatus(''); setOffset(0); }}>
            All
          </FilterChip>
          {ORDER_STATUSES.map((value) => (
            <FilterChip
              key={value}
              active={status === value}
              onClick={() => { setStatus(status === value ? '' : value); setOffset(0); }}
            >
              {value}
            </FilterChip>
          ))}
        </div>

        {meta && meta.regions.length > 1 && (
          <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
            <FilterChip active={region === ''} onClick={() => { setRegion(''); setOffset(0); }}>
              All regions
            </FilterChip>
            {meta.regions.map((value) => (
              <FilterChip
                key={value}
                active={region === value}
                onClick={() => { setRegion(region === value ? '' : value); setOffset(0); }}
              >
                {value.replace(' Region', '')}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 font-['Inter:Regular',_sans-serif]">
            {error}
          </p>
        )}

        {loading && (
          <p className="py-6 text-center text-[13px] font-['Inter:Regular',_sans-serif] text-[#757575]">
            Loading orders…
          </p>
        )}

        {!loading && orders.length === 0 && (
          <p className="py-6 text-center text-[13px] font-['Inter:Regular',_sans-serif] text-[#757575]">
            No orders match these filters.
          </p>
        )}

        {orders.map((order) => (
          <button
            key={order.id}
            onClick={() => openOrder(order)}
            className={`w-full text-left rounded-xl border bg-white p-3 ${
              flash.includes(order.reference)
                ? 'border-[#426b1f] ring-1 ring-[#426b1f]/30'
                : 'border-neutral-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-['Inter:Medium',_sans-serif] text-[#000000]">
                  {order.customerName ?? 'Unknown customer'}
                  {flash.includes(order.reference) && (
                    <span className="ml-2 text-[10px] font-['Inter:Regular',_sans-serif] text-[#426b1f]">
                      new
                    </span>
                  )}
                </p>
                <p className="text-[12px] font-['Inter:Regular',_sans-serif] text-[#757575]">
                  {order.reference} · {order.phone ?? 'no phone'}
                </p>
                <p className="text-[11px] font-['Inter:Regular',_sans-serif] text-[#9a9a9a]">
                  {[order.district, order.region].filter(Boolean).join(', ')} ·{' '}
                  {order.itemCount} line{order.itemCount === 1 ? '' : 's'}, {order.unitCount} unit
                  {order.unitCount === 1 ? '' : 's'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[14px] font-['Inter:Medium',_sans-serif] text-[#426b1f]">
                  {formatUgx(order.total)}
                </p>
                <span
                  className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border font-['Inter:Medium',_sans-serif] ${STATUS_TONE[order.status]}`}
                >
                  {order.status}
                </span>
              </div>
            </div>
          </button>
        ))}

        {meta && meta.total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="px-3 py-2 rounded-lg border border-neutral-300 text-[12px] font-['Inter:Medium',_sans-serif] disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-[11px] font-['Inter:Regular',_sans-serif] text-[#757575]">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, meta.total)} of {meta.total}
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= meta.total}
              className="px-3 py-2 rounded-lg border border-neutral-300 text-[12px] font-['Inter:Medium',_sans-serif] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border font-['Inter:Regular',_sans-serif] transition-colors ${
        active
          ? 'bg-[#426b1f] text-white border-[#426b1f]'
          : 'bg-white text-[#000000] border-neutral-300'
      }`}
    >
      {children}
    </button>
  );
}

function OrderDetailPanel({
  order,
  onBack,
  onMove,
  onError,
}: {
  order: OrderDetail;
  onBack: () => void;
  onMove: (next: string) => void;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const act = async (next: string) => {
    setBusy(next);
    onError(null);
    onMove(next);
    setBusy(null);
    setNote('');
  };

  const address = order.shippingAddress;

  return (
    <div className="h-full overflow-y-auto bg-[#f7f7f5] pb-8">
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="text-[12px] font-['Inter:Medium',_sans-serif] text-[#426b1f]"
        >
          &larr; All orders
        </button>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full border font-['Inter:Medium',_sans-serif] ${STATUS_TONE[order.status]}`}
        >
          {order.status}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-[15px] font-['Inter:Medium',_sans-serif] text-[#000000]">
            {order.customerName ?? 'Unknown customer'}
          </p>
          <p className="text-[12px] font-['Inter:Regular',_sans-serif] text-[#757575]">
            {order.reference} · {order.phone ?? 'no phone'}
          </p>
          {address && (
            <p className="mt-1 text-[12px] font-['Inter:Regular',_sans-serif] text-[#757575]">
              {[address.address, address.district, address.region].filter(Boolean).join(', ')}
            </p>
          )}
          <p className="mt-2 text-[16px] font-['Inter:Medium',_sans-serif] text-[#426b1f]">
            {formatUgx(order.total)}
          </p>
        </div>

        {order.nextStatuses.length > 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-3 space-y-2">
            <p className="text-[13px] font-['Inter:Medium',_sans-serif] text-[#000000]">
              Move this order on
            </p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note for the timeline (optional)"
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-[13px] font-['Inter:Regular',_sans-serif]"
            />
            <div className="flex flex-wrap gap-1.5">
              {order.nextStatuses.map((next) => (
                <button
                  key={next}
                  onClick={() => act(next)}
                  disabled={busy !== null}
                  className="px-3 py-2 rounded-lg border border-neutral-300 text-[12px] font-['Inter:Medium',_sans-serif] disabled:opacity-40"
                >
                  {busy === next ? 'Moving…' : `Mark ${next}`}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-neutral-200 bg-white p-3 text-[12px] font-['Inter:Regular',_sans-serif] text-[#757575]">
            This order has reached {order.status} and cannot change.
          </p>
        )}

        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-[13px] font-['Inter:Medium',_sans-serif] text-[#000000] mb-2">
            Items
          </p>
          <div className="space-y-1.5">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-['Inter:Regular',_sans-serif] text-[#000000]">
                  {item.quantity} × {item.name}
                </span>
                <span className="text-[12px] font-['Inter:Regular',_sans-serif] text-[#757575]">
                  {formatUgx(item.lineTotal)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-neutral-100 space-y-1">
            <MoneyRow label="Subtotal" value={order.subtotal} />
            <MoneyRow label="Delivery" value={order.shipping} />
            <MoneyRow label="Tax" value={order.tax} />
            <MoneyRow label="Total" value={order.total} strong />
          </div>
        </div>

        {order.payments.length > 0 && (
          <div className="rounded-xl border border-neutral-200 bg-white p-3">
            <p className="text-[13px] font-['Inter:Medium',_sans-serif] text-[#000000] mb-2">
              Payment
            </p>
            {order.payments.map((payment) => (
              <div key={payment.id} className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-['Inter:Regular',_sans-serif] text-[#000000]">
                  {payment.provider}
                  {payment.maskedCard ? ` ${payment.maskedCard}` : ''}
                </span>
                <span className="text-[12px] font-['Inter:Regular',_sans-serif] text-[#757575]">
                  {payment.status} · {formatUgx(payment.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-[13px] font-['Inter:Medium',_sans-serif] text-[#000000] mb-2">
            Timeline
          </p>
          <ol className="space-y-2">
            {order.timeline.map((entry) => (
              <li key={entry.id} className="flex gap-2">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-[#426b1f]" />
                <div className="min-w-0">
                  <p className="text-[12px] font-['Inter:Regular',_sans-serif] text-[#000000]">
                    {entry.fromStatus ? `${entry.fromStatus} → ` : ''}
                    {entry.toStatus}
                  </p>
                  <p className="text-[11px] font-['Inter:Regular',_sans-serif] text-[#9a9a9a]">
                    {entry.changedByEmail ?? 'system'} · {entry.createdAt}
                  </p>
                  {entry.note && (
                    <p className="text-[11px] font-['Inter:Regular',_sans-serif] text-[#757575]">
                      {entry.note}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function MoneyRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[12px] font-['Inter:Regular',_sans-serif] text-[#757575]">{label}</span>
      <span
        className={`text-[12px] font-['Inter:Regular',_sans-serif] ${
          strong ? 'text-[#426b1f] font-semibold' : 'text-[#000000]'
        }`}
      >
        {value === 0 ? 'Free' : formatUgx(value)}
      </span>
    </div>
  );
}