import { imagePromptFor, interpretPrompt } from '@surface-studio/engine';
import { findProvider } from '@/lib/providers';
import { ProviderError } from '@/lib/providers/types';
import { ownerId } from '@/lib/owner';
import { json, fail, readJson, rateLimit, HttpError } from '@/lib/http';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST { provider, prompt, width, height }
 *  provider "procedural" → { type: 'procedural', surfaceId, mood, ... }
 *  image providers       → { type: 'image', image: dataURL, summary }
 * Image models are asked for a blank surface; the user's words are never sent.
 */
export async function POST(req: Request) {
  try {
    const owner = await ownerId();
    if (!owner) return fail(401, 'Reload the page to start a session.');
    const body = (await readJson(req, 20_000)) as { provider?: string; prompt?: string; width?: number; height?: number };
    const prompt = String(body.prompt || '').trim().slice(0, 600);
    if (!prompt) return fail(400, 'Describe the scene you want.');
    const width = Math.max(256, Math.min(4096, Number(body.width) || 1080));
    const height = Math.max(256, Math.min(4096, Number(body.height) || 1350));
    if (!body.provider || body.provider === 'procedural') return json({ type: 'procedural', ...interpretPrompt(prompt) });
    const provider = findProvider(body.provider);
    if (!provider) return fail(400, 'That scene source is not configured on this server.');
    if (!rateLimit(`scene:${owner}`, Number(process.env.SCENE_RATE_LIMIT || 8))) return fail(429, 'You are generating scenes quickly. Wait a minute and try again.');
    const scene = await provider.generate({ prompt: imagePromptFor(prompt), width, height });
    return json({ ...scene, summary: `${scene.summary}: “${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}”` });
  } catch (e) {
    if (e instanceof HttpError || e instanceof ProviderError) return fail(e.status, e.message);
    console.error(e);
    return fail(500, 'Scene generation failed.');
  }
}
