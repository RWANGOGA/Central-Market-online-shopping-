import type { Product } from '@/db/schema';

export type ProductDto = {
  id: number;
  slug: string;
  name: string;
  description: string;
  farm: string;
  location: string;
  priceValue: number;
  price: string;
  unit: string;
  images: string[];
  dietary: string[];
  stock: number;
  active: boolean;
};

/**
 * Products store bare asset filenames because the catalogue lives in the
 * database now. The frontend still needs URLs, so map them here.
 */
export function toProductDto(row: Product): ProductDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    farm: row.farm,
    location: row.location,
    priceValue: row.priceValue,
    price: row.priceLabel,
    unit: row.unit,
    images: row.imageFiles.map((file) => `/api/assets/${file}`),
    dietary: row.dietary,
    stock: row.stock,
    active: row.active,
  };
}

export function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
}

export function error(message: string, status = 400) {
  return json({ error: message }, { status });
}

/**
 * Number(null) is 0, so a bare isInteger check would let a missing query
 * parameter through. Require a real positive integer.
 */
export function parsePositiveInt(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}