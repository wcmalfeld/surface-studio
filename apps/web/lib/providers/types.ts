export interface SceneRequest { prompt: string; width: number; height: number }
export interface ImageScene { type: 'image'; image: string; summary: string; quad?: [number, number][] }
export interface ImageProvider {
  id: string;
  name: string;
  enabled(): boolean;
  generate(req: SceneRequest): Promise<ImageScene>;
}

/** Pick the closest supported aspect ratio label. */
export function nearestAspect(width: number, height: number, options: string[]): string {
  const target = width / height;
  let best = options[0], diff = Infinity;
  for (const o of options) {
    const [a, b] = o.split(':').map(Number);
    const d = Math.abs(Math.log(a / b / target));
    if (d < diff) { diff = d; best = o; }
  }
  return best;
}

export async function urlToDataUrl(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not download the generated image (${r.status}).`);
  const type = r.headers.get('content-type') || 'image/png';
  const buf = Buffer.from(await r.arrayBuffer());
  return `data:${type};base64,${buf.toString('base64')}`;
}

export class ProviderError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function providerFetch(url: string, init: RequestInit, label: string, timeoutMs = 90_000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = body?.error?.message || body?.detail || body?.error || r.statusText;
      throw new ProviderError(r.status === 429 ? 429 : 502, `${label}: ${typeof msg === 'string' ? msg : 'request failed'}`);
    }
    return body;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new ProviderError(504, `${label} took too long. Try again.`);
    throw e;
  } finally { clearTimeout(t); }
}
