import { z } from 'zod';
import { authenticate } from '@/lib/adminAuth';

/**
 * Shared pieces of the catalogue editor. Kept out of the route files because
 * Next.js only permits HTTP method exports there.
 */

export const productInputSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens, e.g. green-pepper')
    .optional(),
  description: z.string().min(10).max(2000),
  farm: z.string().min(2).max(120),
  location: z.string().min(2).max(200),
  priceValue: z.number().int().min(1).max(100_000_000),
  unit: z.enum(['kg', 'each', 'pint', 'bunch', 'crate']),
  stock: z.number().int().min(0).max(1_000_000).default(0),
  dietary: z.array(z.string().max(12)).max(8).default([]),
  /** Base64 data URL. Stored under uploads/ and served from /api/assets. */
  imageDataUrl: z.string().max(8_000_000).optional(),
});

export const productUpdateSchema = productInputSchema.partial().extend({
  active: z.boolean().optional(),
});

export const UNITS = ['kg', 'each', 'pint', 'bunch', 'crate'] as const;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Whole shillings, matching how the seeded rows are written. */
export function priceLabelFor(priceValue: number, unit: string): string {
  const amount = priceValue.toLocaleString('en-US');
  // "each" reads with a space, the rest with a solidus.
  return unit === 'each' ? `USh ${amount} each` : `USh ${amount}/${unit}`;
}

export async function requireAdmin(request: Request) {
  return authenticate(request);
}
