import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cancelPurchaseOrder,
  changePassword,
  createPurchaseOrder,
  createProduct,
  createSupplier,
  currentAdmin,
  deactivateCustomer,
  fileToDataUrl,
  getForecast,
  listActivityLog,
  listAdminProducts,
  listCustomers,
  listInventoryMovements,
  listPurchaseOrders,
  listRegionalDemand,
  listSalesTrend,
  listSuppliers,
  receivePurchaseOrder,
  signOut,
  adjustInventory,
  updateProduct,
  withdrawProduct,
  type AdminIdentity,
  type AdminProduct,
  type CustomerRow,
  type ProductDraft,
  type PurchaseOrderRow,
  type SupplierRow,
} from '../lib/adminApi';
import { setOrderStatus, type OrderRow } from '../lib/orderApi';
import AdminGate from './AdminGate';
import OrderQueue from './OrderQueue';
import StockBadge from './StockBadge';
import { describeStockOf } from '../lib/stockApi';
import { formatUgx } from '../lib/currency';

const UNITS = ['kg', 'each', 'pint', 'bunch', 'crate'] as const;

type Tab =
  | 'catalogue'
  | 'inventory'
  | 'purchase-orders'
  | 'suppliers'
  | 'analytics'
  | 'activity'
  | 'admins'
  | 'customers';

const EMPTY_DRAFT: ProductDraft = {
  name: '',
  description: '',
  farm: '',
  location: '',
  priceValue: 0,
  unit: 'kg',
  stock: 0,
  dietary: [],
};

