// Environments: the world around a surface for in-context and angled shots.
// Each renders a full-frame background. Most reuse surface generators at low
// resolution and blur them, which reads as photographic depth of field.
import { createCanvas, ctx2d, blurCanvas, makeRng, shade as tone } from './util.js';
import { mottle, grain, speckle, solid } from './paint.js';
import { wood, concrete, brick, stucco } from './surfaces/walls.js';
import { fabric, ground } from './surfaces/objects.js';

function viaGen(gen, p, blur = 1.5) {
  return ({ w, h, rng, seed }) => {
    const sw = Math.round(w / 2), sh = Math.round(h / 2);
    const r = gen({ w: sw, h: sh, rng, seed, p });
    const c = createCanvas(w, h);
    const g = ctx2d(c);
    g.imageSmoothingQuality = 'high';
    g.drawImage(blurCanvas(r.base, blur), 0, 0, w, h);
    if (r.shade) { g.globalCompositeOperation = 'overlay'; g.drawImage(r.shade, 0, 0, w, h); g.globalCompositeOperation = 'source-over'; }
    return c;
  };
}

function marble({ w, h, rng, seed }) {
  const c = solid(w, h, '#efedea');
  const g = ctx2d(c);
  mottle(g, w, h, rng.fork('m'), { scale: w * 0.3, dark: '#b9b6b0', light: '#ffffff', amount: 0.35, step: 5 });
  g.save(); g.strokeStyle = 'rgba(110,105,100,0.35)'; g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    g.lineWidth = rng.range(0.6, 2.5) * w / 1000;
    g.beginPath(); let x = rng() * w, y = rng() * h; g.moveTo(x, y);
    for (let k = 0; k < 14; k++) { x += rng.range(-40, 90) * w / 1000; y += rng.range(-30, 60) * w / 1000; g.lineTo(x, y); }
    g.stroke();
  }
  g.restore();
  grain(g, w, h, seed, { alpha: 14 });
  // a coffee cup just out of frame
  const cx = w * rng.pick([0.08, 0.92]), cy = h * rng.range(0.1, 0.25), r = w * 0.16;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = w * 0.03; g.shadowOffsetY = w * 0.01;
  g.fillStyle = '#fafafa'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.restore();
  g.fillStyle = '#3b2416'; g.beginPath(); g.arc(cx, cy, r * 0.78, 0, 7); g.fill();
  g.fillStyle = 'rgba(210,170,120,0.6)'; g.beginPath(); g.arc(cx - r * 0.1, cy - r * 0.05, r * 0.4, 0, 7); g.fill();
  return blurCanvas(c, w * 0.002);
}

function wall2tone({ w, h, rng, seed, p }) {
  const c = createCanvas(w, h);
  const g = ctx2d(c);
  const split = p.split ?? 0.72;
  g.fillStyle = p.top; g.fillRect(0, 0, w, h * split);
  g.fillStyle = p.bottom; g.fillRect(0, h * split, w, h * (1 - split));
  mottle(g, w, h, rng.fork('w'), { scale: w * 0.25, dark: tone(p.top, -0.3), light: '#ffffff', amount: 0.18, step: 6 });
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h * split, w, h * 0.012);
  grain(g, w, h, seed, { alpha: 16 });
  return blurCanvas(c, w * 0.003);
}

function sky(g, w, h, top, bottom, upto) {
  const gr = g.createLinearGradient(0, 0, 0, h * upto);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, w, h * upto);
}

function street({ w, h, rng, seed, p }) {
  const c = createCanvas(w, h);
  const g = ctx2d(c);
  const horizon = p.horizon ?? 0.3;
  sky(g, w, h, p.night ? '#0d1530' : '#7fa9cf', p.night ? '#3a2f4a' : '#dfe9ef', horizon + 0.05);
  // distant buildings silhouette
  g.fillStyle = p.night ? '#141826' : '#8f9aa3';
  let x = 0;
  while (x < w) { const bw = rng.range(0.06, 0.16) * w, bh = rng.range(0.05, 0.16) * h; g.fillRect(x, h * horizon - bh, bw, bh + 2); x += bw; }
  const gnd = ground({ w: Math.round(w / 2), h: Math.round(h / 2), rng: rng.fork('g'), seed, p: { kind: 'sidewalk' } }).base;
  g.drawImage(blurCanvas(gnd, 2), 0, h * horizon, w, h * (1 - horizon));
  const fog = g.createLinearGradient(0, h * horizon, 0, h);
  fog.addColorStop(0, 'rgba(200,210,215,0.5)'); fog.addColorStop(1, 'rgba(0,0,0,0.15)');
  g.fillStyle = fog; g.fillRect(0, h * horizon, w, h);
  return c;
}

function landscape({ w, h, rng, seed, p }) {
  const c = createCanvas(w, h);
  const g = ctx2d(c);
  const hz = p.horizon ?? 0.38;
  sky(g, w, h, p.skyTop, p.skyBottom, hz + 0.02);
  if (p.sea) { g.fillStyle = p.sea; g.fillRect(0, h * hz, w, h * 0.06); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, h * (hz + 0.055), w, h * 0.008); }
  const gr = ground({ w: Math.round(w / 2), h: Math.round(h / 2), rng: rng.fork('l'), seed, p: { kind: p.ground } }).base;
  g.drawImage(blurCanvas(gr, 3), 0, h * (hz + (p.sea ? 0.06 : 0)), w, h);
  return c;
}

