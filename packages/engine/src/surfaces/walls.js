// Buildings, architecture, wood and hard materials.
import { createCanvas, ctx2d, shade as tone, blurCanvas, noiseField, fieldToCanvas, hexToRgb } from '../util.js';
import { solid, mottle, grain, speckle, fibers, edgeShade, roundRectPath } from '../paint.js';

function shadeLayer(w, h) {
  const c = createCanvas(w, h);
  const g = ctx2d(c);
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, w, h);
  return [c, g];
}

/** Vertical grime streaks running down from the top (rain staining). */
function grime(g, w, h, rng, s, amount = 1, color = '40,32,24') {
  g.save();
  for (let i = 0; i < 60 * amount; i++) {
    const x = rng() * w, len = rng.range(0.1, 0.6) * h, wd = rng.range(3, 26) * s;
    const gr = g.createLinearGradient(0, 0, 0, len);
    gr.addColorStop(0, `rgba(${color},${rng.range(0.05, 0.16) * amount})`);
    gr.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = gr; g.fillRect(x, 0, wd, len);
  }
  g.restore();
}

export function concrete({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const color = p.color || '#a9a6a0';
  const base = solid(w, h, color);
  const g = ctx2d(base);
  mottle(g, w, h, rng.fork('a'), { scale: 320 * s, dark: tone(color, -0.35), light: tone(color, 0.25), amount: 0.45, step: 5 });
  mottle(g, w, h, rng.fork('b'), { scale: 30 * s, octaves: 3, dark: tone(color, -0.4), light: tone(color, 0.3), amount: 0.25, step: 2 });
  // pits / air holes typical of cast concrete
  speckle(g, w, h, rng.fork('p'), { count: Math.round(w * h / 900), color: '#2b2926', alpha: 0.45, size: [0.6 * s, 3 * s] });
  speckle(g, w, h, rng.fork('q'), { count: Math.round(w * h / 1400), color: '#ffffff', alpha: 0.2, size: [0.5 * s, 1.6 * s] });
  if (p.formwork) {
    // form-tie holes and panel seams
    g.save(); g.strokeStyle = 'rgba(40,38,34,0.35)'; g.lineWidth = 2 * s;
    for (let x = w * 0.33; x < w; x += w * 0.33) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = h * 0.5; y < h; y += h * 0.5) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = 'rgba(30,28,25,0.55)';
    for (let x = w * 0.165; x < w; x += w * 0.33) for (let y = h * 0.25; y < h; y += h * 0.5) { g.beginPath(); g.arc(x, y, 8 * s, 0, 7); g.fill(); }
    g.restore();
  }
  grain(g, w, h, seed, { alpha: 40 });
  const [sh, sg] = shadeLayer(w, h);
  grime(sg, w, h, rng.fork('g'), s, p.grime ?? 1);
  return { base, shade: sh, shadeMode: 'multiply-gray', region: { x: w * 0.08, y: h * 0.12, w: w * 0.84, h: h * 0.76 }, porous: 0.55 };
}