export default function AdminPage({ onClose }: { onClose?: () => void }) {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    currentAdmin().then((result) => {
      if (cancelled) return;
      if (result) setAdmin(result);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return (
      <div className="h-full flex items-center justify-center text-[14px] font-['Inter:Regular',_sans-serif] text-[#757575]">
        Checking your session…
      </div>
    );
  }

  if (!admin) return <AdminGate onSignedIn={setAdmin} />;

  const canManageAdmins = admin.role === 'owner';

  return (
    <StaffShell
      admin={admin}
      canManageAdmins={canManageAdmins}
      onSignOut={async () => {
        await signOut();
        setAdmin(null);
      }}
      onClose={onClose}
    />
  );
}

function StaffShell({
  admin,
  canManageAdmins,
  onSignOut,
  onClose,
}: {
  admin: AdminIdentity;
  canManageAdmins: boolean;
  onSignOut: () => Promise<void>;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<Tab>('catalogue');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flash = (message: string) => {
    setNotice(message);
    setError(null);
    window.setTimeout(() => setNotice(null), 4000);
  };

  const fail = (message: string) => {
    setError(message);
    setNotice(null);
    window.setTimeout(() => setError(null), 5000);
  };

  const tabs: { value: Tab; label: string; disabled?: boolean }[] = [
    { value: 'catalogue', label: 'Catalogue' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'purchase-orders', label: 'Purchase orders' },
    { value: 'suppliers', label: 'Suppliers' },
    { value: 'analytics', label: 'Analytics' },
    { value: 'activity', label: 'Activity log' },
    { value: 'customers', label: 'Customers' },
    ...(canManageAdmins ? [{ value: 'admins', label: 'Admins' }] : []),
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#f7f7f5]">
      <div className="sticky top-0 bg-white border-b border-neutral-200 px-4 py-3 z-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[16px] font-['Newsreader:Medium',_sans-serif] text-[#426b1f] leading-[22px]">
              Staff
            </p>
            <p className="text-[11px] font-['Inter:Regular',_sans-serif] text-[#757575]">
              {admin.name} · {admin.role}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onClose && (
              <button
                onClick={onClose}
                className="text-[12px] font-['Inter:Medium',_sans-serif] text-[#426b1f]"
              >
                Back to shop
              </button>
            )}
            <button
              onClick={onSignOut}
              className="text-[12px] font-['Inter:Regular',_sans-serif] text-[#757575]"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {tabs.map((item) => (
            <button
              key={item.value}
              disabled={item.disabled}
              onClick={() => setTab(item.value)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[12px] font-['Inter:Medium',_sans-serif] ${
                tab === item.value
                  ? 'bg-[#426b1f] text-white'
                  : item.disabled
                    ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                    : 'bg-neutral-100 text-[#000000]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {notice && (
          <p className="mt-2 rounded-lg border border-[#426b1f]/25 bg-[#426b1f]/8 px-3 py-2 text-[13px] text-[#426b1f] font-['Inter:Regular',_sans-serif]">
            {notice}
          </p>
        )}
        {error && (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 font-['Inter:Regular',_sans-serif]">
            {error}
          </p>
        )}
      </div>

      <div className="p-4">
        {tab === 'catalogue' && <CataloguePanel admin={admin} flash={flash} fail={fail} />}
        {tab === 'inventory' && <InventoryPanel flash={flash} fail={fail} />}
        {tab === 'purchase-orders' && <PurchaseOrdersPanel flash={flash} fail={fail} />}
        {tab === 'suppliers' && <SuppliersPanel flash={flash} fail={fail} />}
        {tab === 'analytics' && <AnalyticsPanel flash={flash} fail={fail} />}
        {tab === 'activity' && <ActivityPanel flash={flash} fail={fail} />}
        {tab === 'customers' && <CustomersPanel flash={flash} fail={fail} />}
        {tab === 'admins' && canManageAdmins && <AdminsPanel flash={flash} fail={fail} />}
      </div>
    </div>
  );
}

function CataloguePanel({
  admin,
  flash,
  fail,
}: {
  admin: AdminIdentity;
  flash: (message: string) => void;
  fail: (message: string) => void;
}) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const result = await listAdminProducts();
    if (!result) return fail('Could not reach the service.');
    if (!result.ok) return fail(result.error);
    setProducts(result.data);
    setLoading(false);
  }, [fail]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreated = async (draft: ProductDraft, imageDataUrl?: string) => {
    const result = await createProduct(imageDataUrl ? { ...draft, imageDataUrl } : draft);
    if (!result) return fail('Could not reach the service.');
    if (!result.ok) return fail(result.error);
    setAdding(false);
    flash(`Added ${result.data.name}.`);
    await load();
    return true;
  };

  const handleStock = async (product: AdminProduct, delta: number) => {
    const result = await updateProduct(product.id, { stock: product.stock + delta });
    if (!result) return fail('Could not reach the service.');
    if (!result.ok) return fail(result.error);
    setProducts((current) =>
      current.map((p) => (p.id === product.id ? result.data : p)),
    );
  };

  const handleToggle = async (product: AdminProduct) => {
    const result = await updateProduct(product.id, { active: !product.active });
    if (!result) return fail('Could not reach the service.');
    if (!result.ok) return fail(result.error);
    setProducts((current) =>
      current.map((p) => (p.id === product.id ? result.data : p)),
    );
    flash(product.active ? 'Withdrawn.' : 'Restored.');
  };

  return (
    <div className="p-4 space-y-3">
      {!adding && (
        <button
          onClick={() => {
            setAdding(true);
            setError(null);
          }}
          className="w-full rounded-xl bg-[#426b1f] text-white py-3 text-[14px] font-['Inter:Medium',_sans-serif]"
        >
          Add a product
        </button>
      )}

      {adding && <ProductForm onCancel={() => setAdding(false)} onSubmit={handleCreated} />}

      {loading ? (
        <p className="text-[13px] text-[#757575] py-4 text-center">Loading the catalogue…</p>
      ) : (
        products.map((product) => (
          <div
            key={product.id}
            className={`rounded-xl border bg-white p-3 ${
              product.active ? 'border-neutral-200' : 'border-neutral-200 opacity-70'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-['Inter:Medium',_sans-serif] text-[#000000]">
                  {product.name}
                  {!product.active && (
                    <span className="ml-2 text-[11px] text-[#9a9a9a]">withdrawn</span>
                  )}
                </p>
                <p className="text-[12px] text-[#757575]">
                  {product.price} · {product.farm}
                </p>
                <StockBadge
                  level={{
                    productId: product.id,
                    stock: product.stock,
                    unit: product.unit,
                    state: product.stockState as 'in_stock' | 'low' | 'out',
                    remaining: product.remaining,
                  }}
                />
              </div>
              <div className="mt-2.5 flex items-center gap-1.5">
                <button
                  onClick={() => handleStock(product, -1)}
                  disabled={product.stock < 1}
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-300 text-[12px] disabled:opacity-40"
                >
                  −1
                </button>
                <span className="px-2 text-[12px] min-w-[64px] text-center">
                  {product.stock} {product.unit}
                </span>
                <button
                  onClick={() => handleStock(product, 1)}
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-300 text-[12px]"
                >
                  +1
                </button>
                <button
                  onClick={() => handleToggle(product)}
                  className="ml-auto px-2.5 py-1.5 rounded-lg border border-neutral-300 text-[12px] text-[#426b1f]"
                >
                  {product.active ? 'Withdraw' : 'Restore'}
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ProductForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (draft: ProductDraft, imageDataUrl?: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_DRAFT);
  const [image, setImage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const valid =
    draft.name.trim().length >= 2 &&
    draft.description.trim().length >= 10 &&
    draft.farm.trim().length >= 2 &&
    draft.location.trim().length >= 2 &&
    draft.priceValue >= 1 &&
    Number.isInteger(draft.priceValue) &&
    draft.stock >= 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setLocalError(null);
    const ok = await onSubmit(
      { ...draft, name: draft.name.trim(), farm: draft.farm.trim() },
      image,
    );
    setBusy(false);
    if (!ok) setLocalError('The product was not added. Check the fields above.');
    else setDraft(EMPTY_DRAFT);
  };

  const inputClass =
    'w-full border border-neutral-200 rounded-lg px-3 py-2 text-[14px] font-[\'Inter:Regular\',_sans-serif]';

  return (
    <form onSubmit={submit} className="rounded-xl border border-neutral-200 bg-white p-3 space-y-2.5">
      <p className="text-[14px] font-['Inter:Medium',_sans-serif] text-[#000000]">New product</p>

      <Field label="Name">
        <input
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Green Pepper"
          className={inputClass}
        />
      </Field>
      <Field label="Description">
        <textarea
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
          rows={3}
          placeholder="Firm, glossy green peppers."
          className={`${inputClass} resize-none`}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Farm">
          <input
            value={draft.farm}
            onChange={(e) => set('farm', e.target.value)}
            placeholder="Nabugabo Farm"
            className={inputClass}
          />
        </Field>
        <Field label="Location">
          <input
            value={draft.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Wakiso District"
            className={inputClass}
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Price (USh)">
          <input
            type="number"
            inputMode="numeric"
            value={draft.priceValue || ''}
            onChange={(e) => set('priceValue', Number(e.target.value))}
            placeholder="8500"
            className={inputClass}
          />
        </Field>
        <Field label="Unit">
          <select value={draft.unit} onChange={(e) => set('unit', e.target.value)} className={inputClass}>
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </Field>
        <Field label="Stock">
          <input
            type="number"
            inputMode="numeric"
            value={draft.stock}
            onChange={(e) => set('stock', Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      </div>
      <p className="text-[11px] text-[#757575]">
        {draft.priceValue > 0 ? formatUgx(draft.priceValue) : 'the price'} per {draft.unit}
        {draft.stock > 0 ? `, ${describeStockOf(draft.stock, draft.unit)}.` : '.'}
      </p>
      <Field label="Photo (optional)">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) { setImage(undefined); return; }
            try { setImage(await fileToDataUrl(file)); }
            catch { setLocalError('That file could not be read.'); }
          }}
          className="text-[12px]"
        />
      </Field>
      {localError && <p className="text-[12px] text-red-600">{localError}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-neutral-300 py-2.5 text-[13px]">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!valid || busy}
          className={`flex-1 rounded-lg py-2.5 text-[13px] text-white ${!valid || busy ? 'bg-neutral-300 cursor-not-allowed' : 'bg-[#426b1f]'}`}
        >
          {busy ? 'Adding…' : 'Add product'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[12px] text-[#757575]">{label}</p>
      {children}
    </div>
  );
}

/* ---------------- Inventory ---------------- */

function InventoryPanel({ flash, fail }: { flash: (m: string) => void; fail: (m: string) => void }) {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState<number | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<'adjustment' | 'waste' | 'return' | 'correction'>('adjustment');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const result = await listInventoryMovements({ limit: 50 });
    if (!result) return fail('Could not reach the service.');
    if (!result.ok) return fail(result.error);
    setMovements(result.data.data);
    setLoading(false);
  }, [fail]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pid = Number(productId);
    const d = Number(delta);
    if (!Number.isInteger(pid) || pid <= 0 || !Number.isInteger(d) || d === 0) return;
    setAdjusting(pid);
    const result = await adjustInventory(pid, { delta: d, reason, note: note || undefined });
    if (!result) return fail('Could not reach the service.');
    if (!result.ok) return fail(result.error);
    setProductId(null); setDelta(''); setNote(''); setAdjusting(null);
    await load();
  };

  return (
    <div className="space-y-3">
      <p className="text-[14px] font-['Inter:Medium',_sans-serif] text-[#000000]">Stock movements</p>
      {loading ? (
        <p className="text-[13px] text-[#757575] py-4 text-center">Loading…</p>
      ) : movements.length === 0 ? (
        <p className="text-[13px] text-[#757575] py-4 text-center">No movements yet.</p>
      ) : (
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="pb-2 text-[#757575]">Product</th>
              <th className="pb-2 text-[#757575]">Reason</th>
              <th className="pb-2 text-[#757575] text-right">Delta</th>
              <th className="pb-2 text-[#757575]">Reference</th>
              <th className="pb-2 text-[#757575]">When</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-b border-neutral-100">
                <td className="py-2">{m.productName ?? m.productId}</td>
                <td className="py-2">{m.reason}</td>
                <td className="py-2 text-right">{m.delta > 0 ? '+' : ''}{m.delta}</td>
                <td className="py-2">{m.reference ?? '—'}</td>
                <td className="py-2">{new Date(m.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white p-3 space-y-2">
        <p className="text-[13px] font-['Inter:Medium',_sans-serif]">Adjust stock</p>
        <p className="text-[11px] text-[#757575]">Enter a product id and a signed delta (negative removes stock).</p>
        <div className="grid grid-cols-5 gap-2 items-end">
          <input
            type="number"
            placeholder="Product id"
            value={productId == null ? '' : String(productId)}
            onChange={(e) => setProductId(Number(e.target.value) || null)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-[13px]"
          />
          <input
            type="number"
            placeholder="Delta"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-[13px]"
          />
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as any)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-[13px]"
          >
            <option>adjustment</option>
            <option>waste</option>
            <option>return</option>
            <option>correction</option>
          </select>
          <button
            onClick={() => submit()}
            disabled={productId == null || delta === ''}
            className="bg-[#426b1f] text-white rounded-lg px-3 py-2 text-[13px] disabled:opacity-40"
          >
            Apply
          </button>
        </div>
        <input
          type="text"
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="border border-neutral-200 rounded-lg px-3 py-2 text-[13px] w-full"
        />
      </div>
    </div>
  );
}

/* ---------------- Purchase Orders ---------------- */

function PurchaseOrdersPanel({ flash, fail }: { flash: (m: string) => void; fail: (m: string) => void }) {
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = useCallback(async () => {
    const result = await listPurchaseOrders({ status: statusFilter || undefined });
    if (!result) return fail('Could not reach the service.');
    if (!result.ok) return fail(result.error);
    const data = result.data as any;
    setOrders(Array.isArray(data.data) ? data.data : [data.data]);
    setLoading(false);
  }, [fail, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (order: PurchaseOrderRow) => {
    if (!window.confirm(`Cancel ${order.reference}?`)) return;
    const result = await cancelPurchaseOrder(order.id);
    if (!result) return fail('Could not reach the service.');
    if (!result.ok) return fail(result.error);
    flash('Cancelled.');
    await load();
  };

  const handleReceive = async (order: PurchaseOrderRow) => {
    const result = await receivePurchaseOrder(order.id);
    if (!result) return fail('Could not reach the service.');
    if (!result.ok) return fail(result.error);
    flash('Received.');
    await load();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-end">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-neutral-200 rounded-lg px-3 py-2 text-[13px]"
        >
          <option value="">All statuses</option>
          <option>sent</option>
          <option>received</option>
          <option>cancelled</option>
        </select>
        <button
          onClick={() => {
            const supplier = window.prompt('Supplier name');
            if (!supplier) return;
            const items = window.prompt('Product id and quantity, e.g. "4,5"');
            if (!items) return;
            const [pid, qty] = items.split(',').map((s) => Number(s.trim()));
            const po = { supplierId: 1, items: [{ productId: pid, quantity: qty, unitPrice: 0 }] };
            createPurchaseOrder(po).then((r) => {
              if (!r || !r.ok) return fail(r?.error ?? 'Could not create.');
              flash('Purchase order created.');
              load();
            });
          }}
          className="bg-[#426b1f] text-white rounded-lg px-3 py-2 text-[13px]"
        >
          New
        </button>
      </div>
      {loading ? (
        <p className="text-[13px] text-[#757575] py-4 text-center">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="text-[13px] text-[#757575] py-4 text-center">No purchase orders.</p>
      ) : (
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="pb-2 text-[#757575]">Reference</th>
              <th className="pb-2 text-[#757575]">Status</th>
              <th className="pb-2 text-[#757575] text-right">Lines</th>
              <th className="pb-2 text-[#757575]">Created</th>
              <th className="pb-2 text-[#757575] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-neutral-100">
                <td className="py-2">{o.reference}</td>
                <td className="py-2">{o.status}</td>
                <td className="py-2 text-right">—</td>
                <td className="py-2">{new Date(o.createdAt).toLocaleDateString()}</td>
                <td className="py-2 text-right">
                  {o.status === 'sent' && (
                    <>
                      <button
                        onClick={() => handleReceive(o)}
                        className="mr-2 text-[12px] text-[#426b1f] underline underline-offset-2"
                      >
                        Receive
                      </button>
                      <button
                        onClick={() => handleCancel(o)}
                        className="text-[12px] text-red-600 underline underline-offset-2"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------------- Suppliers ---------------- */

function SuppliersPanel({ flash, fail }: { flash: (m: string) => void; fail: (m: string) => void }) {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    const result = await listSuppliers();
    if (!result) return fail('Could not reach the service.');
    if (!result.ok) return fail(result.error);
    setSuppliers(result.data.data);
    setLoading(false);
  }, [fail]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await createSupplier({ name: name.trim() });
    if (!result) return fail('Could not reach the service.');
    if (!result.ok) return fail(result.error);
    setName('');
    flash('Supplier added.');
    await load();
  };

  return (
    <div className="space-y-3">
      <p className="text-[14px] font-['Inter:Medium',_sans-serif] text-[#000000]">Suppliers</p>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Supplier name"
          className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-[13px]"
        />
        <button className="bg-[#426b1f] text-white rounded-lg px-3 py-2 text-[13px]">Add</button>
      </form>
      {loading ? (
        <p className="text-[13px] text-[#757575] py-4 text-center">Loading…</p>
      ) : suppliers.length === 0 ? (
        <p className="text-[13px] text-[#757575] py-4 text-center">No suppliers.</p>
      ) : (
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="pb-2 text-[#757575]">Name</th>
              <th className="pb-2 text-[#757575]">Products</th>
              <th className="pb-2 text-[#757575]">Region</th>
              <th className="pb-2 text-[#757575]">Phone</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100">
                <td className="py-2">{s.name}</td>
                <td className="py-2">{String(s.productCount ?? 0)}</td>
                <td className="py-2">{s.region ?? '—'}</td>
                <td className="py-2">{s.phone ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------------- Analytics ---------------- */

function AnalyticsPanel({ flash, fail }: { flash: (m: string) => void; fail: (m: string) => void }) {
  const [trend, setTrend] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [t, f] = await Promise.all([
      listSalesTrend({ bucket: 'day', limit: 14 }),
      getForecast(),
    ]);
    if (!t || !t.ok) return fail(t?.error ?? 'Could not reach the service.');
    setTrend(t.data);
    if (f && f.ok) setForecast(f.data);
    setLoading(false);
  }, [fail]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <p className="text-[14px] font-['Inter:Medium',_sans-serif] text-[#000000]">Sales trend (14 days)</p>
      {loading ? (
        <p className="text-[13px] text-[#757575] py-4 text-center">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {trend.map((p) => (
            <div key={p.bucket} className="rounded-xl border border-neutral-200 bg-white p-3">
              <p className="text-[12px] text-[#757575]">{p.bucket}</p>
              <p className="text-[16px] font-['Inter:Medium',_sans-serif]">{formatUgx(p.revenue)}</p>
              <p className="text-[12px] text-[#757575]">{p.orders} orders · {p.units} units</p>
            </div>
          ))}
        </div>
      )}
      {forecast && (
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-[13px] text-[#757575]">Revenue last 7 days</p>
          <p className="text-[16px] font-['Inter:Medium',_sans-serif]">{formatUgx(forecast.trailing.revenue7d)}</p>
          <p className="text-[13px] text-[#757575]">Daily average (30d)</p>
          <p className="text-[16px] font-['Inter:Medium',_sans-serif]">{formatUgx(forecast.trailing.dailyAverage30d)}</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Activity Log ---------------- */

function ActivityPanel({ flash, fail }: { flash: (m: string) => void; fail: (m: string) => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await listActivityLog({ limit: 50 });
    if (!result) return fail('Could not reach the service.');
    if (!result.ok) return fail(result.error);
    setLogs(result.data.data);
    setLoading(false);
  }, [fail]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <p className="text-[14px] font-['Inter:Medium',_sans-serif] text-[#000000]">Activity log</p>
      {loading ? (
        <p className="text-[13px] text-[#757575] py-4 text-center">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-[13px] text-[#757575] py-4 text-center">No activity yet.</p>
      ) : (
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="pb-2 text-[#757575]">When</th>
              <th className="pb-2 text-[#757575]">Admin</th>
              <th className="pb-2 text-[#757575]">Action</th>
              <th className="pb-2 text-[#757575]">Entity</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-neutral-100">
                <td className="py-2">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="py-2">{l.adminEmail ?? '—'}</td>
                <td className="py-2">{l.action}</td>
                <td className="py-2">{l.entity ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------------- Customers ---------------- */

function CustomersPanel({ flash, fail }: { flash: (m: string) => void; fail: (m: string) => void }) {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const result = await listCustomers({ q: q || undefined, active: true, limit: 50 });
    if (!result) return fail('Could not reach the service.');
    if (!result.ok) return fail(result.error);
    setCustomers(result.data.data);
    setLoading(false);
  }, [fail, q]);

  useEffect(() => { load(); }, [load, q]);

  const handleDeactivate = async (c: CustomerRow) => {
    if (!window.confirm(`Deactivate ${c.fullName}?`)) return;
    const result = await deactivateCustomer(c.id);
    if (!result) return fail('Could not reach the service.');
    if (!result.ok) return fail(result.error);
    flash('Deactivated.');
    await load();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or phone"
          className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-[13px]"
        />
      </div>
      {loading ? (
        <p className="text-[13px] text-[#757575] py-4 text-center">Loading…</p>
      ) : customers.length === 0 ? (
        <p className="text-[13px] text-[#757575] py-4 text-center">No customers.</p>
      ) : (
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="pb-2 text-[#757575]">Name</th>
              <th className="pb-2 text-[#757575]">Phone</th>
              <th className="pb-2 text-[#757575]">Region</th>
              <th className="pb-2 text-[#757575] text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-neutral-100">
                <td className="py-2">{c.fullName}</td>
                <td className="py-2">{c.phone}</td>
                <td className="py-2">{c.region ?? '—'}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => handleDeactivate(c)}
                    className="text-[12px] text-red-600 underline underline-offset-2"
                  >
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------------- Admins (owner only) ---------------- */

function AdminsPanel({ flash, fail }: { flash: (m: string) => void; fail: (m: string) => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await changePassword(current, next);
    setBusy(false);
    if (!result) return fail('Could not reach the service.');
    if (!result.ok) return fail(result.error);
    setCurrent(''); setNext('');
    flash('Password changed.');
  };

  return (
    <div className="space-y-3">
      <p className="text-[14px] font-['Inter:Medium',_sans-serif] text-[#000000]">Change your password</p>
      <form onSubmit={submit} className="space-y-2">
        <Field label="Current password">
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-[13px] w-full"
          />
        </Field>
        <Field label="New password (min 10)">
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-[13px] w-full"
          />
        </Field>
        <button
          type="submit"
          disabled={busy || !current || !next}
          className={`w-full rounded-lg py-2.5 text-[13px] text-white ${busy || !current || !next ? 'bg-neutral-300 cursor-not-allowed' : 'bg-[#426b1f]'}`}
        >
          {busy ? 'Changing…' : 'Change password'}
        </button>
      </form>
    </div>
  );
}
