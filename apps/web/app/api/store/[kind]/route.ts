import { listItems, isKind } from '@/lib/db';
import { ownerId } from '@/lib/owner';
import { json, fail } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isKind(kind)) return fail(404, 'Unknown collection.');
  const owner = await ownerId();
  if (!owner) return fail(401, 'Reload the page to start a session.');
  return json({ items: listItems(owner, kind) });
}
