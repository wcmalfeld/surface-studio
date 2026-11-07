// Procedural painting helpers used by surface and environment generators.
import { createCanvas, ctx2d, noiseField, fieldToCanvas, hexToRgb, grainTile, fillPattern, blurCanvas, makeNoise2D } from './util.js';

export function solid(w, h, color) {
  const c = createCanvas(w, h);
  const g = ctx2d(c);
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  return c;
}

/** Low-frequency mottling: blends between a darker and lighter tone. */
export function mottle(g, w, h, rng, { scale = 120, octaves = 4, dark = '#000000', light = '#ffffff', amount = 0.12, contrast = 1.6, stretchX = 1, stretchY = 1, step = 3, op = 'source-over' } = {}) {
  const f = noiseField(w, h, { scale, octaves, rng, stretchX, stretchY, step });
  const dc = hexToRgb(dark), lc = hexToRgb(light);
  const layer = fieldToCanvas(f, w, h, (v) => {
    const t = Math.max(-1, Math.min(1, (v - 0.5) * 2 * contrast));
    const col = t < 0 ? dc : lc;
    return [col[0], col[1], col[2], Math.abs(t) * 255 * amount];
  });
  g.save();
  g.globalCompositeOperation = op;
  g.drawImage(layer, 0, 0);
  g.restore();
  return f;
}

export function grain(g, w, h, seed, { alpha = 26, op = 'overlay', opacity = 1, size = 256 } = {}) {
  fillPattern(g, grainTile(seed, size, alpha), w, h, op, opacity);
}

export function fibers(g, w, h, rng, { count = 400, color = '#000000', alpha = 0.05, len = [6, 30], width = [0.4, 1.2] } = {}) {
  g.save();
  g.strokeStyle = color;
  g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = rng() * w, y = rng() * h;
    const l = rng.range(len[0], len[1]);
    const a = rng() * Math.PI * 2;
    g.globalAlpha = alpha * rng.range(0.4, 1);
    g.lineWidth = rng.range(width[0], width[1]);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  g.restore();
}

export function speckle(g, w, h, rng, { count = 300, color = '#000000', alpha = 0.25, size = [0.4, 1.6] } = {}) {
  g.save();
  g.fillStyle = color;
  for (let i = 0; i < count; i++) {
    g.globalAlpha = alpha * rng.range(0.3, 1);
    g.beginPath();
    g.arc(rng() * w, rng() * h, rng.range(size[0], size[1]), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

export function stainRing(g, x, y, r, rng, color = '#7a4a1c', alpha = 0.18) {
  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = color;
  for (let k = 0; k < 3; k++) {
    g.lineWidth = rng.range(1, 4);
    g.beginPath();
    for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.08) {
      const rr = r * (1 + 0.025 * Math.sin(t * 5 + k) + 0.01 * rng());
      const px = x + Math.cos(t) * rr, py = y + Math.sin(t) * rr;
      t === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
    }
    g.stroke();
  }
  g.globalAlpha = alpha * 0.25;
  g.fillStyle = color;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** Jagged polygon path along a rectangle's chosen edges ("torn" look). */
export function tornRectPath(w, h, rng, { sides = { top: true, right: false, bottom: false, left: false }, depth = 10, inset = 4 } = {}) {
  const p = new Path2D();
  const jag = (len, on) => {
    const pts = [];
    const n = Math.max(2, Math.round(len / 7));
    for (let i = 0; i <= n; i++) pts.push(on ? rng.range(0, depth) + (rng.chance(0.08) ? rng.range(0, depth) : 0) : 0);
    return { pts, n };
  };
  const top = jag(w, sides.top), right = jag(h, sides.right), bottom = jag(w, sides.bottom), left = jag(h, sides.left);
  p.moveTo(inset + left.pts[0], inset + top.pts[0]);
  for (let i = 0; i <= top.n; i++) p.lineTo(inset + (i / top.n) * (w - 2 * inset), inset + top.pts[i]);
  for (let i = 0; i <= right.n; i++) p.lineTo(w - inset - right.pts[i], inset + (i / right.n) * (h - 2 * inset));
  for (let i = bottom.n; i >= 0; i--) p.lineTo(inset + (i / bottom.n) * (w - 2 * inset), h - inset - bottom.pts[i]);
  for (let i = left.n; i >= 0; i--) p.lineTo(inset + left.pts[i], inset + (i / left.n) * (h - 2 * inset));
  p.closePath();
  return p;
}

export function roundRectPath(x, y, w, h, r) {
  const p = new Path2D();
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
  return p;
}

/** Clip an existing canvas to a path (everything outside becomes transparent). */
export function clipCanvas(canvas, path) {
  const out = createCanvas(canvas.width, canvas.height);
  const g = ctx2d(out);
  g.save();
  g.clip(path);
  g.drawImage(canvas, 0, 0);
  g.restore();
  return out;
}

/** Soft edge darkening for paper and boards. */
export function edgeShade(g, w, h, { strength = 0.25, size = 0.18, color = '0,0,0' } = {}) {
  const s = Math.min(w, h) * size;
  const grads = [
    [0, 0, 0, s, 0, 0, w, s],
    [0, h, 0, h - s, 0, h - s, w, s],
    [0, 0, s, 0, 0, 0, s, h],
    [w, 0, w - s, 0, w - s, 0, s, h],
  ];
  g.save();
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of grads) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, `rgba(${color},${strength})`);
    gr.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = gr;
    g.fillRect(rx, ry, rw, rh);
  }
  g.restore();
}

