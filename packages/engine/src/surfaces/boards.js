// Boards and writing surfaces.
import { createCanvas, ctx2d, shade as tone, blurCanvas } from '../util.js';
import { solid, mottle, grain, speckle, fibers, edgeShade, roundRectPath } from '../paint.js';

function frame(g, w, h, s, { color = '#b9bec4', size = 26, wood = false } = {}) {
  const f = size * s;
  g.save();
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, tone(color, 0.25)); gr.addColorStop(0.5, color); gr.addColorStop(1, tone(color, -0.25));
  g.fillStyle = gr;
  g.fillRect(0, 0, w, f); g.fillRect(0, h - f, w, f); g.fillRect(0, 0, f, h); g.fillRect(w - f, 0, f, h);
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2 * s; g.strokeRect(f, f, w - 2 * f, h - 2 * f);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.strokeRect(1 * s, 1 * s, w - 2 * s, h - 2 * s);
  if (wood) {
    g.globalAlpha = 0.25; g.strokeStyle = '#3a2412'; g.lineWidth = 1 * s;
    for (let y = 0; y < h; y += 5 * s) { g.beginPath(); g.moveTo(0, y); g.lineTo(f, y + 3 * s); g.moveTo(w - f, y); g.lineTo(w, y + 3 * s); g.stroke(); }
  }
  g.restore();
  return f;
}

export function whiteboard({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const base = solid(w, h, '#f4f6f7');
  const g = ctx2d(base);
  // glossy sheen + ghosting from old marker
  const sheen = g.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, 'rgba(255,255,255,0.0)'); sheen.addColorStop(0.42, 'rgba(255,255,255,0.0)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.6)'); sheen.addColorStop(0.6, 'rgba(255,255,255,0.0)');
  g.fillStyle = sheen; g.fillRect(0, 0, w, h);
  const ghost = createCanvas(w, h);
  const gg = ctx2d(ghost);
  gg.strokeStyle = 'rgba(60,80,140,0.07)'; gg.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    gg.lineWidth = rng.range(6, 18) * s;
    gg.beginPath();
    let x = rng() * w, y = rng() * h; gg.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += rng.range(-80, 80) * s; y += rng.range(-30, 30) * s; gg.lineTo(x, y); }
    gg.stroke();
  }
  g.drawImage(blurCanvas(ghost, 8 * s), 0, 0);
  mottle(g, w, h, rng.fork('w'), { scale: 260 * s, dark: '#c8cdd2', light: '#ffffff', amount: 0.25, step: 5 });
  grain(g, w, h, seed, { alpha: 10 });
  let region = { x: w * 0.08, y: h * 0.1, w: w * 0.84, h: h * 0.74 };
  if (p.frame !== false) {
    const f = frame(g, w, h, s, { color: '#c4c9cf' });
    // marker tray
    g.save(); g.fillStyle = '#9aa0a7'; g.fillRect(w * 0.1, h - f - 4 * s, w * 0.8, f * 0.9); g.restore();
    region = { x: f + w * 0.06, y: f + h * 0.07, w: w - 2 * f - w * 0.12, h: h - 2 * f - h * 0.16 };
  }
  return { base, shade: null, region };
}

export function chalkboard({ w, h, rng, seed, p }) {
  const s = w / 1000;
  const color = p.color || '#2f3a34';
  const base = solid(w, h, color);
  const g = ctx2d(base);
  mottle(g, w, h, rng.fork('c'), { scale: 240 * s, dark: tone(color, -0.4), light: tone(color, 0.18), amount: 0.4, step: 4 });
  // eraser haze: broad sweeping smears of chalk dust
  const haze = createCanvas(w, h);
  const hg = ctx2d(haze);
  hg.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    hg.strokeStyle = `rgba(230,235,230,${rng.range(0.04, 0.1)})`;
    hg.lineWidth = rng.range(40, 120) * s;
    hg.beginPath();
    const y = rng() * h, x = rng() * w * 0.3;
    hg.moveTo(x, y);
    hg.bezierCurveTo(x + w * 0.3, y + rng.range(-60, 60) * s, x + w * 0.5, y + rng.range(-60, 60) * s, x + w * rng.range(0.5, 0.9), y + rng.range(-40, 40) * s);
    hg.stroke();
  }
  g.drawImage(blurCanvas(haze, 14 * s), 0, 0);
  speckle(g, w, h, rng.fork('d'), { count: Math.round(w * h / 1500), color: '#e8ece6', alpha: 0.18, size: [0.4 * s, 1.2 * s] });
  grain(g, w, h, seed, { alpha: 30 });
  let region = { x: w * 0.08, y: h * 0.1, w: w * 0.84, h: h * 0.78 };
  if (p.frame !== false) {
    const f = frame(g, w, h, s, { color: '#8a6440', size: 34, wood: true });
    region = { x: f + w * 0.06, y: f + h * 0.08, w: w - 2 * f - w * 0.12, h: h - 2 * f - h * 0.16 };
  }
  return { base, shade: null, region, dark: true };
}

