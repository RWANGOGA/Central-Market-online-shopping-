import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { carts } from '@/db/schema';
import { hashToken, readCookie } from '@/lib/customerAuth';

export async function requireCart(request: Request, cartId: number) {
  const token = readCookie(request.headers.get('cookie'), 'mk_cart');
  if (!token) return null;
  return db.query.carts.findFirst({
    where: and(eq(carts.id, cartId), eq(carts.ownerTokenHash, hashToken(token))),
  });
}
