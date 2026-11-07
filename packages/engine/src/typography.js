// Layer 2: Typography. Draws the user's exact text as an isolated layer.
import { createCanvas, ctx2d, makeRng, makeNoise2D } from './util.js';
import { layoutText, findEmphasis } from './layout.js';

export function fontString(font, size) {
  return `${font.style || 'normal'} ${font.weight || 400} ${size.toFixed(2)}px "${font.family}", ${font.fallback || 'cursive, serif'}`;
}

const measureCtx = { c: null };
function mctx() {
  if (!measureCtx.c) measureCtx.c = ctx2d(createCanvas(8, 8));
  return measureCtx.c;
}

/** Width of a string, consistent with how renderTypography will draw it. */
export function makeMeasurer(font, { perChar, letterSpacing = 0 }) {
  const cache = new Map();
  return (size) => {
    const g = mctx();
    const fs = fontString(font, size);
    return (str) => {
      const key = fs + '\u0000' + str;
      let v = cache.get(key);
      if (v !== undefined) return v;
      g.font = fs;
      if (perChar) {
        v = 0;
        for (const ch of str) v += g.measureText(ch).width + letterSpacing * size;
      } else {
        v = g.measureText(str).width + letterSpacing * size * [...str].length;
      }
      cache.set(key, v);
      return v;
    };
  };
}

/**
 * Compute layout for given settings. Returns the layout object (see layout.js)
 * and flags such as `perChar` the renderer needs.
 */
export function computeLayout({ text, treatment, font, region, settings = {}, rules }) {
  const hand = treatment.hand;
  const letterSpacing = settings.letterSpacing ?? 0;
  const perChar = !!(hand && hand.perChar && !font.script) || letterSpacing !== 0 || treatment.id === 'typewriter';
  const measureAt = makeMeasurer(font, { perChar, letterSpacing });
  const lineHeight = settings.lineHeight ?? treatment.lineHeight ?? 1.2;
  const base = {
    text, region, measureAt, lineHeight,
    align: settings.align || 'center',
    valign: settings.valign || 'middle',
    balance: settings.balance !== false,
    sizeMode: 'auto',
    minSize: region.h * 0.02,
    maxSize: Math.min(region.h * 0.42, region.w * 0.3),
    rules: rules && settings.snapToLines !== false ? { ...rules, sizeAdj: font.sizeAdj || 1 } : null,
  };
  let layout = layoutText(base);
  const scale = settings.sizeScale ?? 1;
  if (Math.abs(scale - 1) > 0.01) {
    const auto = layout.fontSize;
    layout = layoutText({ ...base, sizeMode: auto * scale, rules: null });
  }
  layout.perChar = perChar;
  layout.letterSpacing = letterSpacing;
  return layout;
}

/**
 * Render the layout to a transparent canvas the size of the surface plane.
 * Returns { text, accent } — accent holds emphasis marks drawn behind the
 * ink (highlighter) or alongside it (underline/circle) so the material layer
 * can treat them separately.
 */
