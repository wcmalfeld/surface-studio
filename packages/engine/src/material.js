// Layer 3: Material integration. Turns the clean typography layer into ink,
// chalk, paint, spray... that interacts with the surface underneath.
import { createCanvas, ctx2d, cloneCanvas, blurCanvas, noiseField, makeRng, clamp, hexToRgb } from './util.js';

export const MATERIAL_DEFAULTS = {
  pen:     { opacity: 0.92, roughness: 0.08, grain: 0.12, bleed: 0.35, drips: 0, pressure: 0.25 },
  fineink: { opacity: 0.9,  roughness: 0.05, grain: 0.08, bleed: 0.2,  drips: 0, pressure: 0.2 },
  pencil:  { opacity: 0.78, roughness: 0.2,  grain: 0.55, bleed: 0.1,  drips: 0, pressure: 0.35 },
  marker:  { opacity: 0.94, roughness: 0.12, grain: 0.15, bleed: 0.25, drips: 0, pressure: 0.15, streak: 0.5 },
  chalk:   { opacity: 0.92, roughness: 0.3,  grain: 0.5,  bleed: 0.15, drips: 0, pressure: 0.3 },
  paint:   { opacity: 0.96, roughness: 0.35, grain: 0.35, bleed: 0.1,  drips: 0.25, pressure: 0.1 },
  spray:   { opacity: 0.95, roughness: 0.25, grain: 0.3,  bleed: 0.0,  drips: 0.45, pressure: 0.1, overspray: 0.6 },
  print:   { opacity: 0.95, roughness: 0.04, grain: 0.1,  bleed: 0.12, drips: 0, pressure: 0.05 },
  type:    { opacity: 0.9,  roughness: 0.18, grain: 0.3,  bleed: 0.2,  drips: 0, pressure: 0.2 },
  impress: { opacity: 1,    roughness: 0.25, grain: 0.2,  bleed: 0.4,  drips: 0, pressure: 0.1, depth: 0.7 },
};

/** Luminance detail of a surface (local lum minus local mean), for porosity. Cached by caller. */
export function surfaceDetail(base) {
  const w = base.width, h = base.height;
  const d = ctx2d(base).getImageData(0, 0, w, h).data;
  const blurred = ctx2d(blurCanvas(base, Math.max(4, w / 160))).getImageData(0, 0, w, h).data;
  const out = new Float32Array(w * h);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    const l = 0.3 * d[p] + 0.59 * d[p + 1] + 0.11 * d[p + 2];
    const m = 0.3 * blurred[p] + 0.59 * blurred[p + 1] + 0.11 * blurred[p + 2];
    out[i] = (l - m) / 255;
  }
  return out;
}

