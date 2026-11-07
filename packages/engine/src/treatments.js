// Writing treatments: how the words are physically made (pen, chalk, paint...).
// Each treatment carries its fonts, its glyph "hand" (jitter) and the default
// material it produces. Add a treatment by appending to TREATMENTS.

export const TREATMENTS = [
  {
    id: 'handwritten', name: 'Handwritten', blurb: 'Natural handwriting',
    fonts: [
      { family: 'Caveat', weight: 500, sizeAdj: 1.3 },
      { family: 'Kalam', weight: 400, sizeAdj: 1.0 },
      { family: 'Nanum Pen Script', weight: 400, sizeAdj: 1.45 },
      { family: 'Reenie Beanie', weight: 400, sizeAdj: 1.5 },
      { family: 'Homemade Apple', weight: 400, sizeAdj: 0.8, script: true },
    ],
    hand: { rot: 0.035, base: 0.05, scale: 0.05, slope: 0.012, wobble: 0.04, perChar: true },
    lineHeight: 1.2, material: 'pen', emphasis: 'underline',
  },
  {
    id: 'finepen', name: 'Fine pen', blurb: 'Thin ink strokes',
    fonts: [
      { family: 'Nothing You Could Do', weight: 400, sizeAdj: 0.85, script: true },
      { family: 'La Belle Aurore', weight: 400, sizeAdj: 0.95, script: true },
      { family: 'Dawning of a New Day', weight: 400, sizeAdj: 1.05, script: true },
      { family: 'Over the Rainbow', weight: 400, sizeAdj: 0.95 },
    ],
    hand: { rot: 0.02, base: 0.035, scale: 0.03, slope: 0.01, wobble: 0.03, perChar: false },
    lineHeight: 1.35, material: 'fineink', emphasis: 'underline',
  },
  {
    id: 'pencil', name: 'Pencil', blurb: 'Soft graphite',
    fonts: [
      { family: 'Shadows Into Light Two', weight: 400, sizeAdj: 1.1 },
      { family: 'Indie Flower', weight: 400, sizeAdj: 1.0 },
      { family: 'Caveat', weight: 400, sizeAdj: 1.3 },
    ],
    hand: { rot: 0.03, base: 0.05, scale: 0.04, slope: 0.012, wobble: 0.04, perChar: true },
    lineHeight: 1.25, material: 'pencil', emphasis: 'circle',
  },
  {
    id: 'marker', name: 'Marker', blurb: 'Thick marker lettering',
    fonts: [
      { family: 'Permanent Marker', weight: 400, sizeAdj: 0.95 },
      { family: 'Kalam', weight: 700, sizeAdj: 1.0 },
      { family: 'Gochi Hand', weight: 400, sizeAdj: 1.1 },
      { family: 'Rock Salt', weight: 400, sizeAdj: 0.7 },
    ],
    hand: { rot: 0.03, base: 0.04, scale: 0.04, slope: 0.01, wobble: 0.03, perChar: true },
    lineHeight: 1.18, material: 'marker', emphasis: 'highlight',
  },
  {
    id: 'chalk', name: 'Chalk', blurb: 'Dusty chalk texture',
    fonts: [
      { family: 'Gochi Hand', weight: 400, sizeAdj: 1.1 },
      { family: 'Schoolbell', weight: 400, sizeAdj: 1.0 },
      { family: 'Patrick Hand', weight: 400, sizeAdj: 1.1 },
      { family: 'Cabin Sketch', weight: 700, sizeAdj: 0.95 },
    ],
    hand: { rot: 0.03, base: 0.04, scale: 0.04, slope: 0.01, wobble: 0.03, perChar: true },
    lineHeight: 1.2, material: 'chalk', emphasis: 'underline',
  },
  {
    id: 'paint', name: 'Paint', blurb: 'Brushed lettering, natural edges',
    fonts: [
      { family: 'Bebas Neue', weight: 400, sizeAdj: 1.15 },
      { family: 'Anton', weight: 400, sizeAdj: 0.95 },
      { family: 'Caveat Brush', weight: 400, sizeAdj: 1.25 },
      { family: 'Alfa Slab One', weight: 400, sizeAdj: 0.85 },
    ],
    hand: { rot: 0.012, base: 0.02, scale: 0.02, slope: 0.004, wobble: 0.015, perChar: true },
    lineHeight: 1.05, material: 'paint', emphasis: 'color',
  },
  {
    id: 'spray', name: 'Spray paint', blurb: 'Street-art spray',
    fonts: [
      { family: 'Sedgwick Ave Display', weight: 400, sizeAdj: 1.1 },
      { family: 'Permanent Marker', weight: 400, sizeAdj: 1.0 },
      { family: 'Rubik Spray Paint', weight: 400, sizeAdj: 0.95 },
    ],
    hand: { rot: 0.05, base: 0.05, scale: 0.06, slope: 0.015, wobble: 0.04, perChar: true },
    lineHeight: 1.1, material: 'spray', emphasis: 'color',
  },
  {
    id: 'printed', name: 'Printed', blurb: 'Clean editorial type',
    fonts: [
      { family: 'Fraunces', weight: 500, sizeAdj: 1.0 },
      { family: 'Libre Caslon Text', weight: 400, sizeAdj: 1.0 },
      { family: 'Archivo Narrow', weight: 600, sizeAdj: 1.05 },
      { family: 'Overpass', weight: 700, sizeAdj: 1.0 },
    ],
    hand: null, lineHeight: 1.22, material: 'print', emphasis: 'color',
  },
  {
    id: 'typewriter', name: 'Typewriter', blurb: 'Vintage monospaced text',
    fonts: [
      { family: 'Special Elite', weight: 400, sizeAdj: 1.0 },
      { family: 'Courier Prime', weight: 400, sizeAdj: 1.0 },
      { family: 'Cutive Mono', weight: 400, sizeAdj: 1.0 },
    ],
    hand: { rot: 0.008, base: 0.03, scale: 0, slope: 0, wobble: 0, perChar: true, strike: true },
    lineHeight: 1.45, material: 'type', emphasis: 'underline',
  },
  {
    id: 'impressed', name: 'Finger-drawn', blurb: 'Traced into fog, sand, snow or dust',
    fonts: [
      { family: 'Gochi Hand', weight: 400, sizeAdj: 1.1 },
      { family: 'Caveat', weight: 700, sizeAdj: 1.3 },
      { family: 'Permanent Marker', weight: 400, sizeAdj: 0.95 },
    ],
    hand: { rot: 0.04, base: 0.05, scale: 0.05, slope: 0.015, wobble: 0.04, perChar: true },
    lineHeight: 1.15, material: 'impress', emphasis: 'underline',
  },
];

