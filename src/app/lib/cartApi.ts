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

    if (!response.ok) return null;

    const body = (await response.json()) as { data: T };
    return body.data;
  } catch {
    // Backend not running, or the request failed. Fall back to local state.
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
  return request<ApiCart>('/cart/items', {
    method: 'POST',
    body: JSON.stringify({ cartId, productId, quantity }),
  });
}

export async function updateItem(
  cartId: number,
  productId: number,
  quantity: number,
): Promise<ApiCart | null> {
  return request<ApiCart>('/cart', {
    method: 'PATCH',
    body: JSON.stringify({ cartId, productId, quantity }),
  });
}

/**
 * Empties the cart on the server by removing each line, then starts a fresh
 * one. Used after a completed purchase.
 */
export async function resetCart(cartId: number): Promise<number | null> {
  const cart = await fetchCart(cartId);

  if (cart) {
    await Promise.all(
      cart.items.map((item) => updateItem(cartId, item.productId, 0)),
    );
  }

  forgetCartId();
  const created = await createCart();
  return created ? created.id : null;
}