import { ImageProvider, nearestAspect, providerFetch, ProviderError, urlToDataUrl } from './types';

export const replicate: ImageProvider = {
  id: 'replicate',
  name: 'Replicate (Flux)',
  enabled: () => !!process.env.REPLICATE_API_TOKEN,
  async generate({ prompt, width, height }) {
    const model = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell';
    const aspect_ratio = nearestAspect(width, height, ['1:1', '4:5', '2:3', '3:4', '9:16', '16:9', '3:2', '4:3', '5:4']);
    let pred = await providerFetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'content-type': 'application/json', prefer: 'wait=60' },
      body: JSON.stringify({ input: { prompt, aspect_ratio, output_format: 'png' } }),
    }, 'Replicate');
    // poll if the synchronous wait ran out
    for (let i = 0; i < 30 && pred && !['succeeded', 'failed', 'canceled'].includes(pred.status); i++) {
      await new Promise((r) => setTimeout(r, 2000));
      pred = await providerFetch(pred.urls.get, { headers: { authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` } }, 'Replicate');
    }
    if (pred?.status !== 'succeeded') throw new ProviderError(502, `Replicate: ${pred?.error || 'generation did not finish'}`);
    const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (!url) throw new ProviderError(502, 'Replicate returned no image.');
    // inline it so the browser canvas is never tainted by a cross-origin image
    return { type: 'image', image: await urlToDataUrl(url), summary: 'Generated with Replicate' };
  },
};
