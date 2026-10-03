const BASE = '/api/admin';

/**
 * Client for the staff endpoints. The session lives in an HttpOnly cookie the
 * browser attaches on its own, so there is no token for this code to hold or
 * leak. Every call sets credentials: 'include' because the API may sit on
 * another origin in production.
 */

export type AdminIdentity = {
  id: number;
  email: string;
  name: string;
  role: 'owner' | 'manager';
};

export type AdminProduct = {
  id: number;
  slug: string;
  name: string;
  description: string;
  farm: string;
  location: string;
  priceValue: number;
  price: string;
  currency: string;
  unit: string;
  stock: number;
  stockState: string;
  remaining: string;
  dietary: string[];
  images: string[];
  active: boolean;
  createdAt: string;
};

export type ProductDraft = {
  name: string;
  slug?: string;
  description: string;
  farm: string;
  location: string;
  priceValue: number;
  unit: string;
  stock: number;
  dietary: string[];
  imageDataUrl?: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number } | null;

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });

    if (response.status === 401) return { ok: false, error: 'Session expired.', status: 401 };

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        (body as { error?: string } | null)?.error ?? `Request failed (${response.status})`;
      return { ok: false, error, status: response.status };
    }

    return { ok: true, data: (body as { data: T }).data };
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<Result<AdminIdentity>> {
  const result = await call<{ admin: AdminIdentity }>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!result) return null;
  if (!result.ok) return result;
  return { ok: true, data: result.data.admin };
}

export async function signOut(): Promise<void> {
  await call('/logout', { method: 'POST' });
}

/** Null means "not signed in", which is different from "the check failed". */
export async function currentAdmin(): Promise<AdminIdentity | null | undefined> {
  try {
    const response = await fetch(`${BASE}/me`, { credentials: 'include' });
    if (response.status === 401) return null;
    if (!response.ok) return undefined;
    const body = (await response.json()) as { data: AdminIdentity };
    return body.data;
  } catch {
    return undefined;
  }
}

export async function listAdminProducts(): Promise<Result<AdminProduct[]>> {
  return call<AdminProduct[]>('/products');
}

export async function createProduct(draft: ProductDraft): Promise<Result<AdminProduct>> {
  return call<AdminProduct>('/products', { method: 'POST', body: JSON.stringify(draft) });
}

export async function updateProduct(
  id: number | string,
  changes: Partial<ProductDraft> & { active?: boolean },
): Promise<Result<AdminProduct>> {
  return call<AdminProduct>(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

/** Withdraws rather than deletes, so past orders keep referring to the row. */
export async function withdrawProduct(id: number | string): Promise<Result<AdminProduct>> {
  return call<AdminProduct>(`/products/${id}`, { method: 'DELETE' });
}

/** Read a picked file into a data URL for the API to store. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsDataURL(file);
  });
}
