import { triggerUnauthorized } from './apiAuth';

/**
 * Client for the cart endpoints in api/.
 *
 * Every call returns null instead of throwing when the API is unreachable, so
 * the app keeps working as a purely local cart when the backend is not
 * running. Callers treat null as "not synced" and carry on.
 */

export type ApiCartItem = {
  productId: number;
  quantity: number;
  name: string;
  priceLabel: string;
  priceValue: number;
};

export type ApiCart = {
  id: number;
  items: ApiCartItem[];
  itemCount: number;
  subtotal: number;
};

/**
 * A cart write that reached the server and was refused.
 *
 * Network failures return null and the caller keeps its optimistic state (the
 * app is designed to work with no backend). A refusal is different: the
 * server's cart is the truth, so the caller must roll its optimistic edit
 * back.
 */
export class CartError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CartError';
  }
}

const CART_ID_KEY = 'mu-katale.cartId';

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(`/api${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      if (response.status === 401) triggerUnauthorized();
      return null;
    }

    const body = (await response.json()) as { data: T };
    return body.data;
  } catch {
    // Backend not running, or the request failed. Fall back to local state.
    return null;
  }
}

/**
 * A cart write: null means the server could not be reached, a CartError means
 * it answered and refused.
 */
async function mutate<T>(path: string, init: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });

    if (!response.ok) {
      if (response.status === 401) triggerUnauthorized();
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new CartError(response.status, body?.error ?? `Request failed (${response.status})`);
    }

    const body = (await response.json()) as { data: T };
    return body.data;
  } catch (err) {
    if (err instanceof CartError) throw err;
    // Backend not running. The local cart stays authoritative.
    return null;
  }
}

export function readStoredCartId(): number | null {
  try {
    const raw = window.localStorage.getItem(CART_ID_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function storeCartId(cartId: number) {
  try {
    window.localStorage.setItem(CART_ID_KEY, String(cartId));
  } catch {
    // Private browsing or storage disabled. The cart still works for this
    // session, it just will not be remembered.
  }
}

export function forgetCartId() {
  try {
    window.localStorage.removeItem(CART_ID_KEY);
  } catch {
    // Nothing to do.
  }
}

export async function fetchCart(cartId: number): Promise<ApiCart | null> {
  return request<ApiCart>(`/cart?cartId=${cartId}`);
}

export async function createCart(): Promise<ApiCart | null> {
  const cart = await request<ApiCart>('/cart', { method: 'POST', body: '{}' });
  if (cart) storeCartId(cart.id);
  return cart;
}

/**
 * Returns the cart id to keep using. If the stored cart no longer exists on
 * the server (dropped database, reset), a new one is created in its place.
 */
export async function resolveCartId(): Promise<number | null> {
  const stored = readStoredCartId();

  if (stored) {
    const existing = await fetchCart(stored);
    if (existing) return stored;
    forgetCartId();
  }

  const created = await createCart();
  return created ? created.id : null;
}

export async function addItem(
  cartId: number,
  productId: number,
  quantity: number,
): Promise<ApiCart | null> {
  return mutate<ApiCart>('/cart/items', {
    method: 'POST',
    body: JSON.stringify({ cartId, productId, quantity }),
  });
}

export async function updateItem(
  cartId: number,
  productId: number,
  quantity: number,
): Promise<ApiCart | null> {
  return mutate<ApiCart>('/cart', {
    method: 'PATCH',
    body: JSON.stringify({ cartId, productId, quantity }),
  });
}

/**
 * Starts a new, empty server cart.
 *
 * Used after a completed purchase. The old cart is `converted` on the server
 * and is deliberately not touched again: clearing its lines would be a write
 * to a cart that has already become an order.
 */
export async function startFreshCart(): Promise<number | null> {
  forgetCartId();
  const created = await createCart();
  return created ? created.id : null;
}