function forest({ w, h, rng, seed }) {
  const c = solid(w, h, '#3b4a2c');
  const g = ctx2d(c);
  const cols = ['#5e7d3a', '#2a3a1e', '#9db55a', '#6b5233', '#cfe08a', '#23301a'];
  for (let i = 0; i < 70; i++) {
    g.globalAlpha = rng.range(0.3, 0.8); g.fillStyle = rng.pick(cols);
    g.beginPath(); g.arc(rng() * w, rng() * h, rng.range(0.02, 0.12) * w, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(40,28,18,0.7)'; g.fillRect(rng() * w, 0, rng.range(0.03, 0.08) * w, h); }
  const b = blurCanvas(c, w * 0.035);
  const bg = ctx2d(b);
  for (let i = 0; i < 25; i++) { bg.fillStyle = `rgba(255,250,210,${rng.range(0.1, 0.35)})`; bg.beginPath(); bg.arc(rng() * w, rng() * h * 0.6, rng.range(0.01, 0.04) * w, 0, 7); bg.fill(); }
  return b;
}

function nightBokeh({ w, h, rng }) {
  const c = createCanvas(w, h);
  const g = ctx2d(c);
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#070b16'); gr.addColorStop(1, '#1b1424');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {
    g.globalAlpha = rng.range(0.15, 0.6); g.fillStyle = rng.pick(['#ffb347', '#ff6b6b', '#7ec8ff', '#fff2b0']);
    g.beginPath(); g.arc(rng() * w, rng() * h, rng.range(0.01, 0.05) * w, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  return blurCanvas(c, w * 0.01);
}

function studio({ w, h, p }) {
  const c = createCanvas(w, h);
  const g = ctx2d(c);
  const col = p.color || '#d9d4cb';
  const gr = g.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.5, Math.hypot(w, h) * 0.6);
  gr.addColorStop(0, tone(col, 0.12)); gr.addColorStop(1, tone(col, -0.18));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  grain(g, w, h, 5, { alpha: 14 });
  return c;
}

function laptop({ w, h, rng, seed }) {
  const c = solid(w, h, '#c7cacd');
  const g = ctx2d(c);
  mottle(g, w, h, rng.fork('al'), { scale: w * 0.01, dark: '#a7abaf', light: '#e5e8ea', amount: 0.3, stretchX: 20, step: 2 });
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  grain(g, w, h, seed, { alpha: 10 });
  return c;
}

export const ENVIRONMENTS = {
  'desk-wood': { name: 'Wooden desk', render: viaGen(wood, { color: '#8a5a36', boards: 3 }, 2.5) },
  'desk-dark': { name: 'Dark walnut', render: viaGen(wood, { color: '#4a2f1d', boards: 3 }, 2.5) },
  'desk-concrete': { name: 'Concrete table', render: viaGen(concrete, { color: '#8f8c86', grime: 0 }, 2) },
  linen: { name: 'Linen', render: viaGen(fabric, { color: '#d8cfbf', weave: 5 }, 1.5) },
  marble: { name: 'Café table', render: marble },
  classroom: { name: 'Classroom', render: (o) => wall2tone({ ...o, p: { top: '#d8d2b8', bottom: '#7b5a3c', split: 0.86 } }) },
  office: { name: 'Office wall', render: (o) => wall2tone({ ...o, p: { top: '#e3e5e4', bottom: '#9a9c9a', split: 0.9 } }) },
  street: { name: 'Street', render: (o) => street({ ...o, p: {} }) },
  'street-night': { name: 'Street at night', render: (o) => street({ ...o, p: { night: true } }) },
  'wall-brick': { name: 'Brick wall', render: viaGen(brick, {}, 1.2) },
  'wall-concrete': { name: 'Concrete wall', render: viaGen(concrete, { formwork: true }, 1.2) },
  'wall-stucco': { name: 'Painted wall', render: viaGen(stucco, { color: '#d9c7a8' }, 1.2) },
  forest: { name: 'Forest', render: forest },
  beach: { name: 'Beach', render: (o) => landscape({ ...o, p: { skyTop: '#6fa3c8', skyBottom: '#e9f0ee', sea: '#3f7f98', ground: 'sand', horizon: 0.3 } }) },
  snowfield: { name: 'Snowfield', render: (o) => landscape({ ...o, p: { skyTop: '#a9bccc', skyBottom: '#eef2f4', ground: 'snow', horizon: 0.32 } }) },
  asphalt: { name: 'Asphalt', render: viaGen(ground, { kind: 'asphalt' }, 1.5) },
  night: { name: 'Night lights', render: nightBokeh },
  laptop: { name: 'Laptop lid', render: laptop },
  studio: { name: 'Studio backdrop', render: studio },
};

export function renderEnvironment(id, { w, h, seed = 1, p = {} }) {
  const env = ENVIRONMENTS[id] || ENVIRONMENTS.studio;
  const rng = makeRng(`${id}|${seed}`);
  return env.render({ w, h, rng, seed, p });
}

export { speckle };
