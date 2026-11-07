// Paper & stationery generators.
import { createCanvas, ctx2d, shade as tone, blurCanvas } from '../util.js';
import { solid, mottle, grain, fibers, speckle, stainRing, tornRectPath, roundRectPath, clipCanvas, edgeShade, crumpleRelief, proseBars } from '../paint.js';

export function paper({ w, h, rng, p, seed }) {
  const s = w / 1000;
  const color = p.color || '#f7f5ee';
  let base = solid(w, h, color);
  let g = ctx2d(base);

  // paper body texture
  mottle(g, w, h, rng.fork('m1'), { scale: 220 * s, dark: tone(color, -0.35), light: '#ffffff', amount: 0.10 + (p.age || 0) * 0.25, step: 4 });
  if (p.age) {
    mottle(g, w, h, rng.fork('age'), { scale: 90 * s, dark: '#8a5a20', light: color, amount: p.age * 0.22, contrast: 2.2, step: 4 });
  }
  fibers(g, w, h, rng.fork('fib'), { count: Math.round((p.fibers ?? 500) * (w * h) / 1e6), color: tone(color, -0.5), alpha: 0.06 });
  if (p.texture === 'laid') {
    g.save(); g.globalAlpha = 0.05; g.fillStyle = '#5a4020';
    for (let y = 0; y < h; y += 4 * s) g.fillRect(0, y, w, 1.2 * s);
    g.restore();
  }
  if (p.texture === 'emboss') {
    // napkin quilting
    g.save(); g.globalAlpha = 0.07; g.strokeStyle = '#000'; g.lineWidth = 1.5 * s;
    const step = 46 * s;
    for (let x = -h; x < w; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); }
    for (let x = 0; x < w + h; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x - h, h); g.stroke(); }
    g.restore();
    g.save(); g.globalAlpha = 0.12; g.strokeStyle = '#000'; g.lineWidth = 2 * s;
    const m = 60 * s; g.setLineDash([3 * s, 5 * s]);
    g.strokeRect(m, m, w - 2 * m, h - 2 * m); g.restore();
  }
  if (p.texture === 'kraft') {
    mottle(g, w, h, rng.fork('k'), { scale: 18 * s, octaves: 2, dark: '#3a2510', light: '#e8c99a', amount: 0.12, step: 2 });
    speckle(g, w, h, rng.fork('ks'), { count: Math.round(w * h / 3000), color: '#3a2510', alpha: 0.25, size: [0.4 * s, 1.4 * s] });
  }
  grain(g, w, h, seed, { alpha: 22, op: 'overlay' });

  // margins & lines
  let region = { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.8 };
  let rules = null;
  const lc = p.lineColor || '#7fa6d6';
  const lineGap = (p.lineGap || 34) * s;
  if (p.lines === 'ruled' || p.lines === 'index') {
    const top = p.lines === 'index' ? lineGap * 2.2 : (p.topMargin ?? 110) * s;
    g.save();
    g.strokeStyle = lc; g.globalAlpha = 0.55; g.lineWidth = 1.6 * s;
    for (let y = top; y < h - lineGap * 0.3; y += lineGap) {
      g.beginPath(); g.moveTo(0, y + rng.range(-0.4, 0.4)); g.lineTo(w, y); g.stroke();
    }
    if (p.lines === 'index') {
      g.strokeStyle = '#d9605c'; g.globalAlpha = 0.7; g.lineWidth = 2.2 * s;
      g.beginPath(); g.moveTo(0, top - lineGap * 0.0); g.lineTo(w, top); g.stroke();
    }
    g.restore();
    const left = p.marginLine ? (p.marginX ?? 150) * s : w * 0.08;
    if (p.marginLine) {
      g.save(); g.strokeStyle = '#e07a7a'; g.globalAlpha = 0.6; g.lineWidth = 1.8 * s;
      g.beginPath(); g.moveTo(left - 14 * s, 0); g.lineTo(left - 14 * s, h); g.stroke();
      g.restore();
    }
    rules = { spacing: lineGap, first: top + lineGap, left: left + 6 * s, right: w - w * 0.07 };
    region = { x: left + 6 * s, y: top + lineGap * 0.15, w: w - left - w * 0.08, h: h - top - lineGap * 1.5 };
  } else if (p.lines === 'graph' || p.lines === 'dots') {
    const step = (p.gridGap || 30) * s;
    g.save(); g.strokeStyle = lc; g.fillStyle = lc;
    if (p.lines === 'graph') {
      for (let x = 0; x < w; x += step) { g.globalAlpha = (Math.round(x / step) % 5 === 0) ? 0.45 : 0.22; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 0; y < h; y += step) { g.globalAlpha = (Math.round(y / step) % 5 === 0) ? 0.45 : 0.22; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    } else {
      g.globalAlpha = 0.5;
      for (let x = step; x < w; x += step) for (let y = step; y < h; y += step) { g.beginPath(); g.arc(x, y, 1.6 * s, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
    region = { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.8 };
  } else if (p.lines === 'receipt') {
    // thermal receipt: header bars, dashed separators, total bars (no real characters)
    const m = w * 0.1;
    g.save(); g.fillStyle = '#3b3b3b'; g.globalAlpha = 0.65;
    g.fillRect(w * 0.3, h * 0.05, w * 0.4, 14 * s);
    g.globalAlpha = 0.35; g.fillRect(w * 0.22, h * 0.05 + 26 * s, w * 0.56, 8 * s); g.fillRect(w * 0.28, h * 0.05 + 42 * s, w * 0.44, 8 * s);
    g.setLineDash([6 * s, 6 * s]); g.strokeStyle = '#555'; g.globalAlpha = 0.5; g.lineWidth = 2 * s;
    const sep1 = h * 0.05 + 70 * s, sep2 = h * 0.82;
    for (const y of [sep1, sep2]) { g.beginPath(); g.moveTo(m, y); g.lineTo(w - m, y); g.stroke(); }
    g.setLineDash([]); g.globalAlpha = 0.45;
    for (let i = 0; i < 3; i++) { const y = sep2 + 20 * s + i * 22 * s; g.fillRect(m, y, w * 0.3, 8 * s); g.fillRect(w - m - w * 0.16, y, w * 0.16, 8 * s); }
    // barcode
    let bx = w * 0.2; const by = h * 0.93;
    while (bx < w * 0.8) { const bw = rng.range(1, 5) * s; g.globalAlpha = 0.6; g.fillRect(bx, by, bw, 34 * s); bx += bw + rng.range(1, 4) * s; }
    g.restore();
    // thermal fade
    mottle(g, w, h, rng.fork('th'), { scale: 300 * s, dark: '#c9c2b0', light: '#ffffff', amount: 0.25, step: 4 });
    region = { x: m, y: sep1 + 20 * s, w: w - 2 * m, h: sep2 - sep1 - 40 * s };
  } else if (p.lines === 'news') {
    // masthead rule, headline-ish bars, columns of faux prose around a clear text box
    const m = w * 0.06;
    g.save(); g.fillStyle = '#1e1e1e';
    g.globalAlpha = 0.85; g.fillRect(m, h * 0.035, w - 2 * m, 3 * s); g.fillRect(m, h * 0.035 + 7 * s, w - 2 * m, 1.2 * s);
    g.restore();
    const boxTop = h * 0.08, boxH = h * 0.5;
    const cols = 3, gap = 18 * s, cw = (w - 2 * m - gap * (cols - 1)) / cols;
    for (let c = 0; c < cols; c++) {
      proseBars(g, m + c * (cw + gap), boxTop + boxH + 24 * s, cw, h - boxTop - boxH - 60 * s, rng.fork('c' + c), { lineH: 13 * s, color: '#2a2a2a', alpha: 0.42 });
      if (c > 0) { g.save(); g.fillStyle = '#333'; g.globalAlpha = 0.35; g.fillRect(m + c * (cw + gap) - gap / 2, boxTop + boxH + 24 * s, 1 * s, h - boxTop - boxH - 60 * s); g.restore(); }
    }
    g.save(); g.fillStyle = '#222'; g.globalAlpha = 0.6; g.fillRect(m, boxTop + boxH + 6 * s, w - 2 * m, 1.6 * s); g.restore();
    region = { x: m, y: boxTop, w: w - 2 * m, h: boxH };
  } else if (p.lines === 'book') {
    const m = w * 0.13;
    // running head + folio as tiny bars, faux prose above and below the text block
    g.save(); g.fillStyle = '#333'; g.globalAlpha = 0.35; g.fillRect(w * 0.42, h * 0.05, w * 0.16, 6 * s); g.fillRect(w * 0.48, h * 0.95, w * 0.04, 6 * s); g.restore();
    proseBars(g, m, h * 0.1, w - 2 * m, h * 0.12, rng.fork('b1'), { lineH: 15 * s, color: '#2b2b2b', alpha: 0.32 });
    proseBars(g, m, h * 0.76, w - 2 * m, h * 0.15, rng.fork('b2'), { lineH: 15 * s, color: '#2b2b2b', alpha: 0.32 });
    region = { x: m, y: h * 0.27, w: w - 2 * m, h: h * 0.44 };
  } else if (p.lines === 'envelope') {
    g.save(); g.strokeStyle = tone(color, -0.25); g.globalAlpha = 0.5; g.lineWidth = 2 * s;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w / 2, h * 0.52); g.lineTo(w, 0); g.stroke();
    g.globalAlpha = 0.25; g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.42, h * 0.48); g.moveTo(w, h); g.lineTo(w * 0.58, h * 0.48); g.stroke();
    // stamp box
    g.globalAlpha = 0.45; g.setLineDash([4 * s, 3 * s]); g.strokeStyle = '#b44'; g.strokeRect(w * 0.82, h * 0.08, w * 0.12, w * 0.14);
    g.restore();
    region = { x: w * 0.12, y: h * 0.56, w: w * 0.76, h: h * 0.36 };
  } else {
    const mx = (p.marginX ?? 100) * s;
    region = { x: mx, y: (p.topMargin ?? 100) * s, w: w - 2 * mx, h: h - 2 * (p.topMargin ?? 100) * s };
  }

  if (p.spiral) {
    g.save();
    for (let y = 40 * s; y < h - 20 * s; y += 36 * s) {
      g.fillStyle = 'rgba(0,0,0,0.65)'; g.beginPath(); g.arc(28 * s, y, 7 * s, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  if (p.holes) {
    for (const fy of [0.15, 0.5, 0.85]) {
      g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(44 * s, h * fy, 13 * s, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }
  if (p.stains) {
    stainRing(g, w * rng.range(0.6, 0.85), h * rng.range(0.65, 0.88), w * rng.range(0.12, 0.18), rng.fork('st'), '#8a5524', 0.12 + (p.age || 0) * 0.1);
  }

  // shading layer (drawn over text so ink follows the paper's relief)
  const shadeC = createCanvas(w, h);
  const sg = ctx2d(shadeC);
  sg.fillStyle = 'rgb(128,128,128)'; sg.fillRect(0, 0, w, h);
  let displace = null;
  if (p.crumple || p.folds) {
    const relief = crumpleRelief(w, h, rng.fork('cr'), { intensity: p.crumple || 0.35, folds: p.folds || 0, creases: p.crumple ? 22 : 0 });
    sg.drawImage(relief.shade, 0, 0);
    if (p.crumple) displace = relief.displace;
  }
  if (p.curl) {
    const gr = sg.createLinearGradient(w * 0.75, h * 0.75, w, h);
    gr.addColorStop(0, 'rgba(128,128,128,0)'); gr.addColorStop(1, 'rgba(60,60,60,0.6)');
    sg.fillStyle = gr; sg.fillRect(0, 0, w, h);
    // adhesive strip highlight on sticky notes
    const hg = sg.createLinearGradient(0, 0, 0, h * 0.18);
    hg.addColorStop(0, 'rgba(200,200,200,0.35)'); hg.addColorStop(1, 'rgba(128,128,128,0)');
    sg.fillStyle = hg; sg.fillRect(0, 0, w, h * 0.18);
  }
  if (p.gutter) {
    const gr = sg.createLinearGradient(0, 0, w * 0.18, 0);
    gr.addColorStop(0, 'rgba(40,40,40,0.75)'); gr.addColorStop(1, 'rgba(128,128,128,0)');
    sg.fillStyle = gr; sg.fillRect(0, 0, w * 0.18, h);
  }

  // shape
  let path = null;
  if (p.edge === 'torn-top') path = tornRectPath(w, h, rng.fork('tt'), { sides: { top: true }, depth: 12 * s, inset: 0 });
  else if (p.edge === 'torn-all') path = tornRectPath(w, h, rng.fork('ta'), { sides: { top: true, right: true, bottom: true, left: true }, depth: 16 * s, inset: 18 * s });
  else if (p.edge === 'deckle') path = tornRectPath(w, h, rng.fork('dk'), { sides: { top: true, right: true, bottom: true, left: true }, depth: 5 * s, inset: 6 * s });
  else if (p.edge === 'zigzag-bottom') {
    path = new Path2D(); path.moveTo(0, 0); path.lineTo(w, 0);
    const z = 14 * s; let x = w, up = true;
    path.lineTo(w, h - z);
    while (x > 0) { x -= z; path.lineTo(Math.max(0, x), up ? h : h - z); up = !up; }
    path.lineTo(0, h - z); path.closePath();
    // also top zigzag
    const top = new Path2D(); top.moveTo(0, z); x = 0; up = true;
    while (x < w) { x += z; top.lineTo(Math.min(w, x), up ? 0 : z); up = !up; }
    top.lineTo(w, h - z);
    x = w; up = true; while (x > 0) { x -= z; top.lineTo(Math.max(0, x), up ? h : h - z); up = !up; }
    top.closePath();
    path = top;
  } else if (p.corner) path = roundRectPath(0, 0, w, h, p.corner * s);
  if (path) base = clipCanvas(base, path);

  return { base, shade: shadeC, shadeMode: 'overlay', region, rules, displace, edgeShade: true };
}

/** Collage: several layered scraps of paper, text on the top scrap. */
export function collage({ w, h, rng, seed }) {
  const s = w / 1000;
  const base = createCanvas(w, h);
  const g = ctx2d(base);
  g.fillStyle = '#e9e4da'; g.fillRect(0, 0, w, h);
  grain(g, w, h, seed, { alpha: 30 });
  const colors = ['#d9473a', '#2c5a8c', '#f2c94c', '#1f1f1f', '#8fb39a', '#e8dcc6', '#c97b9c'];
  for (let i = 0; i < 9; i++) {
    const cw = w * rng.range(0.2, 0.55), ch = h * rng.range(0.12, 0.4);
    const scrap = createCanvas(cw, ch);
    const sg = ctx2d(scrap);
    const col = rng.pick(colors);
    sg.fillStyle = col; sg.fillRect(0, 0, cw, ch);
    if (rng.chance(0.45)) proseBars(sg, cw * 0.08, ch * 0.1, cw * 0.84, ch * 0.8, rng.fork('p' + i), { lineH: 11 * s, color: col === '#1f1f1f' ? '#ddd' : '#222', alpha: 0.4 });
    if (rng.chance(0.3)) { sg.globalAlpha = 0.25; for (let k = 0; k < cw; k += 8 * s) for (let j = 0; j < ch; j += 8 * s) { sg.beginPath(); sg.arc(k, j, 2.4 * s, 0, 7); sg.fillStyle = '#000'; sg.fill(); } sg.globalAlpha = 1; }
    const torn = clipCanvas(scrap, tornRectPath(cw, ch, rng.fork('t' + i), { sides: { top: rng.chance(0.6), right: rng.chance(0.6), bottom: rng.chance(0.6), left: rng.chance(0.6) }, depth: 9 * s, inset: 3 * s }));
    g.save();
    g.translate(rng() * w, rng() * h); g.rotate(rng.range(-0.4, 0.4));
    g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = 6 * s; g.shadowOffsetY = 2 * s;
    g.drawImage(torn, -cw / 2, -ch / 2);
    g.restore();
  }
  // the hero scrap for the writing
  const hw = w * 0.74, hh = h * 0.46;
  const hero = createCanvas(hw, hh);
  const hg = ctx2d(hero);
  hg.fillStyle = '#f6f1e3'; hg.fillRect(0, 0, hw, hh);
  grain(hg, hw, hh, seed + 3, { alpha: 30 });
  const heroT = clipCanvas(hero, tornRectPath(hw, hh, rng.fork('hero'), { sides: { top: true, right: true, bottom: true, left: true }, depth: 8 * s, inset: 5 * s }));
  g.save(); g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 10 * s; g.shadowOffsetY = 4 * s;
  g.drawImage(heroT, (w - hw) / 2, (h - hh) / 2); g.restore();
  // tape
  g.save(); g.globalAlpha = 0.55; g.fillStyle = '#f3ecc8';
  g.translate(w / 2 - hw * 0.42, h / 2 - hh / 2); g.rotate(-0.5); g.fillRect(-50 * s, -14 * s, 100 * s, 28 * s); g.restore();
  return { base, shade: null, region: { x: (w - hw) / 2 + hw * 0.08, y: (h - hh) / 2 + hh * 0.1, w: hw * 0.84, h: hh * 0.8 }, clipToRegion: true };
}

/** Old photograph print: soft "photo" in a white border, text written on the border-less print. */
export function photo({ w, h, rng, p, seed }) {
  const s = w / 1000;
  const base = createCanvas(w, h);
  const g = ctx2d(base);
  g.fillStyle = p.border || '#f3eee2'; g.fillRect(0, 0, w, h);
  const b = (p.borderSize ?? 50) * s;
  const bottomB = p.polaroid ? b * 3.4 : b;
  const iw = w - 2 * b, ih = h - b - bottomB;
  const img = createCanvas(iw, ih);
  const ig = ctx2d(img);
  // abstract landscape: sky, distant hills, field, sun; deliberately soft
  const sky = ig.createLinearGradient(0, 0, 0, ih);
  const pal = p.palette || ['#86a8c4', '#e7c9a0', '#9a8a5c', '#4d5a3a'];
  sky.addColorStop(0, pal[0]); sky.addColorStop(0.55, pal[1]); sky.addColorStop(0.56, pal[2]); sky.addColorStop(1, pal[3]);
  ig.fillStyle = sky; ig.fillRect(0, 0, iw, ih);
  ig.fillStyle = 'rgba(255,240,210,0.8)'; ig.beginPath(); ig.arc(iw * rng.range(0.2, 0.8), ih * 0.38, iw * 0.06, 0, 7); ig.fill();
  ig.fillStyle = 'rgba(60,70,60,0.55)';
  ig.beginPath(); ig.moveTo(0, ih * 0.56);
  for (let x = 0; x <= iw; x += iw / 12) ig.lineTo(x, ih * (0.5 + 0.05 * Math.sin(x / iw * 7 + rng() * 2)));
  ig.lineTo(iw, ih * 0.56); ig.closePath(); ig.fill();
  const soft = blurCanvas(img, 3 * s);
  const sgc = ctx2d(soft);
  mottle(sgc, iw, ih, rng.fork('ph'), { scale: 200 * s, dark: '#5a3a10', light: '#fff1d0', amount: 0.25, step: 4 });
  grain(sgc, iw, ih, seed, { alpha: 70, op: 'overlay' });
  // sepia/fade
  sgc.save(); sgc.globalCompositeOperation = 'color'; sgc.globalAlpha = p.sepia ?? 0.45; sgc.fillStyle = '#a07040'; sgc.fillRect(0, 0, iw, ih); sgc.restore();
  sgc.save(); sgc.globalAlpha = 0.2; sgc.fillStyle = '#fff6e6'; sgc.fillRect(0, 0, iw, ih); sgc.restore();
  if (p.lightLeak) {
    const lg = sgc.createRadialGradient(iw, 0, 0, iw, 0, iw * 0.8);
    lg.addColorStop(0, 'rgba(255,120,40,0.7)'); lg.addColorStop(1, 'rgba(255,120,40,0)');
    sgc.save(); sgc.globalCompositeOperation = 'screen'; sgc.fillStyle = lg; sgc.fillRect(0, 0, iw, ih); sgc.restore();
  }
  g.drawImage(soft, b, b);
  grain(g, w, h, seed + 1, { alpha: 20 });
  const region = p.polaroid
    ? { x: b, y: h - bottomB + bottomB * 0.12, w: iw, h: bottomB * 0.76 }
    : { x: b + iw * 0.08, y: b + ih * 0.08, w: iw * 0.84, h: ih * 0.84 };
  const shadeC = createCanvas(w, h);
  const sg = ctx2d(shadeC); sg.fillStyle = 'rgb(128,128,128)'; sg.fillRect(0, 0, w, h);
  edgeShade(sg, w, h, { strength: 0.18 });
  return { base, shade: shadeC, shadeMode: 'overlay', region };
}
