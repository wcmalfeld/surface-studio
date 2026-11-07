import { enabledProviders } from '@/lib/providers';
import { json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Image providers that have keys configured (names only — never keys). */
export async function GET() {
  return json({ providers: enabledProviders().map((p) => ({ id: p.id, name: p.name })) });
}
