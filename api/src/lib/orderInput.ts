import { z } from 'zod';

const ugandanPhone = z.string().trim().min(10).max(32)
  .transform((phone) => phone.replace(/[\s()-]/g, '').replace(/^\+?256/, '0'))
  .refine((phone) => /^07\d{8}$/.test(phone), 'Enter a valid Ugandan phone number.');

export const guestShippingSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: ugandanPhone,
  address: z.string().trim().min(3).max(500),
  region: z.string().trim().min(1).max(100),
  district: z.string().trim().max(100).optional(),
  subCounty: z.string().trim().max(100).optional(),
  parish: z.string().trim().max(100).optional(),
  village: z.string().trim().max(100).optional(),
}).strict();

export const createOrderSchema = z.object({
  cartId: z.number().int().positive(),
  shipping: guestShippingSchema.optional(),
}).strict();

export type GuestShipping = z.infer<typeof guestShippingSchema>;