export function glassboard({ w, h, rng, seed }) {
  const s = w / 1000;
  const base = createCanvas(w, h);
  const g = ctx2d(base);
  // office seen through/behind frosted glass: soft blurred blocks
  const bg = createCanvas(w, h);
  const bgg = ctx2d(bg);
  const gr = bgg.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#dfe7ea'); gr.addColorStop(1, '#b9c6cb');
  bgg.fillStyle = gr; bgg.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) {
    bgg.fillStyle = rng.pick(['#8ca0a8', '#e9eef0', '#6f8189', '#c9b79a', '#a7c4b5']);
    bgg.globalAlpha = 0.6; bgg.fillRect(rng() * w, h * rng.range(0.3, 0.8), rng.range(60, 260) * s, rng.range(80, 400) * s);
  }
  g.drawImage(blurCanvas(bg, 24 * s), 0, 0);
  g.fillStyle = 'rgba(240,248,250,0.55)'; g.fillRect(0, 0, w, h);
  const sheen = g.createLinearGradient(0, 0, w, h * 0.6);
  sheen.addColorStop(0.3, 'rgba(255,255,255,0)'); sheen.addColorStop(0.45, 'rgba(255,255,255,0.45)'); sheen.addColorStop(0.55, 'rgba(255,255,255,0)');
  g.fillStyle = sheen; g.fillRect(0, 0, w, h);
  grain(g, w, h, seed, { alpha: 8 });
  // standoff bolts
  for (const [x, y] of [[0.04, 0.05], [0.96, 0.05], [0.04, 0.95], [0.96, 0.95]]) {
    const rg = g.createRadialGradient(w * x - 3 * s, h * y - 3 * s, 1, w * x, h * y, 14 * s);
    rg.addColorStop(0, '#ffffff'); rg.addColorStop(1, '#8a9399');
    g.fillStyle = rg; g.beginPath(); g.arc(w * x, h * y, 12 * s, 0, 7); g.fill();
  }
  return { base, shade: null, region: { x: w * 0.1, y: h * 0.12, w: w * 0.8, h: h * 0.74 }, glossy: true };
}

export function corkboard({ w, h, rng, seed }) {
  const s = w / 1000;
  const base = solid(w, h, '#b88a58');
  const g = ctx2d(base);
  mottle(g, w, h, rng.fork('c1'), { scale: 10 * s, octaves: 2, dark: '#6d4a26', light: '#e2b985', amount: 0.55, contrast: 2.4, step: 1 });
  speckle(g, w, h, rng.fork('c2'), { count: Math.round(w * h / 400), color: '#4a2f14', alpha: 0.35, size: [0.6 * s, 2.2 * s] });
  mottle(g, w, h, rng.fork('c3'), { scale: 250 * s, dark: '#5d3b1a', light: '#d8ad78', amount: 0.25, step: 5 });
  const f = frame(g, w, h, s, { color: '#9b7650', size: 28, wood: true });
  // a few pinned scraps around the edges
  for (let i = 0; i < 4; i++) {
    const cw = rng.range(80, 160) * s, ch = rng.range(90, 140) * s;
    const x = rng.pick([f + 20 * s, w - f - cw - 20 * s]), y = f + rng() * (h - 2 * f - ch);
    g.save(); g.translate(x + cw / 2, y + ch / 2); g.rotate(rng.range(-0.15, 0.15));
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 6 * s; g.shadowOffsetY = 3 * s;
    g.fillStyle = rng.pick(['#fff7b0', '#ffffff', '#c7e6f5', '#f7c6c6']); g.fillRect(-cw / 2, -ch / 2, cw, ch);
    g.shadowColor = 'transparent';
    g.fillStyle = rng.pick(['#d33', '#36c', '#3a3']); g.beginPath(); g.arc(0, -ch / 2 + 10 * s, 6 * s, 0, 7); g.fill();
    g.restore();
  }
  // central card that will carry the writing
  const cw = w * 0.56, ch = h * 0.5, cx = (w - cw) / 2, cy = (h - ch) / 2;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 12 * s; g.shadowOffsetY = 5 * s;
  g.fillStyle = '#fbfaf5'; g.fillRect(cx, cy, cw, ch); g.restore();
  g.save(); g.strokeStyle = '#8fb1da'; g.globalAlpha = 0.5; g.lineWidth = 1.4 * s;
  for (let y = cy + ch * 0.2; y < cy + ch - 10 * s; y += 30 * s) { g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + cw, y); g.stroke(); }
  g.restore();
  grain(g, w, h, seed, { alpha: 18 });
  // pushpin
  const pin = g.createRadialGradient(w / 2 - 4 * s, cy + 10 * s, 1, w / 2, cy + 14 * s, 13 * s);
  pin.addColorStop(0, '#ff8a80'); pin.addColorStop(1, '#a01818');
  g.fillStyle = pin; g.beginPath(); g.arc(w / 2, cy + 14 * s, 12 * s, 0, 7); g.fill();
  return { base, shade: null, region: { x: cx + cw * 0.08, y: cy + ch * 0.14, w: cw * 0.84, h: ch * 0.78 }, clipToRegion: true };
}

export function foamboard({ w, h, rng, seed }) {
  const s = w / 1000;
  const base = solid(w, h, '#fbfbf8');
  const g = ctx2d(base);
  mottle(g, w, h, rng.fork('f'), { scale: 300 * s, dark: '#d9d9d2', light: '#ffffff', amount: 0.3, step: 5 });
  grain(g, w, h, seed, { alpha: 10 });
  g.save(); g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 6 * s; g.strokeRect(3 * s, 3 * s, w - 6 * s, h - 6 * s); g.restore();
  // accent stripe like a presentation board header
  g.fillStyle = '#20406a'; g.fillRect(0, 0, w, h * 0.06);
  const sh = createCanvas(w, h); const sg = ctx2d(sh); sg.fillStyle = 'rgb(128,128,128)'; sg.fillRect(0, 0, w, h);
  edgeShade(sg, w, h, { strength: 0.12 });
  return { base, shade: sh, shadeMode: 'overlay', region: { x: w * 0.09, y: h * 0.12, w: w * 0.82, h: h * 0.78 } };
}

export { frame, roundRectPath, fibers };