export const TREATMENT_MAP = Object.fromEntries(TREATMENTS.map((t) => [t.id, t]));

/** Default ink color for a treatment on a surface (surface may override). */
export function defaultInk(treatmentId, surface) {
  const o = surface?.ink?.[treatmentId] || surface?.ink?.default;
  if (o) return o;
  const dark = surface?.tone === 'dark';
  switch (treatmentId) {
    case 'chalk': return dark ? '#f1efe6' : '#ffffff';
    case 'pencil': return dark ? '#d8d8d8' : '#3d3d3f';
    case 'handwritten':
    case 'finepen': return dark ? '#f3efe4' : '#1c2754';
    case 'marker': return dark ? '#f6f4ee' : '#141414';
    case 'paint': return dark ? '#f4f0e6' : '#191919';
    case 'spray': return dark ? '#ff5a3c' : '#e23d2b';
    case 'printed': return dark ? '#f1ede3' : '#161616';
    case 'typewriter': return dark ? '#efe9db' : '#24201c';
    case 'impressed': return dark ? '#ffffff' : '#000000';
    default: return dark ? '#ffffff' : '#111111';
  }
}

/** Every font family the app may need, for preloading. */
export function allFontFamilies() {
  const seen = new Map();
  for (const t of TREATMENTS) for (const f of t.fonts) seen.set(`${f.family}|${f.weight}`, f);
  return [...seen.values()];
}

/**
 * Google Fonts stylesheet URLs covering every treatment font. Split into
 * small batches so one unavailable family can't break the rest.
 */
export function googleFontsUrls(batch = 6) {
  const byFam = new Map();
  for (const f of allFontFamilies()) {
    if (!byFam.has(f.family)) byFam.set(f.family, new Set());
    byFam.get(f.family).add(f.weight);
  }
  const parts = [...byFam.entries()].map(([fam, ws]) => {
    const name = fam.replace(/ /g, '+');
    const weights = [...ws].sort((a, b) => a - b);
    if (weights.length === 1 && weights[0] === 400) return `family=${name}`;
    return `family=${name}:wght@${weights.join(';')}`;
  });
  const urls = [];
  for (let i = 0; i < parts.length; i += batch) urls.push(`https://fonts.googleapis.com/css2?${parts.slice(i, i + batch).join('&')}&display=swap`);
  return urls;
}
