// Surface Studio engine — public API.
export { render, planVariations, RECIPES, renderSurfaceThumb, clearCaches, cacheStats, applyMood } from './compose.js';
export { SURFACES, CATEGORIES, getSurface, registerSurface } from './surfaces/index.js';
export { TREATMENTS, TREATMENT_MAP, defaultInk, allFontFamilies, googleFontsUrls } from './treatments.js';
export { layoutText, tokenize, wrap, reconstruct, verifyLayout, findEmphasis, wordCount } from './layout.js';
export { computeLayout, renderTypography, fontString, makeMeasurer } from './typography.js';
export { applyMaterial, MATERIAL_DEFAULTS } from './material.js';
export { ENVIRONMENTS, renderEnvironment } from './env.js';
export { interpretPrompt, imagePromptFor, registerProvider, listProviders, getProvider } from './prompt.js';
export { setCanvasFactory, makeRng, hashString } from './util.js';

/** Wait until every font a treatment needs is loaded (browser only). */
export async function loadFonts(families, sizes = [40]) {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(families.map((f) => Promise.all(sizes.map((s) => document.fonts.load(`${f.weight || 400} ${s}px "${f.family}"`).catch(() => null)))));
}