export function brick({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const mortar = p.mortar || '#b9b1a3';
  const base = solid(w, h, mortar);
  const g = ctx2d(base);
  mottle(g, w, h, rng.fork('m'), { scale: 12 * s, octaves: 2, dark: '#6d665c', light: '#e2dccf', amount: 0.4, step: 2 });
  const bh = (p.brickH || 52) * s, bw = bh * 3.1, gap = 7 * s;
  const tones = p.tones || ['#9a4a35', '#8a3f2d', '#a85a40', '#7d3a2a', '#b06548', '#934632'];
  for (let row = 0, y = -bh * 0.3; y < h; row++, y += bh + gap) {
    const off = row % 2 ? -bw / 2 : 0;
    for (let x = off; x < w; x += bw + gap) {
      const col = rng.pick(tones);
      g.fillStyle = p.painted ? tone(p.painted, rng.range(-0.06, 0.04)) : tone(col, rng.range(-0.1, 0.08));
      const path = roundRectPath(x, y, bw, bh, 3 * s);
      g.fill(path);
    }
  }
  mottle(g, w, h, rng.fork('b1'), { scale: 18 * s, octaves: 3, dark: '#2a1a12', light: '#e8c0a0', amount: p.painted ? 0.12 : 0.28, step: 2 });
  mottle(g, w, h, rng.fork('b2'), { scale: 260 * s, dark: '#2a1e18', light: '#ffffff', amount: 0.25, step: 5 });
  speckle(g, w, h, rng.fork('sp'), { count: Math.round(w * h / 900), color: '#2a1810', alpha: 0.35, size: [0.6 * s, 2.4 * s] });
  grain(g, w, h, seed, { alpha: 36 });
  // mortar relief: dark lower edges of each course
  const [sh, sg] = shadeLayer(w, h);
  sg.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = -bh * 0.3; y < h; y += bh + gap) sg.fillRect(0, y + bh - 2 * s, w, gap + 2 * s);
  sg.fillStyle = 'rgba(255,255,255,0.14)';
  for (let y = -bh * 0.3; y < h; y += bh + gap) sg.fillRect(0, y, w, 2 * s);
  grime(sg, w, h, rng.fork('gr'), s, 0.6);
  return { base, shade: blurCanvas(sh, 1.5 * s), shadeMode: 'overlay', region: { x: w * 0.08, y: h * 0.12, w: w * 0.84, h: h * 0.76 }, porous: 0.75, mortarStep: bh + gap };
}

