import { getItem, putItem, deleteItem, isKind } from '@/lib/db';
import { ownerId } from '@/lib/owner';
import { json, fail, readJson, HttpError } from '@/lib/http';

export const runtime = 'nodejs';
const MAX_BYTES = 6 * 1024 * 1024; // a project may carry one downscaled photo
const ID = /^[a-zA-Z0-9_-]{1,80}$/;

type Ctx = { params: Promise<{ kind: string; id: string }> };

async function guard(ctx: Ctx) {
  const { kind, id } = await ctx.params;
  if (!isKind(kind)) throw new HttpError(404, 'Unknown collection.');
  if (!ID.test(id)) throw new HttpError(400, 'Invalid id.');
  const owner = await ownerId();
  if (!owner) throw new HttpError(401, 'Reload the page to start a session.');
  return { kind, id, owner };
}

const handle = (fn: (ctx: Ctx, req: Request) => Promise<Response>) => async (req: Request, ctx: Ctx) => {
  try { return await fn(ctx, req); }
  catch (e) { if (e instanceof HttpError) return fail(e.status, e.message); console.error(e); return fail(500, 'Something went wrong saving your work.'); }
};

export const GET = handle(async (ctx) => {
  const { kind, id, owner } = await guard(ctx);
  const item = getItem(owner, kind, id);
  return item ? json({ item }) : fail(404, 'Not found.');
});

export const PUT = handle(async (ctx, req) => {
  const { kind, id, owner } = await guard(ctx);
  const body = (await readJson(req, MAX_BYTES)) as Record<string, unknown>;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Expected an object.');
  if (body.id !== id) throw new HttpError(400, 'The id in the body must match the URL.');
  if (kind === 'projects' && typeof body.text !== 'string') throw new HttpError(400, 'A project needs its text.');
  const item = { ...body, updatedAt: Date.now() };
  putItem(owner, kind, id, item);
  return json({ item });
});

export const DELETE = handle(async (ctx) => {
  const { kind, id, owner } = await guard(ctx);
  deleteItem(owner, kind, id);
  return json({ ok: true });
});
