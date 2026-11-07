import { NextResponse } from 'next/server';

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
export const fail = (status: number, error: string) => json({ error }, status);

/** Read a JSON body with a hard size cap (route handlers have no default limit). */
export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > maxBytes) throw new HttpError(413, 'That project is too large to save. Try a smaller photo.');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'That project is too large to save. Try a smaller photo.');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'The request body is not valid JSON.'); }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const buckets = new Map<string, number[]>();
/** Sliding-window limiter (per process). Use Redis or your edge provider in multi-instance deployments. */
export function rateLimit(key: string, perMinute: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < 60_000);
  if (hits.length >= perMinute) { buckets.set(key, hits); return false; }
  hits.push(now); buckets.set(key, hits);
  return true;
}