function alphaOf(canvas) {
  return ctx2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Apply a material to the typography layer.
 * @returns {{ink:HTMLCanvasElement, blend:string, behind?:HTMLCanvasElement, glow?:HTMLCanvasElement,
 *   emboss?:{dark:HTMLCanvasElement, light:HTMLCanvasElement}, wipe?:HTMLCanvasElement}}
 */
export function applyMaterial({ typo, kind, params = {}, surface, detail, seed = 1, fontSize = 40, ink = '#000000' }) {
  const P = { ...MATERIAL_DEFAULTS[kind], ...params };
  const intensity = params.intensity ?? 1;
  const w = typo.text.width, h = typo.text.height;
  const rng = makeRng(seed * 31 + 3);
  const dark = surface?.dark;
  const porous = (surface?.porous ?? 0) * intensity;

  let c = cloneCanvas(typo.text);
  if (typo.accent && !typo.accentBehind) ctx2d(c).drawImage(typo.accent, 0, 0);

  // --- bleed: ink spreading into fibres
  const bleed = (P.bleed + (surface?.bleed || 0)) * intensity;
  if (bleed > 0.02 && kind !== 'impress') {
    const r = Math.max(0.6, fontSize * 0.012 * bleed * 2);
    const soft = blurCanvas(c, r);
    const g = ctx2d(soft);
    g.globalAlpha = 1; g.drawImage(c, 0, 0);
    c = soft;
  }

  const img = ctx2d(c).getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;

  // structural noise fields scaled to the lettering size
  const coarse = noiseField(w, h, { scale: Math.max(6, fontSize * 0.5), octaves: 3, rng: rng.fork('c'), step: 3 });
  const needFine = P.grain * intensity > 0.02 || P.roughness * intensity > 0.02;
  const fine = needFine ? noiseField(w, h, { scale: kind === 'chalk' ? 2.2 : Math.max(1.6, fontSize * 0.04), octaves: 2, rng: rng.fork('f'), step: 1, stretchX: kind === 'chalk' ? 2.5 : kind === 'marker' ? 6 : 1 }) : null;
  let soft = null;
  if (P.roughness * intensity > 0.02 || kind === 'marker') {
    const a = new Uint8ClampedArray(n);
    for (let i = 0; i < n; i++) a[i] = d[i * 4 + 3];
    soft = blurAlpha(a, w, h, Math.max(1, fontSize * 0.025));
  }
  const streak = kind === 'marker' ? noiseField(w, h, { scale: Math.max(3, fontSize * 0.08), octaves: 2, rng: rng.fork('s'), step: 2, stretchX: 1, stretchY: 10 }) : null;

  const rough = P.roughness * intensity, grn = P.grain * intensity, press = P.pressure * intensity;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    let a = d[p + 3] / 255;
    if (a <= 0.003) continue;
    // pressure: slow variation in ink load
    a *= 1 - press * 0.6 * clamp((0.55 - coarse[i]) * 2.5, 0, 1);
    // rough edges: erode where the letter is thin/edge and noise says so
    if (soft) {
      const ab = soft[i] / 255;
      if (rough > 0.02) {
        const keep = clamp((ab - 0.25 + ((fine ? fine[i] : 0.5) - 0.5) * rough * 1.6) * 3.2 + 0.4, 0, 1);
        a *= keep;
      }
      if (kind === 'marker') {
        // pooled darker edges + streaky body
        const edge = clamp((1 - ab) * 2.2, 0, 1);
        const k = 1 - edge * 0.28 * intensity;
        d[p] *= k; d[p + 1] *= k; d[p + 2] *= k;
      }
    }
    if (streak) a *= 1 - (P.streak ?? 0.5) * 0.35 * intensity * clamp((streak[i] - 0.4) * 3, 0, 1);
    // grain: breakup by tooth of the surface
    if (fine && grn > 0.02) {
      if (kind === 'chalk' || kind === 'pencil') {
        const t = fine[i] + (coarse[i] - 0.5) * 0.3;
        const thr = 0.3 + grn * 0.28;
        a *= clamp((t - thr) * (kind === 'chalk' ? 7 : 4) + 0.55, 0, 1);
      } else {
        a *= 1 - grn * 0.45 * clamp((0.5 - fine[i]) * 3, 0, 1);
      }
    }
    // porous surfaces: paint skips the pits
    if (detail && porous > 0.02 && kind !== 'impress') {
      const dd = detail[i];
      if (dd < 0) a *= 1 - clamp(-dd * 6 * porous, 0, 0.9);
    }
    d[p + 3] = clamp(a, 0, 1) * 255;
  }
  ctx2d(c).putImageData(img, 0, 0);

  const out = { ink: c, blend: 'source-over', opacity: P.opacity };
  const lightOnDark = dark || ['chalk'].includes(kind);
  if (['pen', 'fineink', 'pencil', 'print', 'type'].includes(kind) && !lightOnDark) out.blend = 'multiply';
  if (kind === 'marker' && !dark && surface?.glossy !== true) out.blend = 'multiply';

  if (typo.accent && typo.accentBehind) out.behind = typo.accent;

  if (kind === 'chalk') {
    // chalk dust halo
    const dust = blurCanvas(c, Math.max(1.5, fontSize * 0.05));
    const dg = ctx2d(dust); dg.globalCompositeOperation = 'source-in'; dg.globalAlpha = 1;
    out.halo = dust; out.haloAlpha = 0.22 * intensity;
  }
  if (kind === 'spray') {
    const ov = (P.overspray ?? 0.6) * intensity;
    const halo = blurCanvas(typo.text, Math.max(2, fontSize * 0.07));
    const hg = ctx2d(halo);
    // speckled overspray dots near the strokes
    const wide = blurCanvas(typo.text, Math.max(3, fontSize * 0.14));
    const wd = ctx2d(wide).getImageData(0, 0, w, h).data;
    hg.fillStyle = ink;
    const dots = Math.round(n / 140 * ov);
    for (let k = 0; k < dots; k++) {
      const x = (rng() * w) | 0, y = (rng() * h) | 0;
      const a = wd[(y * w + x) * 4 + 3] / 255;
      if (a > 0.04 && rng() < a * 1.8) {
        hg.globalAlpha = rng.range(0.3, 0.9);
        hg.beginPath(); hg.arc(x, y, rng.range(0.4, 1.4) * Math.max(1, fontSize / 60), 0, 7); hg.fill();
      }
    }
    out.halo = halo; out.haloAlpha = 0.45 * ov;
  }
  if ((kind === 'paint' || kind === 'spray') && P.drips * intensity > 0.02) {
    out.ink = addDrips(c, ink, P.drips * intensity, fontSize, rng.fork('drip'));
  }
  if (surface?.emissive) {
    out.blend = 'screen';
    out.glow = blurCanvas(c, Math.max(3, fontSize * 0.18));
    out.glowAlpha = 0.8 * intensity;
  }
  if (kind === 'impress') {
    const depth = (P.depth ?? 0.7) * intensity * (surface?.impressDepth ?? 1);
    const mask = blurCanvas(c, Math.max(1, fontSize * 0.03));
    if (surface?.wipe) {
      out.wipe = mask; // reveal the clear layer through the fog/dust
      out.blend = 'wipe';
    } else {
      out.emboss = emboss(mask, fontSize, depth);
      out.blend = 'emboss';
    }
  }
  return out;
}

