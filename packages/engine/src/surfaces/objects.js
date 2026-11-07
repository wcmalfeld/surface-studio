// Everyday objects, outdoor & experimental surfaces.
import { createCanvas, ctx2d, shade as tone, blurCanvas, noiseField, fieldToCanvas, hexToRgb, makeNoise2D } from '../util.js';
import { solid, mottle, grain, speckle, fibers, edgeShade, roundRectPath, clipCanvas, tornRectPath, proseBars, crumpleRelief } from '../paint.js';
import { shadeLayer, grime } from './walls.js';

export function cardboard({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const color = p.color || '#c49a64';
  let base = solid(w, h, color);
  const g = ctx2d(base);
  mottle(g, w, h, rng.fork('a'), { scale: 220 * s, dark: tone(color, -0.3), light: tone(color, 0.2), amount: 0.35, step: 4 });
  // corrugation shows through as faint vertical ribs
  g.save();
  for (let x = 0; x < w; x += 9 * s) { g.fillStyle = 'rgba(80,50,20,0.06)'; g.fillRect(x, 0, 3 * s, h); }
  g.restore();
  speckle(g, w, h, rng.fork('s'), { count: Math.round(w * h / 1800), color: '#4a2f12', alpha: 0.3, size: [0.4 * s, 1.5 * s] });
  fibers(g, w, h, rng.fork('f'), { count: Math.round(w * h / 1500), color: '#3a2410', alpha: 0.07 });
  if (p.tape) {
    g.save(); g.globalAlpha = 0.55; g.fillStyle = '#d8b67a';
    g.fillRect(0, h * 0.04, w, 70 * s);
    g.globalAlpha = 0.35; g.fillStyle = '#fff'; g.fillRect(0, h * 0.04 + 6 * s, w, 3 * s);
    g.restore();
  }
  if (p.box) {
    // printed box marks (generic symbols)
    g.save(); g.strokeStyle = 'rgba(30,20,10,0.55)'; g.lineWidth = 5 * s;
    const bx = w * 0.82, by = h * 0.82;
    g.beginPath(); g.moveTo(bx, by + 40 * s); g.lineTo(bx, by); g.lineTo(bx - 14 * s, by + 14 * s); g.moveTo(bx, by); g.lineTo(bx + 14 * s, by + 14 * s);
    g.moveTo(bx + 34 * s, by + 40 * s); g.lineTo(bx + 34 * s, by); g.lineTo(bx + 20 * s, by + 14 * s); g.moveTo(bx + 34 * s, by); g.lineTo(bx + 48 * s, by + 14 * s); g.stroke();
    g.strokeRect(w * 0.06, h * 0.84, 90 * s, 36 * s);
    g.restore();
  }
  grain(g, w, h, seed, { alpha: 30 });
  if (p.torn) base = clipCanvas(base, tornRectPath(w, h, rng.fork('t'), { sides: { top: true, right: true, bottom: true, left: true }, depth: 14 * s, inset: 14 * s }));
  const [sh, sg] = shadeLayer(w, h);
  if (p.dents) {
    const relief = crumpleRelief(w, h, rng.fork('d'), { intensity: 0.25, folds: 0, creases: 6 });
    sg.drawImage(relief.shade, 0, 0);
  }
  edgeShade(sg, w, h, { strength: 0.18 });
  return { base, shade: sh, shadeMode: 'overlay', region: { x: w * 0.1, y: h * (p.tape ? 0.16 : 0.1), w: w * 0.8, h: h * (p.tape ? 0.72 : 0.78) }, porous: 0.3 };
}

export function sleeve({ w, h, rng, seed }) {
  const s = w / 1000;
  const r = cardboard({ w, h, rng, seed, p: { color: '#b98b55' } });
  const g = ctx2d(r.base);
  g.save(); g.globalAlpha = 0.12;
  for (let x = 0; x < w; x += 12 * s) { g.fillStyle = '#000'; g.fillRect(x, 0, 4 * s, h); }
  g.restore();
  // curved band shape (wider at top, like a cone frustum unrolled)
  const path = new Path2D();
  path.moveTo(0, h * 0.06); path.quadraticCurveTo(w / 2, -h * 0.06, w, h * 0.06);
  path.lineTo(w * 0.96, h * 0.96); path.quadraticCurveTo(w / 2, h * 0.84, w * 0.04, h * 0.96); path.closePath();
  r.base = clipCanvas(r.base, path);
  r.region = { x: w * 0.12, y: h * 0.16, w: w * 0.76, h: h * 0.62 };
  r.bend = 0.18; // cylindrical bend amount
  return r;
}

export function fabric({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const color = p.color || '#d9d0bf';
  const base = solid(w, h, color);
  const g = ctx2d(base);
  const t = (p.weave || 6) * s;
  g.save();
  for (let y = 0; y < h; y += t) { g.fillStyle = `rgba(0,0,0,${0.04 + rng() * 0.05})`; g.fillRect(0, y, w, t * 0.45); }
  for (let x = 0; x < w; x += t) { g.fillStyle = `rgba(255,255,255,${0.03 + rng() * 0.05})`; g.fillRect(x, 0, t * 0.45, h); }
  g.restore();
  if (p.denim) {
    g.save(); g.globalAlpha = 0.18; g.strokeStyle = '#fff'; g.lineWidth = 1.2 * s;
    for (let x = -h; x < w; x += 5 * s) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h * 0.6, h); g.stroke(); }
    g.restore();
  }
  mottle(g, w, h, rng.fork('f'), { scale: 240 * s, dark: tone(color, -0.35), light: tone(color, 0.2), amount: 0.3, step: 4 });
  grain(g, w, h, seed, { alpha: 30 });
  const [sh, sg] = shadeLayer(w, h);
  const relief = crumpleRelief(w, h, rng.fork('wr'), { intensity: 0.5, creases: 10 });
  sg.drawImage(blurCanvas(relief.shade, 10 * s), 0, 0);
  return { base, shade: sh, shadeMode: 'soft-light', region: { x: w * 0.1, y: h * 0.12, w: w * 0.8, h: h * 0.76 }, porous: 0.65, displace: relief.displace, bleed: 0.6 };
}

