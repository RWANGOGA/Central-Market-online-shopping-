import React, { useCallback, useEffect, useState } from 'react';
import {
  createProduct,
  currentAdmin,
  fileToDataUrl,
  listAdminProducts,
  signOut,
  updateProduct,
  withdrawProduct,
  type AdminIdentity,
  type AdminProduct,
  type ProductDraft,
} from '../lib/adminApi';
import AdminGate from './AdminGate';
import OrderQueue from './OrderQueue';
import StockBadge from './StockBadge';
import { describeStockOf } from '../lib/stockApi';
import { formatUgx } from '../lib/currency';

const UNITS = ['kg', 'each', 'pint', 'bunch', 'crate'] as const;

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

  return (
    <CatalogueManager
      admin={admin}
      onSignOut={async () => {
        await signOut();
        setAdmin(null);
      }}
      onClose={onClose}
    />
  );
}

function CatalogueManager({
  admin,
  onSignOut,
  onClose,
}: {
  admin: AdminIdentity;
  onSignOut: () => Promise<void>;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<'catalogue' | 'orders'>('catalogue');
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const result = await listAdminProducts();
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
    setProducts(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  };

  const handleCreated = async (draft: ProductDraft, imageDataUrl?: string) => {
    const result = await createProduct(imageDataUrl ? { ...draft, imageDataUrl } : draft);
    if (!result) {
      setError('Could not reach the service.');
      return false;
    }
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    setAdding(false);
    flash(`Added ${result.data.name}. The existing products were not touched.`);
    await load();
    return true;
  };

  const handleStock = async (product: AdminProduct, delta: number) => {
    const next = product.stock + delta;
    if (next < 0) return;

    const result = await updateProduct(product.id, { stock: next });
    if (!result) {
      setError('Could not reach the service.');
      return;
    }
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setProducts((current) => current.map((p) => (p.id === product.id ? result.data : p)));
  };

  const handleToggleActive = async (product: AdminProduct) => {
    const result = await updateProduct(product.id, { active: !product.active });
    if (!result) {
      setError('Could not reach the service.');
      return;
    }
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setProducts((current) => current.map((p) => (p.id === product.id ? result.data : p)));
    flash(
      product.active
        ? `${product.name} withdrawn. The row is kept so past orders still resolve.`
        : `${product.name} restored.`,
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f7f7f5]">
      <div className="sticky top-0 bg-white border-b border-neutral-200 px-4 py-3 z-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[16px] font-['Newsreader:Medium',_sans-serif] text-[#426b1f] leading-[22px]">
              Catalogue
            </p>
            <p className="text-[11px] font-['Inter:Regular',_sans-serif] text-[#757575]">
              {admin.name} · {admin.role} · {products.filter((p) => p.active).length} live
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

        <div className="mt-2 flex gap-1.5">
          {(
            [
              ['catalogue', 'Catalogue'],
              ['orders', 'Orders'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-['Inter:Medium',_sans-serif] ${
                tab === value
                  ? 'bg-[#426b1f] text-white'
                  : 'bg-neutral-100 text-[#000000]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'orders' ? (
        <OrderQueue />
      ) : (
      <div className="p-4 space-y-3">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 font-['Inter:Regular',_sans-serif]">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg border border-[#426b1f]/25 bg-[#426b1f]/8 px-3 py-2 text-[13px] text-[#426b1f] font-['Inter:Regular',_sans-serif]">
            {notice}
          </p>
        )}

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

        {adding && (
          <ProductForm
            onCancel={() => setAdding(false)}
            onSubmit={handleCreated}
          />
        )}

        {loading && (
          <p className="text-[13px] font-['Inter:Regular',_sans-serif] text-[#757575] py-4 text-center">
            Loading the catalogue…
          </p>
        )}

        {!loading &&
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
                      <span className="ml-2 text-[11px] font-['Inter:Regular',_sans-serif] text-[#9a9a9a]">
                        withdrawn
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] font-['Inter:Regular',_sans-serif] text-[#757575]">
                    {product.price} · {product.farm}
                  </p>
                </div>
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
                  onClick={() => handleStock(product, -10)}
                  disabled={product.stock < 10}
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-300 text-[12px] font-['Inter:Medium',_sans-serif] disabled:opacity-40"
                >
                  −10
                </button>
                <button
                  onClick={() => handleStock(product, -1)}
                  disabled={product.stock < 1}
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-300 text-[12px] font-['Inter:Medium',_sans-serif] disabled:opacity-40"
                >
                  −1
                </button>
                <span className="px-2 text-[12px] font-['Inter:Medium',_sans-serif] text-[#000000] min-w-[64px] text-center">
                  {product.stock} {product.unit}
                </span>
                <button
                  onClick={() => handleStock(product, 1)}
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-300 text-[12px] font-['Inter:Medium',_sans-serif]"
                >
                  +1
                </button>
                <button
                  onClick={() => handleStock(product, 10)}
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-300 text-[12px] font-['Inter:Medium',_sans-serif]"
                >
                  +10
                </button>

                <button
                  onClick={() => handleToggleActive(product)}
                  className="ml-auto px-2.5 py-1.5 rounded-lg border border-neutral-300 text-[12px] font-['Inter:Medium',_sans-serif] text-[#426b1f]"
                >
                  {product.active ? 'Withdraw' : 'Restore'}
                </button>
              </div>
            </div>
          ))}
      </div>
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
          placeholder="Firm, glossy green peppers picked at full size."
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
        <Field label="District and region">
          <input
            value={draft.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Grown in Wakiso District"
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
          <select
            value={draft.unit}
            onChange={(e) => set('unit', e.target.value)}
            className={inputClass}
          >
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
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

      <p className="text-[11px] font-['Inter:Regular',_sans-serif] text-[#757575]">
        Buyers will see {draft.priceValue > 0 ? formatUgx(draft.priceValue) : 'the price'} per{' '}
        {draft.unit}
        {draft.stock > 0 ? `, and "${describeStockOf(draft.stock, draft.unit)}".` : '.'}
      </p>

      <Field label="Photo (optional, max 5 MB)">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) {
              setImage(undefined);
              return;
            }
            try {
              setImage(await fileToDataUrl(file));
            } catch {
              setLocalError('That file could not be read.');
            }
          }}
          className="text-[12px] font-['Inter:Regular',_sans-serif]"
        />
      </Field>

      {localError && (
        <p className="text-[12px] font-['Inter:Regular',_sans-serif] text-red-600">{localError}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-neutral-300 py-2.5 text-[13px] font-['Inter:Medium',_sans-serif]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!valid || busy}
          className={`flex-1 rounded-lg py-2.5 text-[13px] font-['Inter:Medium',_sans-serif] text-white ${
            !valid || busy ? 'bg-neutral-300 cursor-not-allowed' : 'bg-[#426b1f]'
          }`}
        >
          {busy ? 'Adding…' : 'Add product'}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  'w-full border border-neutral-200 rounded-lg px-3 py-2 text-[14px] font-[\'Inter:Regular\',_sans-serif]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[12px] font-['Inter:Regular',_sans-serif] text-[#757575]">{label}</p>
      {children}
    </div>
  );
}
