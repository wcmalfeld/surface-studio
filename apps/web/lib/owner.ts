// Identifies the visitor. Without an auth system each browser gets a random,
// HTTP-only cookie id (set in middleware.ts). Replace ownerId() with your auth
// provider's user id to sync projects across devices.
import { cookies } from 'next/headers';

export const OWNER_COOKIE = 'ss_uid';
const VALID = /^[a-zA-Z0-9_-]{16,64}$/;

export async function ownerId(): Promise<string | null> {
  const v = (await cookies()).get(OWNER_COOKIE)?.value;
  return v && VALID.test(v) ? v : null;
}
