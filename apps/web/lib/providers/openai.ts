import { ImageProvider, nearestAspect, providerFetch, ProviderError } from './types';

const SIZES: Record<string, string> = { '1:1': '1024x1024', '2:3': '1024x1536', '3:2': '1536x1024' };

export const openai: ImageProvider = {
  id: 'openai',
  name: 'OpenAI images',
  enabled: () => !!process.env.OPENAI_API_KEY,
  async generate({ prompt, width, height }) {
    const size = SIZES[nearestAspect(width, height, Object.keys(SIZES))];
    const body = await providerFetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1', prompt, size, n: 1 }),
    }, 'OpenAI');
    const b64 = body?.data?.[0]?.b64_json;
    if (!b64) throw new ProviderError(502, 'OpenAI returned no image.');
    return { type: 'image', image: `data:image/png;base64,${b64}`, summary: 'Generated with OpenAI' };
  },
};