export function stucco({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const color = p.color || '#e6d3b8';
  const base = solid(w, h, color);
  const g = ctx2d(base);
  mottle(g, w, h, rng.fork('a'), { scale: 6 * s, octaves: 2, dark: tone(color, -0.25), light: tone(color, 0.3), amount: 0.45, contrast: 2, step: 1 });
  mottle(g, w, h, rng.fork('b'), { scale: 280 * s, dark: tone(color, -0.3), light: tone(color, 0.15), amount: 0.35, step: 5 });
  if (p.peel) {
    // peeling paint revealing concrete beneath
    const f = noiseField(w, h, { scale: 90 * s, octaves: 4, rng: rng.fork('peel'), step: 3 });
    const under = hexToRgb(p.under || '#9b978f');
    const layer = fieldToCanvas(f, w, h, (v) => (v > 0.68 ? [under[0], under[1], under[2], 255] : v > 0.66 ? [40, 30, 20, 120] : [0, 0, 0, 0]));
    g.drawImage(layer, 0, 0);
  }
  if (p.rust) {
    const [r] = [rng.fork('rust')];
    for (let i = 0; i < 5; i++) {
      const x = r() * w;
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(140,70,20,0.35)'); gr.addColorStop(1, 'rgba(140,70,20,0)');
      g.fillStyle = gr; g.fillRect(x, 0, r.range(8, 30) * s, h * r.range(0.3, 0.8));
    }
  }
  grain(g, w, h, seed, { alpha: 28 });
  const [sh, sg] = shadeLayer(w, h);
  grime(sg, w, h, rng.fork('g'), s, p.grime ?? 0.7);
  return { base, shade: sh, shadeMode: 'multiply-gray', region: { x: w * 0.08, y: h * 0.12, w: w * 0.84, h: h * 0.76 }, porous: 0.45 };
}

export function tiles({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const color = p.color || '#f1efe8';
  const base = solid(w, h, '#bdb8ad');
  const g = ctx2d(base);
  const th = (p.tileH || 60) * s, tw = th * 2, gap = 4 * s;
  for (let row = 0, y = 0; y < h; row++, y += th + gap) {
    const off = row % 2 ? -tw / 2 : 0;
    for (let x = off; x < w; x += tw + gap) {
      const gr = g.createLinearGradient(x, y, x, y + th);
      gr.addColorStop(0, tone(color, 0.15)); gr.addColorStop(0.5, color); gr.addColorStop(1, tone(color, -0.12));
      g.fillStyle = gr; g.fill(roundRectPath(x, y, tw, th, 6 * s));
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 8 * s, y + 5 * s, tw * 0.5, 2 * s);
    }
  }
  if (p.band) { g.fillStyle = p.band; g.fillRect(0, h * 0.82, w, th * 0.8); }
  mottle(g, w, h, rng.fork('d'), { scale: 220 * s, dark: '#5a5040', light: '#ffffff', amount: 0.2, step: 5 });
  grain(g, w, h, seed, { alpha: 14 });
  return { base, shade: null, region: { x: w * 0.08, y: h * 0.1, w: w * 0.84, h: h * 0.68 }, glossy: true };
}

export function metal({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const color = p.color || '#7d8790';
  const base = solid(w, h, color);
  const g = ctx2d(base);
  if (p.corrugated) {
    const period = 46 * s;
    for (let x = 0; x < w; x += 2) {
      const t = Math.sin((x / period) * Math.PI * 2);
      g.fillStyle = t > 0 ? `rgba(255,255,255,${t * 0.22})` : `rgba(0,0,0,${-t * 0.3})`;
      g.fillRect(x, 0, 2, h);
    }
  } else {
    mottle(g, w, h, rng.fork('br'), { scale: 60 * s, octaves: 3, dark: tone(color, -0.3), light: tone(color, 0.3), amount: 0.35, stretchX: 14, step: 2 });
  }
  mottle(g, w, h, rng.fork('rust'), { scale: 140 * s, dark: '#6a2e10', light: color, amount: p.rust ?? 0.35, contrast: 2.6, step: 4 });
  if (p.rivets) {
    for (let x = 30 * s; x < w; x += w / 6) for (const y of [24 * s, h - 24 * s, h / 2]) {
      const rg = g.createRadialGradient(x - 2 * s, y - 2 * s, 0, x, y, 7 * s);
      rg.addColorStop(0, '#e6e9ec'); rg.addColorStop(1, '#4b5258');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, 6 * s, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(0, h / 2 - 12 * s); g.lineTo(w, h / 2 - 12 * s); g.stroke();
  }
  grain(g, w, h, seed, { alpha: 30 });
  const [sh, sg] = shadeLayer(w, h);
  grime(sg, w, h, rng.fork('g'), s, 0.8, '60,30,10');
  return { base, shade: sh, shadeMode: 'multiply-gray', region: { x: w * 0.08, y: h * 0.12, w: w * 0.84, h: h * 0.76 }, porous: 0.25 };
}

/** Wood boards/planks. orientation: 'h' or 'v'. */
export function wood({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const color = p.color || '#a7744a';
  const base = solid(w, h, color);
  const g = ctx2d(base);
  const vertical = p.orientation === 'v';
  const boards = p.boards ?? (vertical ? 6 : 4);
  const bsize = (vertical ? w : h) / boards;
  for (let i = 0; i < boards; i++) {
    const bc = createCanvas(vertical ? Math.ceil(bsize) : w, vertical ? h : Math.ceil(bsize));
    const bg = ctx2d(bc);
    const bw = bc.width, bh = bc.height;
    bg.fillStyle = tone(color, rng.range(-0.15, 0.12)); bg.fillRect(0, 0, bw, bh);
    mottle(bg, bw, bh, rng.fork('grain' + i), { scale: 40 * s, octaves: 4, dark: tone(color, -0.5), light: tone(color, 0.25), amount: 0.55, contrast: 2.4, stretchX: vertical ? 1 : 22, stretchY: vertical ? 22 : 1, step: 2 });
    // knots
    if (rng.chance(0.5)) {
      const kx = rng() * bw, ky = rng() * bh;
      for (let r = 26 * s; r > 2; r -= 4 * s) { bg.strokeStyle = `rgba(60,30,10,${0.15})`; bg.lineWidth = 2 * s; bg.beginPath(); bg.ellipse(kx, ky, vertical ? r * 0.6 : r * 1.6, vertical ? r * 1.6 : r * 0.6, 0, 0, 7); bg.stroke(); }
    }
    g.drawImage(bc, vertical ? i * bsize : 0, vertical ? 0 : i * bsize);
  }
  if (p.weathered) {
    mottle(g, w, h, rng.fork('wx'), { scale: 200 * s, dark: '#5a5a55', light: '#c9c4ba', amount: 0.45, step: 4, op: 'color' });
    mottle(g, w, h, rng.fork('wy'), { scale: 200 * s, dark: '#3b352c', light: '#d8d2c5', amount: 0.25, step: 4 });
  }
  if (p.paint) {
    mottle(g, w, h, rng.fork('pt'), { scale: 50 * s, dark: p.paint, light: p.paint, amount: 0.0, step: 4 });
    g.save(); g.globalAlpha = 0.82; g.fillStyle = p.paint; g.fillRect(0, 0, w, h); g.restore();
    mottle(g, w, h, rng.fork('pt2'), { scale: 30 * s, octaves: 3, dark: tone(p.paint, -0.4), light: tone(p.paint, 0.2), amount: 0.25, stretchX: vertical ? 1 : 18, stretchY: vertical ? 18 : 1, step: 2 });
  }
  grain(g, w, h, seed, { alpha: 30 });
  const [sh, sg] = shadeLayer(w, h);
  // board seams
  for (let i = 1; i < boards; i++) {
    const pos = i * bsize;
    sg.fillStyle = 'rgba(0,0,0,0.7)';
    vertical ? sg.fillRect(pos - 2 * s, 0, 4 * s, h) : sg.fillRect(0, pos - 2 * s, w, 4 * s);
    sg.fillStyle = 'rgba(255,255,255,0.25)';
    vertical ? sg.fillRect(pos + 2 * s, 0, 2 * s, h) : sg.fillRect(0, pos + 2 * s, w, 2 * s);
  }
  if (p.nails) {
    sg.fillStyle = 'rgba(20,20,20,0.8)';
    for (let i = 0; i < boards; i++) for (const t of [0.06, 0.94]) {
      const c = (i + 0.5) * bsize;
      sg.beginPath(); sg.arc(vertical ? c : w * t, vertical ? h * t : c, 4 * s, 0, 7); sg.fill();
    }
  }
  return { base, shade: blurCanvas(sh, 1.2 * s), shadeMode: 'overlay', region: { x: w * 0.08, y: h * 0.1, w: w * 0.84, h: h * 0.8 }, porous: 0.5 };
}

/** Painted sign board (trail sign, exterior sign, street sign). */
export function sign({ w, h, rng, seed, p }) {
  const s = w / 1000;
  let base;
  if (p.style === 'street') {
    base = solid(w, h, p.color || '#1f6b45');
    const g = ctx2d(base);
    mottle(g, w, h, rng.fork('ref'), { scale: 200 * s, dark: '#000000', light: '#ffffff', amount: 0.12, step: 4 });
    grain(g, w, h, seed, { alpha: 18 });
    g.save(); g.strokeStyle = '#f4f4f0'; g.lineWidth = 12 * s; g.stroke(roundRectPath(22 * s, 22 * s, w - 44 * s, h - 44 * s, 26 * s)); g.restore();
    const clip = createCanvas(w, h); const cg = ctx2d(clip); cg.clip(roundRectPath(0, 0, w, h, 40 * s)); cg.drawImage(base, 0, 0);
    // bolts
    for (const x of [w * 0.5]) for (const y of [36 * s, h - 36 * s]) { cg.fillStyle = '#c9cdd0'; cg.beginPath(); cg.arc(x, y, 7 * s, 0, 7); cg.fill(); }
    return { base: clip, shade: null, region: { x: w * 0.08, y: h * 0.14, w: w * 0.84, h: h * 0.72 }, glossy: true };
  }
  // wooden routed trail sign / painted exterior sign
  const inner = wood({ w, h, rng, seed, p: { color: p.color || '#6b4a2b', orientation: 'h', boards: p.boards ?? 2, weathered: p.weathered, paint: p.paint } });
  base = inner.base;
  const g = ctx2d(base);
  if (p.border) {
    g.save(); g.strokeStyle = p.border; g.lineWidth = 10 * s; g.globalAlpha = 0.85; g.stroke(roundRectPath(26 * s, 26 * s, w - 52 * s, h - 52 * s, 14 * s)); g.restore();
  }
  const clip = createCanvas(w, h);
  const cg = ctx2d(clip);
  cg.clip(roundRectPath(0, 0, w, h, (p.radius ?? 18) * s));
  cg.drawImage(base, 0, 0);
  return { base: clip, shade: inner.shade, shadeMode: inner.shadeMode, region: { x: w * 0.09, y: h * 0.14, w: w * 0.82, h: h * 0.72 }, porous: 0.4 };
}

export { shadeLayer, grime, fibers, edgeShade, speckle };
