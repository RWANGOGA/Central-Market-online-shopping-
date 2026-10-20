import { triggerUnauthorized } from './apiAuth';

const API_BASE = '/api';

export interface CustomerProfile {
  id: number;
  fullName: string;
  phone: string;
  email?: string;
  region: string;
  district?: string;
  subCounty?: string;
  parish?: string;
  village?: string;
  address: string;
  createdAt: string;
  orderCount: number;
  lastOrderAt?: string;
}

export interface CustomerOrder {
  id: number;
  reference: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  region?: string;
  district?: string;
  shippingAddress?: {
    fullName: string;
    phone: string;
    address: string;
    region: string;
    district?: string;
    subCounty?: string;
    parish?: string;
    village?: string;
  };
  items: {
    id: number;
    productId: number;
    name: string;
    priceValue: number;
    quantity: number;
    lineTotal: number;
  }[];
  timeline: {
    id: number;
    fromStatus?: string;
    toStatus: string;
    note?: string;
    changedByEmail?: string;
    createdAt: string;
  }[];
  payments: {
    id: number;
    reference: string;
    status: string;
    amount: number;
    channel: string;
    provider: string;
    createdAt: string;
  }[];
}

export interface CustomerOrdersResult {
  data: CustomerOrder[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    returned: number;
  };
}

export interface CustomerPreferences {
  customerId: number;
  preferences: Record<string, unknown>;
}

export interface CustomerNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface CustomerNotificationsResult {
  data: CustomerNotification[];
  meta: {
    total: number;
    unread: number;
  };
}

function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  }).then(async (res) => {
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (res.status === 401) triggerUnauthorized();
    if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
    return data as T;
  });
}

export async function fetchCustomerProfile(): Promise<CustomerProfile> {
  const data = await request<{ data: CustomerProfile }>('/customers/me');
  return data.data;
}

export async function updateCustomerProfile(updates: Partial<CustomerProfile>): Promise<CustomerProfile> {
  const data = await request<{ data: CustomerProfile }>('/customers/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return data.data;
}

export async function fetchCustomerOrders(params?: { limit?: number; offset?: number }): Promise<CustomerOrdersResult> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const qs = searchParams.toString();
  const data = await request<{ data: CustomerOrdersResult }>(`/customers/me/orders${qs ? `?${qs}` : ''}`);
  return data.data;
}

export async function loginCustomer(phone: string, password: string): Promise<CustomerProfile> {
  const data = await request<{ data: CustomerProfile }>('/customers/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });
  return data.data;
}

export async function signupCustomer(data: {
  fullName: string;
  phone: string;
  password: string;
  region: string;
  district?: string;
  address: string;
}): Promise<{ message: string }> {
  const result = await request<{ data: { message: string } }>('/customers/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function logoutCustomer(): Promise<void> {
  await request('/customers/session', { method: 'POST' });
}

export async function createOrder(
  cartId: number,
  shipping?: {
    fullName: string;
    phone: string;
    region: string;
    district?: string;
    subCounty?: string;
    parish?: string;
    village?: string;
    address: string;
  },
): Promise<{ reference: string }> {
  const data = await request<{ data: { reference: string } }>('/orders', {
    method: 'POST',
    body: JSON.stringify({ cartId, ...(shipping ? { shipping } : {}) }),
  });
  return data.data;
}

export async function fetchCustomerPreferences(): Promise<CustomerPreferences> {
  const data = await request<{ data: CustomerPreferences }>('/customers/preferences');
  return data.data;
}

export async function updateCustomerPreferences(preferences: Record<string, unknown>): Promise<CustomerPreferences> {
  const data = await request<{ data: CustomerPreferences }>('/customers/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ preferences }),
  });
  return data.data;
}

export async function fetchCustomerNotifications(params?: { unreadOnly?: boolean; limit?: number }): Promise<CustomerNotificationsResult> {
  const searchParams = new URLSearchParams();
  if (params?.unreadOnly) searchParams.set('unreadOnly', 'true');
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();
  const data = await request<{ data: CustomerNotificationsResult }>(`/customers/notifications${qs ? `?${qs}` : ''}`);
  return data.data;
}