export function renderTypography({ w, h, layout, treatment, font, ink, emphasis, seed = 1, settings = {} }) {
  const text = createCanvas(w, h);
  const g = ctx2d(text);
  const accent = createCanvas(w, h);
  const ag = ctx2d(accent);
  const rng = makeRng(seed);
  const noise = makeNoise2D(makeRng(seed + 7));
  const size = layout.fontSize;
  const hand = treatment.hand;
  const strength = settings.handVariation ?? 1;
  const ls = layout.letterSpacing * size;
  g.fillStyle = ink;
  g.textBaseline = 'alphabetic';
  g.font = fontString(font, size);

  const emRange = emphasis?.range || null;
  const emStyle = emphasis?.style || treatment.emphasis || 'underline';
  const emColor = emphasis?.color || ink;
  const inEm = (start, end) => emRange && start < emRange[1] && end > emRange[0];
  const emBoxes = []; // per line: [x0, x1, baseline]

  layout.lines.forEach((line, li) => {
    const slope = hand ? rng.gauss() * hand.slope * strength : 0;
    const x0 = line.x;
    const lineEm = [];
    for (const t of line.tokens) {
      if (t.space) continue;
      // split token into runs by emphasis boundary so partial-word emphasis works
      const runs = [];
      if (emRange && inEm(t.start, t.end) && (t.start < emRange[0] || t.end > emRange[1])) {
        const a = Math.max(0, emRange[0] - t.start), b = Math.min(t.text.length, emRange[1] - t.start);
        if (a > 0) runs.push([t.text.slice(0, a), t.start, false]);
        runs.push([t.text.slice(a, b), t.start + a, true]);
        if (b < t.text.length) runs.push([t.text.slice(b), t.start + b, false]);
      } else runs.push([t.text, t.start, inEm(t.start, t.end)]);

      let rx = t.x;
      for (const [str, , em] of runs) {
        const runW = layout.perChar ? [...str].reduce((acc, ch) => acc + g.measureText(ch).width + ls, 0) : g.measureText(str).width + ls * [...str].length;
        const color = em && (emStyle === 'color' || emStyle === 'highlight-color') ? emColor : ink;
        if (em) lineEm.push([rx, rx + runW]);
        drawRun(str, rx, line.baseline, color, em && emStyle === 'bold');
        rx += runW;
      }
    }
    if (lineEm.length) emBoxes.push([Math.min(...lineEm.map((e) => e[0])), Math.max(...lineEm.map((e) => e[1])), line.baseline, li]);

    function drawRun(str, x, baseline, color, bold) {
      g.fillStyle = color;
      if (layout.perChar) {
        let cx = x;
        for (const ch of str) {
          const cw = g.measureText(ch).width;
          const dx = cx - x0;
          const yLine = baseline + dx * slope;
          const wob = hand ? (noise(cx / (size * 3), li * 3.1) - 0.5) * hand.wobble * size * 2 * strength : 0;
          const by = hand ? rng.gauss() * hand.base * size * 0.5 * strength : 0;
          const rot = hand ? rng.gauss() * hand.rot * strength + slope : 0;
          const sc = hand && hand.scale ? 1 + rng.gauss() * hand.scale * strength : 1;
          g.save();
          g.translate(cx + cw / 2, yLine + wob + by);
          g.rotate(rot);
          g.scale(sc, sc);
          if (treatment.id === 'typewriter') {
            g.globalAlpha = 0.72 + rng() * 0.28;
            g.fillText(ch, -cw / 2, 0);
            if (rng.chance(0.12)) { g.globalAlpha = 0.25; g.fillText(ch, -cw / 2 + size * 0.02, size * 0.01); }
          } else {
            g.fillText(ch, -cw / 2, 0);
            if (bold) { g.lineWidth = size * 0.035; g.strokeStyle = color; g.strokeText(ch, -cw / 2, 0); }
          }
          g.restore();
          cx += cw + ls;
        }
      } else {
        const dx = x - x0;
        g.save();
        g.translate(x, baseline + dx * slope + (hand ? rng.gauss() * hand.base * size * 0.4 * strength : 0));
        g.rotate(slope + (hand ? rng.gauss() * hand.rot * 0.4 * strength : 0));
        g.fillText(str, 0, 0);
        if (bold) { g.lineWidth = size * 0.035; g.strokeStyle = color; g.strokeText(str, 0, 0); }
        g.restore();
      }
    }
  });

  // emphasis marks
  if (emBoxes.length && emStyle !== 'color' && emStyle !== 'bold') {
    ag.strokeStyle = emColor; ag.fillStyle = emColor; ag.lineCap = 'round';
    for (const [a, b, base] of emBoxes) {
      if (emStyle === 'underline') {
        ag.lineWidth = Math.max(1.5, size * 0.06);
        ag.beginPath();
        const y = base + size * 0.14;
        ag.moveTo(a - size * 0.05, y + rng.range(-1, 1) * size * 0.03);
        ag.bezierCurveTo(a + (b - a) * 0.3, y + size * 0.05 * rng.gauss(), a + (b - a) * 0.7, y - size * 0.04, b + size * 0.08, y + rng.range(-1, 1) * size * 0.04);
        ag.stroke();
      } else if (emStyle === 'highlight') {
        ag.save();
        ag.globalAlpha = 0.55;
        ag.fillStyle = emphasis?.highlight || '#ffe14d';
        const top = base - size * 0.72, hh = size * 0.88;
        ag.beginPath();
        ag.moveTo(a - size * 0.12, top + rng.range(0, 0.1) * size);
        ag.lineTo(b + size * 0.12, top + rng.range(-0.05, 0.08) * size);
        ag.lineTo(b + size * 0.1, top + hh + rng.range(-0.05, 0.05) * size);
        ag.lineTo(a - size * 0.08, top + hh + rng.range(0, 0.08) * size);
        ag.closePath(); ag.fill();
        ag.restore();
      } else if (emStyle === 'circle') {
        ag.lineWidth = Math.max(1.5, size * 0.05);
        const cx = (a + b) / 2, cy = base - size * 0.3, rx = (b - a) / 2 + size * 0.3, ry = size * 0.72;
        ag.beginPath();
        for (let t = -0.2; t <= Math.PI * 2 + 0.35; t += 0.08) {
          const k = 1 + 0.04 * Math.sin(t * 3) + (t > Math.PI * 2 ? 0.06 : 0);
          const px = cx + Math.cos(t) * rx * k, py = cy + Math.sin(t) * ry * k;
          t <= -0.19 ? ag.moveTo(px, py) : ag.lineTo(px, py);
        }
        ag.stroke();
      }
    }
  }

  return { text, accent: emBoxes.length ? accent : null, accentBehind: emStyle === 'highlight' };
}

export { findEmphasis };
