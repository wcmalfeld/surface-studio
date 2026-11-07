// Scene prompts and image providers.
//
// A provider turns a free-text scene description into a ScenePlan. The
// built-in "procedural" provider maps the description onto the surface
// library plus mood and color modifiers. Image providers (OpenAI, Gemini,
// Replicate, ...) return a photograph instead; the user's words are always
// composited on top by the engine, never drawn by the model.
import { SURFACES } from './surfaces/index.js';
import { TREATMENT_MAP } from './treatments.js';

const MOODS = [
  ['night', ['night', 'midnight', 'dark', 'moon', 'nocturnal', 'after hours']],
  ['dusk', ['dusk', 'sunset', 'twilight', 'evening']],
  ['golden', ['golden hour', 'sunrise', 'morning sun', 'warm light', 'sunlit', 'sunny']],
  ['overcast', ['overcast', 'grey day', 'gray day', 'cloudy', 'muted']],
  ['vintage', ['vintage', 'retro', '1970s', '70s', 'old-fashioned', 'faded', 'nostalgic']],
  ['cold', ['cold', 'icy', 'winter', 'blue hour', 'cool tones']],
  ['neon', ['neon', 'cyberpunk', 'club', 'arcade']],
  ['rain', ['rain', 'rainy', 'wet', 'storm', 'drizzle']],
];

const COLORS = {
  red: '#c0392b', crimson: '#a4161a', orange: '#e67e22', yellow: '#f1c40f', mustard: '#d4a017', green: '#2e7d4f', olive: '#6b7a3a', teal: '#1f7a7a',
  turquoise: '#2bb3a8', blue: '#2a5d9f', navy: '#1f2e46', purple: '#6a3d9a', lavender: '#b9a7d9', pink: '#e86a92', black: '#1a1a1a', white: '#f5f3ee',
  cream: '#efe6d2', beige: '#d9c7a8', brown: '#7a5233', grey: '#8b8f93', gray: '#8b8f93', gold: '#c9a640', terracotta: '#c96a45',
};

const TREATMENT_WORDS = [
  ['chalk', ['chalk']], ['spray', ['spray', 'graffiti', 'spray paint', 'tag']], ['paint', ['painted', 'paint', 'brush', 'mural']],
  ['marker', ['marker', 'sharpie', 'felt tip']], ['typewriter', ['typewriter', 'typed']], ['printed', ['printed', 'print', 'letterpress', 'headline']],
  ['finepen', ['fountain pen', 'fine pen', 'calligraphy', 'ink']], ['pencil', ['pencil', 'graphite']], ['impressed', ['finger', 'traced', 'drawn in', 'written in the']],
  ['handwritten', ['handwritten', 'handwriting', 'scrawled', 'scribbled', 'note']],
];

function scoreKeyword(text, kw) {
  const re = new RegExp(`(^|[^a-z])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?([^a-z]|$)`, 'i');
  return re.test(text) ? kw.split(' ').length * 2 + kw.length / 10 : 0;
}

/**
 * Interpret a scene description. Always returns a usable plan.
 * @returns {{surfaceId, treatmentId?, overrides, mood:{tags:string[], tint?}, confidence:number, matched:string[], summary:string}}
 */
export function interpretPrompt(prompt, { fallbackSurface = 'notebook' } = {}) {
  const text = ` ${String(prompt || '').toLowerCase()} `;
  let best = null, bestScore = 0;
  const matched = [];
  for (const s of SURFACES) {
    let sc = 0;
    for (const kw of [...s.keywords, s.name.toLowerCase()]) {
      const v = scoreKeyword(text, kw);
      if (v) { sc += v; }
    }
    if (sc > bestScore) { bestScore = sc; best = s; }
  }
  const surface = best || SURFACES.find((s) => s.id === fallbackSurface);
  if (best) matched.push(surface.name);

  const tags = [];
  for (const [tag, words] of MOODS) if (words.some((w) => scoreKeyword(text, w))) { tags.push(tag); matched.push(tag); }

  let treatmentId;
  for (const [id, words] of TREATMENT_WORDS) if (words.some((w) => scoreKeyword(text, w))) { treatmentId = id; break; }
  if (treatmentId && !surface.treatments.includes(treatmentId) && !['marker', 'paint', 'spray', 'handwritten', 'printed', 'typewriter'].includes(treatmentId)) treatmentId = undefined;
  if (treatmentId) matched.push(TREATMENT_MAP[treatmentId].name);

  // a color word right before the surface noun recolors it
  const overrides = {};
  const natural = { brick: ['red', 'brown'], chalkboard: ['black', 'green'], classroom: ['green'], sand: ['beige', 'gold'], snow: ['white'], whiteboard: ['white'], cardboard: ['brown'], paperbag: ['brown'], sticky: ['yellow'] };
  for (const [name, hex] of Object.entries(COLORS)) {
    if ((natural[surface.id] || []).includes(name)) continue;
    if (scoreKeyword(text, name)) {
      if (['brick'].includes(surface.id)) overrides.painted = hex;
      else if (surface.params && 'color' in surface.params) overrides.color = hex;
      else if (['concrete', 'painted', 'facade', 'warehouse', 'streetart', 'chalkboard', 'classroom', 'sticky', 'denim', 'fabric', 'bookcover', 'carpaint'].includes(surface.id)) overrides.color = hex;
      matched.push(name);
      break;
    }
  }
  if (surface.id === 'window' && !tags.includes('night') && /day|morning|afternoon|bright/.test(text)) overrides.night = false;

  const confidence = Math.min(1, bestScore / 6);
  const summary = `${surface.name}${treatmentId ? ', ' + TREATMENT_MAP[treatmentId].name.toLowerCase() : ''}${tags.length ? ', ' + tags.join(', ') : ''}${Object.keys(overrides).length ? ', recolored' : ''}`;
  return { surfaceId: surface.id, treatmentId, overrides, mood: { tags }, confidence, matched, summary };
}

/** Build the prompt sent to a photographic image model for a blank scene. */
export function imagePromptFor(description) {
  return [
    `Photograph: ${description}.`,
    'The writing surface is completely blank and empty, clearly visible, roughly facing the camera, lit naturally.',
    'No text, no letters, no words, no numbers, no signage, no logos, no watermarks anywhere in the image.',
    'Realistic photographic detail, shallow depth of field, editorial quality.',
  ].join(' ');
}

/** Provider registry. Image providers are registered by the host app. */
const providers = new Map();

export function registerProvider(p) { providers.set(p.id, p); return p; }
export function listProviders() { return [...providers.values()]; }
export function getProvider(id) { return providers.get(id); }

registerProvider({
  id: 'procedural',
  name: 'Built-in scenes',
  kind: 'procedural',
  async generate({ prompt, current }) {
    return { type: 'procedural', ...interpretPrompt(prompt, { fallbackSurface: current || 'notebook' }) };
  },
});