export function vignette(g, w, h, strength = 0.35, inner = 0.45) {
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * inner * 0.6, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, `rgba(0,0,0,${strength})`);
  g.save();
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  g.restore();
}

/**
 * Crumple/fold relief: returns { shade, displace } where shade is a
 * soft-light/multiply layer and displace(u,v)->[dx,dy] (in px) bends the mesh.
 */
export function crumpleRelief(w, h, rng, { intensity = 1, folds = 0, creases = 18 } = {}) {
  const shade = createCanvas(w, h);
  const g = ctx2d(shade);
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, w, h);
  const noise = makeNoise2D(rng);
  // facet lighting: draw creases as lines with light/dark sides
  const lines = [];
  for (let i = 0; i < creases * intensity; i++) {
    const x = rng() * w, y = rng() * h, a = rng() * Math.PI, L = rng.range(0.2, 0.7) * Math.max(w, h);
    lines.push([x - Math.cos(a) * L / 2, y - Math.sin(a) * L / 2, x + Math.cos(a) * L / 2, y + Math.sin(a) * L / 2, a]);
  }
  for (let f = 0; f < folds; f++) {
    const horiz = f % 2 === 0;
    const pos = (f < 2 ? (horiz ? h : w) * (0.5 + rng.range(-0.04, 0.04)) : (horiz ? h : w) * rng.range(0.3, 0.7));
    lines.push(horiz ? [0, pos, w, pos, 0] : [pos, 0, pos, h, Math.PI / 2]);
  }
  for (const [x0, y0, x1, y1, a] of lines) {
    const nx = -Math.sin(a), ny = Math.cos(a);
    const width = rng.range(10, 40);
    const gr = g.createLinearGradient((x0 + x1) / 2 - nx * width, (y0 + y1) / 2 - ny * width, (x0 + x1) / 2 + nx * width, (y0 + y1) / 2 + ny * width);
    const lightSide = rng.chance(0.5);
    const amp = rng.range(0.07, 0.2) * intensity;
    gr.addColorStop(0, 'rgba(128,128,128,0)');
    gr.addColorStop(0.48, lightSide ? `rgba(255,255,255,${amp})` : `rgba(0,0,0,${amp})`);
    gr.addColorStop(0.52, lightSide ? `rgba(0,0,0,${amp})` : `rgba(255,255,255,${amp})`);
    gr.addColorStop(1, 'rgba(128,128,128,0)');
    g.save();
    g.strokeStyle = gr;
    g.lineWidth = width * 2;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.restore();
  }
  const soft = blurCanvas(shade, 1.2);
  const k = 0.012 * intensity * Math.min(w, h);
  const displace = (u, v) => {
    const n1 = noise(u * 5, v * 5) - 0.5, n2 = noise(u * 5 + 9.1, v * 5 + 3.3) - 0.5;
    return [n1 * k, n2 * k];
  };
  return { shade: soft, displace };
}

/** Faux "text" bars for newspapers/books: never real characters, just texture. */
export function proseBars(g, x, y, w, h, rng, { lineH = 10, color = '#222', alpha = 0.55, justify = true } = {}) {
  g.save();
  g.fillStyle = color;
  for (let yy = y; yy < y + h - lineH * 0.5; yy += lineH) {
    let xx = x;
    const end = justify && rng.chance(0.88) ? x + w : x + w * rng.range(0.3, 0.9);
    while (xx < end) {
      const ww = Math.min(rng.range(lineH * 0.8, lineH * 4.5), end - xx);
      g.globalAlpha = alpha * rng.range(0.7, 1);
      g.fillRect(xx, yy, ww, lineH * 0.42);
      xx += ww + lineH * 0.45;
    }
  }
  g.restore();
}