export function bookCover({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const color = p.color || '#2f4a3a';
  const r = fabric({ w, h, rng, seed, p: { color, weave: 3 } });
  const g = ctx2d(r.base);
  edgeShade(g, w, h, { strength: 0.35, size: 0.06 });
  if (p.band) { g.save(); g.fillStyle = 'rgba(15,15,15,0.85)'; g.fillRect(w * 0.84, 0, 22 * s, h); g.restore(); }
  r.base = clipCanvas(r.base, roundRectPath(0, 0, w, h, 16 * s));
  r.region = { x: w * 0.12, y: h * 0.16, w: w * (p.band ? 0.66 : 0.76), h: h * 0.62 };
  r.displace = null;
  return r;
}

export function sticker({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const base = createCanvas(w, h);
  const g = ctx2d(base);
  const shape = roundRectPath(10 * s, 10 * s, w - 20 * s, h - 20 * s, Math.min(w, h) * 0.22);
  g.fillStyle = '#ffffff'; g.fill(shape);
  const inner = roundRectPath(34 * s, 34 * s, w - 68 * s, h - 68 * s, Math.min(w, h) * 0.18);
  g.save(); g.clip(inner);
  const gr = g.createLinearGradient(0, 0, w, h);
  const cols = p.colors || ['#ffcc33', '#ff7a59'];
  gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  grain(g, w, h, seed, { alpha: 14 });
  g.restore();
  // vinyl gloss
  const sheen = g.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0.2, 'rgba(255,255,255,0)'); sheen.addColorStop(0.32, 'rgba(255,255,255,0.35)'); sheen.addColorStop(0.42, 'rgba(255,255,255,0)');
  g.save(); g.clip(shape); g.fillStyle = sheen; g.fillRect(0, 0, w, h); g.restore();
  return { base, shade: null, region: { x: w * 0.12, y: h * 0.14, w: w * 0.76, h: h * 0.72 }, raised: true };
}

export function skateboard({ w, h, rng, seed }) {
  const s = h / 1000; // deck is wide; scale by height
  const r = { base: createCanvas(w, h) };
  const g = ctx2d(r.base);
  const deck = roundRectPath(0, 0, w, h, h * 0.5);
  g.save(); g.clip(deck);
  const body = solid(w, h, '#d9b080');
  const bg = ctx2d(body);
  mottle(bg, w, h, rng.fork('m'), { scale: 50 * s, octaves: 4, dark: '#8a5a2a', light: '#f0d2a8', amount: 0.45, contrast: 2.2, stretchX: 18, step: 2 });
  grain(bg, w, h, seed, { alpha: 24 });
  g.drawImage(body, 0, 0);
  // ply edges and truck bolts
  g.strokeStyle = 'rgba(80,40,10,0.55)'; g.lineWidth = 10 * s; g.stroke(deck);
  g.fillStyle = 'rgba(40,40,40,0.75)';
  for (const fx of [0.2, 0.8]) for (const dx of [-1, 1]) for (const dy of [-1, 1]) { g.beginPath(); g.arc(w * fx + dx * 22 * s, h / 2 + dy * 30 * s, 6 * s, 0, 7); g.fill(); }
  g.restore();
  r.shade = null;
  r.region = { x: w * 0.27, y: h * 0.14, w: w * 0.46, h: h * 0.72 };
  r.porous = 0.4;
  return r;
}

export function vehicle({ w, h, rng, seed, p }) {
  const s = w / 1000;
  if (p.dusty) {
    // dusty rear window: clear dark glass under a dust layer (writing wipes the dust)
    const under = solid(w, h, '#1d2328');
    const ug = ctx2d(under);
    const gr = ug.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2c3a44'); gr.addColorStop(1, '#0f1418');
    ug.fillStyle = gr; ug.fillRect(0, 0, w, h);
    // headrests/silhouettes blurred inside the car
    ug.fillStyle = '#05080a'; for (const x of [0.25, 0.75]) { ug.beginPath(); ug.ellipse(w * x, h * 0.85, w * 0.1, h * 0.2, 0, 0, 7); ug.fill(); }
    const sky = ug.createLinearGradient(0, 0, w, h * 0.4); sky.addColorStop(0, 'rgba(200,220,235,0.35)'); sky.addColorStop(1, 'rgba(200,220,235,0)');
    ug.fillStyle = sky; ug.fillRect(0, 0, w, h);
    const underB = blurCanvas(under, 6 * s);
    const base = createCanvas(w, h);
    const g = ctx2d(base);
    g.drawImage(underB, 0, 0);
    const dust = solid(w, h, '#b9ad97');
    const dg = ctx2d(dust);
    mottle(dg, w, h, rng.fork('d'), { scale: 120 * s, dark: '#6f6656', light: '#e3d9c4', amount: 0.55, step: 3 });
    speckle(dg, w, h, rng.fork('ds'), { count: Math.round(w * h / 300), color: '#5a4f40', alpha: 0.4, size: [0.4 * s, 1.5 * s] });
    // rain-drip clean tracks
    dg.save(); dg.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 10; i++) { const x = rng() * w; dg.globalAlpha = 0.4; dg.fillRect(x, rng() * h * 0.4, rng.range(2, 6) * s, h * rng.range(0.2, 0.6)); }
    dg.restore();
    g.globalAlpha = 0.92; g.drawImage(dust, 0, 0); g.globalAlpha = 1;
    const shaped = clipCanvas(base, roundRectPath(0, 0, w, h, 50 * s));
    return { base: shaped, under: clipCanvas(underB, roundRectPath(0, 0, w, h, 50 * s)), shade: null, region: { x: w * 0.1, y: h * 0.14, w: w * 0.8, h: h * 0.68 }, wipe: true };
  }
  // painted car body panel with reflections
  const color = p.color || '#2a5d8f';
  const base = solid(w, h, color);
  const g = ctx2d(base);
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.36, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.1)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  speckle(g, w, h, rng.fork('flake'), { count: Math.round(w * h / 200), color: '#ffffff', alpha: 0.12, size: [0.3 * s, 0.8 * s] });
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(0, h * 0.62); g.lineTo(w, h * 0.6); g.stroke();
  return { base, shade: null, region: { x: w * 0.08, y: h * 0.1, w: w * 0.84, h: h * 0.44 }, glossy: true };
}

