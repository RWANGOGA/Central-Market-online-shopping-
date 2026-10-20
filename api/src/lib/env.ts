import { z } from 'zod';

export const env = z
  .object({
    DATABASE_URL: z.string().url(),
    PAYMENT_WEBHOOK_SECRET: z.string().min(1),
    UPLOAD_DIR: z.string().min(1),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    TRUST_PROXY: z.enum(['true', 'false']).default('false'),
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z.string().min(8).optional(),
  })
  .parse(process.env);
