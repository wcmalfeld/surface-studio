import { ImageProvider, nearestAspect, providerFetch, ProviderError } from './types';

export const gemini: ImageProvider = {
  id: 'gemini',
  name: 'Google Imagen',
  enabled: () => !!process.env.GEMINI_API_KEY,
  async generate({ prompt, width, height }) {
    const model = process.env.GEMINI_IMAGE_MODEL || 'imagen-4.0-generate-001';
    const aspectRatio = nearestAspect(width, height, ['1:1', '3:4', '4:3', '9:16', '16:9']);
    const body = await providerFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predict`, {
      method: 'POST',
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY as string, 'content-type': 'application/json' },
      body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio } }),
    }, 'Google Imagen');
    const p = body?.predictions?.[0];
    if (!p?.bytesBase64Encoded) throw new ProviderError(502, 'Google Imagen returned no image (the prompt may have been filtered).');
    return { type: 'image', image: `data:${p.mimeType || 'image/png'};base64,${p.bytesBase64Encoded}`, summary: 'Generated with Google Imagen' };
  },
};