export function rock({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const color = p.color || '#8d877c';
  const base = solid(w, h, color);
  const g = ctx2d(base);
  mottle(g, w, h, rng.fork('a'), { scale: 280 * s, dark: tone(color, -0.5), light: tone(color, 0.3), amount: 0.55, step: 4 });
  mottle(g, w, h, rng.fork('b'), { scale: 22 * s, octaves: 3, dark: tone(color, -0.45), light: tone(color, 0.35), amount: 0.35, step: 2 });
  speckle(g, w, h, rng.fork('c'), { count: Math.round(w * h / 300), color: '#ffffff', alpha: 0.25, size: [0.4 * s, 1.4 * s] });
  speckle(g, w, h, rng.fork('d'), { count: Math.round(w * h / 300), color: '#1a1814', alpha: 0.3, size: [0.4 * s, 1.6 * s] });
  if (p.lichen) mottle(g, w, h, rng.fork('l'), { scale: 40 * s, dark: '#9aa04a', light: color, amount: 0.35, contrast: 3, step: 3 });
  grain(g, w, h, seed, { alpha: 40 });
  // irregular boulder silhouette with rounded relief
  const noise = makeNoise2D(rng.fork('shape'));
  const path = new Path2D();
  for (let t = 0; t <= Math.PI * 2 + 0.001; t += 0.05) {
    const rr = 0.47 + 0.04 * (noise(Math.cos(t) * 2 + 5, Math.sin(t) * 2 + 5) - 0.5) * 2;
    const x = w / 2 + Math.cos(t) * w * rr, y = h / 2 + Math.sin(t) * h * rr * 0.98;
    t === 0 ? path.moveTo(x, y) : path.lineTo(x, y);
  }
  path.closePath();
  const shaped = clipCanvas(base, path);
  const [sh, sg] = shadeLayer(w, h);
  const rg = sg.createRadialGradient(w * 0.38, h * 0.32, w * 0.05, w / 2, h / 2, w * 0.55);
  rg.addColorStop(0, 'rgba(255,255,255,0.35)'); rg.addColorStop(0.6, 'rgba(128,128,128,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.7)');
  sg.fillStyle = rg; sg.fillRect(0, 0, w, h);
  return { base: shaped, shade: sh, shadeMode: 'overlay', region: { x: w * 0.18, y: h * 0.24, w: w * 0.64, h: h * 0.52 }, porous: 0.7, displace: (u, v) => [0, 0] };
}

export function bark({ w, h, rng, seed }) {
  const s = w / 1000;
  const base = solid(w, h, '#5d4a3a');
  const g = ctx2d(base);
  mottle(g, w, h, rng.fork('b'), { scale: 30 * s, octaves: 4, dark: '#2a1f16', light: '#9c8670', amount: 0.75, contrast: 2.4, stretchY: 9, step: 2 });
  mottle(g, w, h, rng.fork('m'), { scale: 160 * s, dark: '#1f1912', light: '#a7a08a', amount: 0.35, step: 4 });
  // a smoothed, debarked panel in the middle (where someone would write)
  const panel = roundRectPath(w * 0.18, h * 0.2, w * 0.64, h * 0.6, 60 * s);
  const smooth = solid(w, h, '#c9a77e');
  const smg = ctx2d(smooth);
  mottle(smg, w, h, rng.fork('sm'), { scale: 40 * s, octaves: 3, dark: '#8a6a44', light: '#e6cba4', amount: 0.45, stretchY: 12, step: 2 });
  grain(smg, w, h, seed, { alpha: 30 });
  g.save(); g.clip(panel); g.drawImage(smooth, 0, 0); g.restore();
  g.save(); g.strokeStyle = 'rgba(30,20,12,0.6)'; g.lineWidth = 8 * s; g.stroke(panel); g.restore();
  const [sh, sg] = shadeLayer(w, h);
  const cyl = sg.createLinearGradient(0, 0, w, 0);
  cyl.addColorStop(0, 'rgba(0,0,0,0.85)'); cyl.addColorStop(0.3, 'rgba(128,128,128,0)'); cyl.addColorStop(0.45, 'rgba(255,255,255,0.2)'); cyl.addColorStop(0.7, 'rgba(128,128,128,0)'); cyl.addColorStop(1, 'rgba(0,0,0,0.85)');
  sg.fillStyle = cyl; sg.fillRect(0, 0, w, h);
  return { base, shade: sh, shadeMode: 'overlay', region: { x: w * 0.24, y: h * 0.26, w: w * 0.52, h: h * 0.48 }, porous: 0.5, bend: 0.22 };
}

export function ground({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const kind = p.kind || 'asphalt';
  if (kind === 'asphalt') {
    const base = solid(w, h, '#3c3d3f');
    const g = ctx2d(base);
    mottle(g, w, h, rng.fork('a'), { scale: 4 * s, octaves: 2, dark: '#141414', light: '#8a8a88', amount: 0.45, contrast: 2, step: 1 });
    mottle(g, w, h, rng.fork('b'), { scale: 240 * s, dark: '#1a1a1a', light: '#6c6b68', amount: 0.35, step: 4 });
    speckle(g, w, h, rng.fork('c'), { count: Math.round(w * h / 250), color: '#c9c6bf', alpha: 0.35, size: [0.4 * s, 1.5 * s] });
    if (p.lineColor) { g.fillStyle = p.lineColor; g.globalAlpha = 0.75; g.fillRect(w * 0.02, 0, 22 * s, h); g.globalAlpha = 1; }
    grain(g, w, h, seed, { alpha: 40 });
    return { base, shade: null, region: { x: w * 0.1, y: h * 0.12, w: w * 0.8, h: h * 0.76 }, porous: 0.45, dark: true };
  }
  if (kind === 'sidewalk') {
    const base = solid(w, h, '#b8b4ab');
    const g = ctx2d(base);
    mottle(g, w, h, rng.fork('a'), { scale: 6 * s, octaves: 2, dark: '#7d7a73', light: '#e2ded5', amount: 0.4, step: 1 });
    mottle(g, w, h, rng.fork('b'), { scale: 260 * s, dark: '#6d6a63', light: '#d4d0c7', amount: 0.35, step: 4 });
    g.strokeStyle = 'rgba(40,38,34,0.6)'; g.lineWidth = 5 * s;
    for (const x of [w * 0.02, w * 0.98]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (const y of [h * 0.02, h * 0.98]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // a hairline crack
    g.lineWidth = 1.6 * s; g.strokeStyle = 'rgba(30,28,25,0.5)'; g.beginPath();
    let x = w * rng.range(0.6, 0.9), y = 0; g.moveTo(x, y);
    while (y < h * 0.4) { x += rng.range(-14, 10) * s; y += rng.range(10, 24) * s; g.lineTo(x, y); }
    g.stroke();
    grain(g, w, h, seed, { alpha: 36 });
    return { base, shade: null, region: { x: w * 0.1, y: h * 0.12, w: w * 0.8, h: h * 0.76 }, porous: 0.5 };
  }
  if (kind === 'sand') {
    const base = solid(w, h, '#d9c29a');
    const g = ctx2d(base);
    mottle(g, w, h, rng.fork('a'), { scale: 3 * s, octaves: 2, dark: '#9c8358', light: '#f6e6c4', amount: 0.55, contrast: 2.2, step: 1 });
    // wind ripples
    const ripples = noiseField(w, h, { scale: 160 * s, octaves: 2, rng: rng.fork('r'), step: 3 });
    const rl = fieldToCanvas(ripples, w, h, (v, x, y) => {
      const t = Math.sin((y / (16 * s)) + v * 18);
      return t > 0 ? [255, 245, 220, t * 40] : [90, 70, 40, -t * 50];
    });
    g.drawImage(rl, 0, 0);
    speckle(g, w, h, rng.fork('s'), { count: Math.round(w * h / 500), color: '#5a4630', alpha: 0.35, size: [0.4 * s, 1.2 * s] });
    grain(g, w, h, seed, { alpha: 40 });
    return { base, shade: null, region: { x: w * 0.1, y: h * 0.12, w: w * 0.8, h: h * 0.76 }, porous: 0.4, impressDepth: 1 };
  }
  // snow
  const base = solid(w, h, '#eef3f7');
  const g = ctx2d(base);
  mottle(g, w, h, rng.fork('a'), { scale: 220 * s, dark: '#b7c6d6', light: '#ffffff', amount: 0.55, step: 4 });
  mottle(g, w, h, rng.fork('b'), { scale: 8 * s, octaves: 2, dark: '#c9d5e2', light: '#ffffff', amount: 0.35, step: 2 });
  speckle(g, w, h, rng.fork('sp'), { count: Math.round(w * h / 600), color: '#ffffff', alpha: 0.9, size: [0.4 * s, 1.2 * s] });
  grain(g, w, h, seed, { alpha: 12 });
  return { base, shade: null, region: { x: w * 0.1, y: h * 0.12, w: w * 0.8, h: h * 0.76 }, porous: 0.2, impressDepth: 1.4 };
}

/** Foggy window with a blurred scene behind it. */
export function fogWindow({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const night = p.night !== false;
  const under = createCanvas(w, h);
  const ug = ctx2d(under);
  const gr = ug.createLinearGradient(0, 0, 0, h);
  if (night) { gr.addColorStop(0, '#0b1426'); gr.addColorStop(1, '#1d1a2a'); } else { gr.addColorStop(0, '#9fb7c9'); gr.addColorStop(1, '#5f6f62'); }
  ug.fillStyle = gr; ug.fillRect(0, 0, w, h);
  const lights = night ? ['#ffb347', '#ff6b6b', '#7ec8ff', '#fff2b0', '#ffd27e'] : ['#e8eef0', '#bccad1', '#7d8c6a', '#c9b48a'];
  for (let i = 0; i < (night ? 60 : 25); i++) {
    ug.globalAlpha = rng.range(0.3, 0.9);
    ug.fillStyle = rng.pick(lights);
    ug.beginPath(); ug.arc(rng() * w, h * rng.range(0.3, 0.95), rng.range(10, 50) * s, 0, 7); ug.fill();
  }
  ug.globalAlpha = 1;
  const underB = blurCanvas(under, 18 * s);
  const base = createCanvas(w, h);
  const g = ctx2d(base);
  g.drawImage(underB, 0, 0);
  // fog: milky veil + condensation droplets
  g.fillStyle = night ? 'rgba(170,180,195,0.62)' : 'rgba(225,232,236,0.7)'; g.fillRect(0, 0, w, h);
  mottle(g, w, h, rng.fork('f'), { scale: 180 * s, dark: '#8a96a6', light: '#f4f7fa', amount: 0.3, step: 4 });
  for (let i = 0; i < w * h / 900; i++) {
    const x = rng() * w, y = rng() * h, r = rng.range(0.8, 3.2) * s;
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.arc(x + r * 0.3, y + r * 0.3, r * 0.6, 0, 7); g.fill();
  }
  // a few drip trails
  const sharpUnder = blurCanvas(under, 4 * s);
  g.save();
  for (let i = 0; i < 6; i++) {
    const x = rng() * w, y0 = rng() * h * 0.6, len = rng.range(0.1, 0.35) * h;
    g.beginPath(); g.rect(x, y0, rng.range(3, 7) * s, len); g.clip();
  }
  g.drawImage(sharpUnder, 0, 0);
  g.restore();
  // window frame mullion
  return { base, under: sharpUnder, shade: null, region: { x: w * 0.08, y: h * 0.1, w: w * 0.84, h: h * 0.8 }, wipe: true, dark: night };
}

export function poster({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const pal = p.palette || ['#e94f37', '#f6f0e1', '#1c3144'];
  let base = solid(w, h, pal[1]);
  const g = ctx2d(base);
  // bold graphic shapes + halftone
  g.fillStyle = pal[0]; g.beginPath(); g.arc(w * 0.72, h * 0.26, w * 0.32, 0, 7); g.fill();
  g.fillStyle = pal[2]; g.fillRect(0, h * 0.78, w, h * 0.22);
  g.save(); g.fillStyle = pal[2]; g.globalAlpha = 0.6;
  const step = 14 * s;
  for (let y = 0; y < h * 0.78; y += step) for (let x = 0; x < w; x += step) {
    const r = Math.max(0, (y / (h * 0.78)) * step * 0.42 - (x / w) * step * 0.1);
    if (r > 0.3) { g.beginPath(); g.arc(x + (y / step % 2) * step / 2, y, r, 0, 7); g.fill(); }
  }
  g.restore();
  mottle(g, w, h, rng.fork('age'), { scale: 200 * s, dark: '#6a4a20', light: '#fff8e8', amount: 0.25 + (p.age ?? 0.3) * 0.3, step: 4 });
  speckle(g, w, h, rng.fork('sc'), { count: Math.round(w * h / 1400), color: '#ffffff', alpha: 0.5, size: [0.5 * s, 2.4 * s] });
  grain(g, w, h, seed, { alpha: 40 });
  base = clipCanvas(base, tornRectPath(w, h, rng.fork('t'), { sides: { top: false, right: true, bottom: true, left: false }, depth: 10 * s, inset: 2 * s }));
  const [sh, sg] = shadeLayer(w, h);
  const relief = crumpleRelief(w, h, rng.fork('c'), { intensity: 0.3, folds: 2, creases: 6 });
  sg.drawImage(relief.shade, 0, 0);
  return { base, shade: sh, shadeMode: 'overlay', region: { x: w * 0.08, y: h * 0.16, w: w * 0.84, h: h * 0.56 } };
}

export function mapSheet({ w, h, rng, seed }) {
  const s = w / 1000;
  const base = solid(w, h, '#efe6cf');
  const g = ctx2d(base);
  // water body
  const water = noiseField(w, h, { scale: 380 * s, octaves: 3, rng: rng.fork('w'), step: 4 });
  const contours = fieldToCanvas(water, w, h, (v) => {
    if (v < 0.4) return [156, 196, 214, 200];
    const band = (v * 30) % 1;
    if (band < 0.06) return [150, 110, 60, 110];
    return [0, 0, 0, 0];
  });
  g.drawImage(contours, 0, 0);
  // grid & roads
  g.save(); g.strokeStyle = 'rgba(120,100,70,0.35)'; g.lineWidth = 1 * s;
  for (let x = 0; x < w; x += w / 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += w / 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.strokeStyle = 'rgba(200,60,40,0.7)'; g.lineWidth = 4 * s; g.beginPath();
  let x = 0, y = h * rng.range(0.2, 0.8); g.moveTo(x, y);
  while (x < w) { x += 60 * s; y += rng.range(-40, 40) * s; g.lineTo(x, y); }
  g.stroke(); g.restore();
  mottle(g, w, h, rng.fork('age'), { scale: 200 * s, dark: '#8a6a3a', light: '#fff6e0', amount: 0.3, step: 4 });
  grain(g, w, h, seed, { alpha: 30 });
  const [sh, sg] = shadeLayer(w, h);
  const relief = crumpleRelief(w, h, rng.fork('f'), { intensity: 0.5, folds: 4, creases: 0 });
  sg.drawImage(relief.shade, 0, 0);
  return { base, shade: sh, shadeMode: 'overlay', region: { x: w * 0.1, y: h * 0.12, w: w * 0.8, h: h * 0.76 } };
}

export function magazine({ w, h, rng, seed }) {
  const s = w / 1000;
  let base = solid(w, h, '#f4f1ec');
  const g = ctx2d(base);
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, '#ff5d8f'); gr.addColorStop(1, '#ffb36b');
  g.fillStyle = gr; g.fillRect(0, 0, w, h * 0.22);
  proseBars(g, w * 0.06, h * 0.82, w * 0.88, h * 0.14, rng.fork('p'), { lineH: 12 * s, color: '#222', alpha: 0.35 });
  const sheen = g.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); sheen.addColorStop(0.6, 'rgba(255,255,255,0.4)'); sheen.addColorStop(0.7, 'rgba(255,255,255,0)');
  g.fillStyle = sheen; g.fillRect(0, 0, w, h);
  grain(g, w, h, seed, { alpha: 14 });
  // scissor-cut irregular polygon
  const path = new Path2D();
  const pts = [[0.02, 0.04], [0.97, 0.0], [1.0, 0.55], [0.96, 0.98], [0.04, 1.0], [0.0, 0.5]];
  pts.forEach(([px, py], i) => { const X = (px + rng.range(-0.015, 0.015)) * w, Y = (py + rng.range(-0.015, 0.015)) * h; i ? path.lineTo(X, Y) : path.moveTo(X, Y); });
  path.closePath();
  base = clipCanvas(base, path);
  return { base, shade: null, region: { x: w * 0.08, y: h * 0.28, w: w * 0.84, h: h * 0.5 }, glossy: true };
}

/** Projection: a dark wall lit by a projector, the writing is light. */
export function projection({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const base = solid(w, h, '#15161a');
  const g = ctx2d(base);
  mottle(g, w, h, rng.fork('w'), { scale: 40 * s, octaves: 3, dark: '#000000', light: '#3a3b40', amount: 0.4, step: 2 });
  const beam = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.65);
  const tint = p.tint || '255,244,220';
  beam.addColorStop(0, `rgba(${tint},0.32)`); beam.addColorStop(0.7, `rgba(${tint},0.12)`); beam.addColorStop(1, `rgba(${tint},0)`);
  g.fillStyle = beam; g.fillRect(0, 0, w, h);
  grain(g, w, h, seed, { alpha: 30 });
  return { base, shade: null, region: { x: w * 0.12, y: h * 0.18, w: w * 0.76, h: h * 0.64 }, dark: true, emissive: true };
}

export { roundRectPath };