function blurAlpha(a, w, h, radius) {
  // separable box blur x2 on a single channel
  const r = Math.max(1, Math.round(radius));
  let src = Float32Array.from(a), tmp = new Float32Array(a.length);
  const pass = (s, t, horiz) => {
    const len = horiz ? w : h, lines = horiz ? h : w, stride = horiz ? 1 : w, inv = 1 / (2 * r + 1);
    for (let l = 0; l < lines; l++) {
      const base = horiz ? l * w : l;
      const at = (k) => s[base + (k < 0 ? 0 : k >= len ? len - 1 : k) * stride];
      let v = 0; for (let k = -r; k <= r; k++) v += at(k);
      for (let k = 0; k < len; k++) { t[base + k * stride] = v * inv; v += at(k + r + 1) - at(k - r); }
    }
  };
  for (let i = 0; i < 2; i++) { pass(src, tmp, true); pass(tmp, src, false); }
  return src;
}

function addDrips(c, ink, amount, size, rng) {
  const w = c.width, h = c.height;
  const out = cloneCanvas(c);
  const g = ctx2d(out);
  const d = ctx2d(c).getImageData(0, 0, w, h).data;
  g.fillStyle = ink; g.strokeStyle = ink; g.lineCap = 'round';
  const tries = Math.round((w / Math.max(4, size * 0.12)) * amount);
  for (let k = 0; k < tries; k++) {
    const x = (rng() * w) | 0;
    // find a bottom edge in this column
    let y = h - 2;
    let found = -1;
    for (let yy = 1; yy < h - 1; yy++) {
      if (d[(yy * w + x) * 4 + 3] > 200 && d[((yy + 1) * w + x) * 4 + 3] < 40) { found = yy; if (rng() < 0.5) break; }
    }
    if (found < 0) continue;
    y = found;
    const len = size * rng.range(0.15, 1.1) * (0.4 + amount);
    const wd = Math.max(1.2, size * rng.range(0.025, 0.06));
    g.lineWidth = wd;
    g.globalAlpha = 0.95;
    g.beginPath(); g.moveTo(x, y - wd * 0.5); g.lineTo(x + rng.range(-0.6, 0.6), y + len); g.stroke();
    g.beginPath(); g.arc(x, y + len, wd * 0.8, 0, 7); g.fill();
  }
  return out;
}

function emboss(mask, size, depth) {
  const w = mask.width, h = mask.height;
  const m = ctx2d(mask).getImageData(0, 0, w, h).data;
  const off = Math.max(1, Math.round(size * 0.035));
  const darkC = createCanvas(w, h), lightC = createCanvas(w, h);
  const di = ctx2d(darkC).createImageData(w, h), li = ctx2d(lightC).createImageData(w, h);
  const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : m[(y * w + x) * 4 + 3] / 255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const here = A(x, y);
    if (here < 0.01 && A(x + off, y + off) < 0.01 && A(x - off, y - off) < 0.01) continue;
    // light from top-left: inside a depression, the top-left wall is in shadow
    const e = A(x + off, y + off) - A(x - off, y - off);
    const shadowA = clamp(-e * 1.4 + here * 0.25, 0, 1) * depth;
    const lightA = clamp(e * 1.2, 0, 1) * depth;
    di.data[i] = 20; di.data[i + 1] = 18; di.data[i + 2] = 30; di.data[i + 3] = shadowA * 200;
    li.data[i] = 255; li.data[i + 1] = 255; li.data[i + 2] = 255; li.data[i + 3] = lightA * 170;
  }
  ctx2d(darkC).putImageData(di, 0, 0);
  ctx2d(lightC).putImageData(li, 0, 0);
  return { dark: darkC, light: lightC };
}

export { hexToRgb };
