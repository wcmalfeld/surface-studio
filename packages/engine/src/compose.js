// The compositor. Keeps Scene, Typography and Material as independent cached
// layers and only merges them at the final render step.
import { createCanvas, ctx2d, cloneCanvas, makeRng, hashString, squareToQuad, meshWarp, blurCanvas, clamp, grainTile, fillPattern, luminance, shade as tone } from './util.js';
import { getSurface } from './surfaces/index.js';
import { renderEnvironment } from './env.js';
import { TREATMENT_MAP, defaultInk } from './treatments.js';
import { computeLayout, renderTypography } from './typography.js';
import { findEmphasis, wordCount, verifyLayout } from './layout.js';
import { applyMaterial, surfaceDetail } from './material.js';

// ---------------- caching ----------------
class LRU {
  constructor(max) { this.max = max; this.map = new Map(); }
  get(k) { const v = this.map.get(k); if (v !== undefined) { this.map.delete(k); this.map.set(k, v); } return v; }
  set(k, v) { this.map.set(k, v); if (this.map.size > this.max) this.map.delete(this.map.keys().next().value); return v; }
  clear() { this.map.clear(); }
}
const sceneCache = new LRU(24);
const envCache = new LRU(16);
const typoCache = new LRU(16);
const materialCache = new LRU(16);
export function clearCaches() { [sceneCache, envCache, typoCache, materialCache].forEach((c) => c.clear()); }
export const cacheStats = () => ({ scene: sceneCache.map.size, env: envCache.map.size, typo: typoCache.map.size, material: materialCache.map.size });

// ---------------- variations ----------------
export const RECIPES = {
  closeup: { label: 'Close-up', note: 'Tight on the surface' },
  context: { label: 'In context', note: 'The surface in its world' },
  angled: { label: 'Angled', note: 'Photographed at an angle' },
  minimal: { label: 'Editorial', note: 'Quiet, generous space' },
};

/** Four compositionally different takes on one surface. */
export function planVariations(surfaceId, seed = 1) {
  const s = getSurface(surfaceId);
  const rng = makeRng(`${surfaceId}|plan|${seed}`);
  const light = () => ({ angle: rng.range(-2.4, -0.7), strength: rng.range(0.35, 0.6), warmth: rng.range(-0.1, 0.25) });
  const sign = () => (rng() < 0.5 ? -1 : 1);
  const ruled = /ruled|index/.test(s.params?.lines || '');
  return [
    { recipe: 'closeup', seed: rng.int(1, 1e6), camera: { rz: rng.range(-2.5, 2.5), overscan: rng.range(1.04, 1.14), cx: rng.range(-0.02, 0.02), cy: rng.range(-0.02, 0.02) }, lighting: light(), layout: { align: ruled ? 'left' : 'center' } },
    { recipe: 'context', seed: rng.int(1, 1e6), camera: { rz: rng.range(-7, 7), scale: rng.range(0.66, 0.78), cx: rng.range(-0.04, 0.04), cy: rng.range(-0.03, 0.03), rx: s.kind === 'expanse' ? 0 : rng.range(0, 10), ry: rng.range(-6, 6) }, lighting: light(), layout: { align: ruled ? 'left' : 'center' } },
    { recipe: 'angled', seed: rng.int(1, 1e6), camera: { rx: rng.range(18, 32), ry: sign() * rng.range(16, 28), rz: rng.range(-12, 12), scale: rng.range(0.8, 0.95), cx: 0, cy: 0.02 }, lighting: { ...light(), strength: 0.65 }, layout: { align: ruled || rng() < 0.5 ? 'left' : 'center' } },
    { recipe: 'minimal', seed: rng.int(1, 1e6), camera: { rz: 0, scale: rng.range(0.64, 0.7), cx: 0, cy: -0.02 }, lighting: { angle: -1.57, strength: 0.25, warmth: 0 }, layout: { align: 'left', valign: 'top', boxScale: 0.8 } },
  ];
}

// ---------------- geometry ----------------
function rectQuad(cx, cy, w, h, rzDeg = 0) {
  const a = (rzDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

/** Perspective projection of a w×h rectangle rotated in 3D (degrees). */
function projectRect(cx, cy, w, h, { rx = 0, ry = 0, rz = 0 }, focal) {
  const X = (rx * Math.PI) / 180, Y = (ry * Math.PI) / 180, Z = (rz * Math.PI) / 180;
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => {
    let z = 0;
    // rotate Z
    let x1 = x * Math.cos(Z) - y * Math.sin(Z), y1 = x * Math.sin(Z) + y * Math.cos(Z);
    // rotate X (tilt top away)
    let y2 = y1 * Math.cos(X) - z * Math.sin(X), z2 = y1 * Math.sin(X) + z * Math.cos(X);
    // rotate Y (turn)
    let x3 = x1 * Math.cos(Y) + z2 * Math.sin(Y), z3 = -x1 * Math.sin(Y) + z2 * Math.cos(Y);
    const k = focal / (focal + z3);
    return [cx + x3 * k, cy + y2 * k];
  });
}

/** Fit an aspect ratio inside a box. */
function fit(aspect, bw, bh) { return bw / bh > aspect ? [bh * aspect, bh] : [bw, bw / aspect]; }

/** Where the plane lands in the frame, plus plane size and environment choice. */
function framePlan(surface, variation, W, H, zoom) {
  const cam = variation.camera || {};
  const isObj = surface.kind === 'object';
  const r = variation.recipe;
  const focal = Math.max(W, H) * 1.5;
  if (r === 'closeup') {
    if (isObj) {
      const [pw, ph] = fit(surface.aspect, W * 1.0, H * 1.0);
      const k = Math.max(W / pw, H / ph) * 0.92 * (cam.overscan || 1.08);
      let scale = Math.min(k, 1.25);
      let w = pw * scale, h = ph * scale;
      let cx = W / 2 + cam.cx * W, cy = H / 2 + cam.cy * H;
      if (zoom) {
        // move in on the writing: text block fills most of the frame
        const z = clamp(Math.min((0.84 * W) / (zoom.fw * w), (0.78 * H) / (zoom.fh * h)), 1, 2.3);
        w *= z; h *= z;
        cx = W / 2 - (zoom.cx - 0.5) * w; cy = H / 2 - (zoom.cy - 0.5) * h;
        // keep the page covering the frame where it can, but never push the words off-center by more than 12%
        const lim = (big, frame) => Math.max(0, (big - frame) / 2);
        const cxC = clamp(cx, W / 2 - lim(w, W), W / 2 + lim(w, W)), cyC = clamp(cy, H / 2 - lim(h, H), H / 2 + lim(h, H));
        cx = clamp(cxC, cx - W * 0.12, cx + W * 0.12);
        cy = clamp(cyC, cy - H * 0.12, cy + H * 0.12);
      }
      return { quad: rectQuad(cx, cy, w, h, cam.rz || 0), aspect: surface.aspect, env: surface.env, shadow: 0.5, envBlur: 1 };
    }
    const os = cam.overscan || 1.1;
    return { quad: rectQuad(W / 2, H / 2, W * os, H * os, (cam.rz || 0) * 0.4), aspect: W / H, env: null, shadow: 0 };
  }
  if (r === 'context') {
    if (isObj) {
      const sc = cam.scale || 0.72;
      const [w, h] = fit(surface.aspect, W * sc, H * sc);
      return { quad: projectRect(W / 2 + (cam.cx || 0) * W, H / 2 + (cam.cy || 0) * H, w, h, { rx: cam.rx || 0, ry: cam.ry || 0, rz: cam.rz || 0 }, focal), aspect: surface.aspect, env: surface.env, shadow: 1, envBlur: 1 };
    }
    if (surface.wide === 'ground') {
      // ground seen toward a horizon
      // looking down at the ground at an angle; plane overfills the frame
      const w = W * 2.6, h = H * 2.4;
      return { quad: projectRect(W / 2, H * 0.6, w, h, { rx: 36, ry: 0, rz: (cam.rz || 0) * 0.5 }, focal), aspect: w / h, env: null, shadow: 0 };
    }
    if (surface.wide === 'trunk') {
      const w = W * 0.74, h = H * 1.12;
      return { quad: rectQuad(W / 2 + (cam.cx || 0) * W, H / 2, w, h, (cam.rz || 0) * 0.3), aspect: w / h, env: surface.env, shadow: 0.8 };
    }
    if (surface.wide === 'board') {
      const [w, h] = fit(1.4, W * 0.84, H * 0.84);
      return { quad: rectQuad(W / 2, H / 2, w, h, 0), aspect: 1.4, env: surface.env, shadow: 0.6, frame: true };
    }
    // wall: facade occupying most of the frame, ground at the bottom
    const w = W * 1.12, h = H * 0.76;
    return { quad: projectRect(W / 2, H * 0.45, w, h, { ry: (cam.ry || 0) * 1.5, rz: 0 }, focal), aspect: w / h, env: surface.env, shadow: 0 };
  }
  if (r === 'angled') {
    if (isObj) {
      const sc = cam.scale || 0.86;
      const [w, h] = fit(surface.aspect, W * sc, H * sc);
      return { quad: projectRect(W / 2, H / 2 + (cam.cy || 0) * H, w, h, { rx: cam.rx, ry: cam.ry, rz: cam.rz }, focal), aspect: surface.aspect, env: surface.env, shadow: 0.9, envBlur: 1 };
    }
    if (surface.wide === 'ground') {
      const w = W * 3, h = H * 2.8;
      return { quad: projectRect(W / 2, H * 0.6, w, h, { rx: 42, ry: Math.sign(cam.ry || 1) * 22, rz: (cam.rz || 0) }, focal), aspect: w / h, env: null, shadow: 0 };
    }
    // expanse receding to one side
    const w = W * 1.9, h = H * 1.25;
    return { quad: projectRect(W / 2, H / 2, w, h, { rx: 0, ry: Math.sign(cam.ry || 1) * 48, rz: 0 }, focal * 0.8), aspect: w / h, env: surface.env, shadow: 0, frame: surface.wide === 'board' };
  }
  // minimal / editorial
  if (isObj) {
    const sc = Math.max(0.64, cam.scale || 0.66);
    const [w, h] = fit(surface.aspect, W * sc, H * sc);
    return { quad: rectQuad(W / 2, H / 2 + (cam.cy || 0) * H, w, h, 0), aspect: surface.aspect, env: 'studio', shadow: 0.7, studio: true };
  }
  return { quad: rectQuad(W / 2, H / 2, W * 1.02, H * 1.02, 0), aspect: W / H, env: null, shadow: 0, editorial: true };
}

// ---------------- scene layer ----------------
function planeSize(aspect, W, H, quality, quad) {
  // match on-screen size of the plane so text stays crisp; cap for speed
  const e = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const onW = Math.max(e(quad[0], quad[1]), e(quad[3], quad[2]));
  const onH = Math.max(e(quad[0], quad[3]), e(quad[1], quad[2]));
  let pw = Math.max(onW, onH * aspect) * quality;
  const cap = Math.max(W, H) * 1.5 * Math.max(quality, 0.5);
  pw = clamp(pw, 240, Math.min(2600, cap));
  let ph = pw / aspect;
  if (ph > Math.min(2600, cap)) { ph = Math.min(2600, cap); pw = ph * aspect; }
  return [Math.round(pw), Math.round(ph)];
}

function getScene(surface, pw, ph, seed, overrides) {
  const key = `${surface.id}|${pw}x${ph}|${seed}|${JSON.stringify(overrides || {})}`;
  let sc = sceneCache.get(key);
  if (sc) return sc;
  const rng = makeRng(`${surface.id}|${seed}`);
  const out = surface.gen({ w: pw, h: ph, rng, seed, p: { ...surface.params, ...(overrides || {}) } });
  sc = { ...out, w: pw, h: ph, key, detail: null };
  sc.dark = out.dark ?? surface.tone === 'dark';
  return sceneCache.set(key, sc);
}

function getEnv(id, W, H, seed, p) {
  const key = `${id}|${W}x${H}|${seed}|${JSON.stringify(p || {})}`;
  return envCache.get(key) || envCache.set(key, renderEnvironment(id, { w: W, h: H, seed, p }));
}

// ---------------- render ----------------
/**
 * Render one composition.
 * @param {object} spec  see README "Render spec"
 * @returns {{canvas:HTMLCanvasElement, info:object}}
 */
export function render(spec) {
  const t0 = performanceNow();
  const W = Math.round(spec.width), H = Math.round(spec.height);
  const quality = spec.quality ?? 1;
  const surface = spec.customScene ? null : getSurface(spec.surfaceId);
  const treatment = TREATMENT_MAP[spec.treatmentId] || TREATMENT_MAP.handwritten;
  const font = { ...treatment.fonts[Math.min(spec.fontIndex || 0, treatment.fonts.length - 1)], ...(spec.fontOverride || {}) };
  const variation = spec.variation || planVariations(spec.surfaceId, 1)[0];
  const typoSettings = { ...(variation.layout || {}), ...(spec.typography || {}) };
  const pos = spec.position || {};
  const matSettings = spec.material || {};
  const lighting = { ...(variation.lighting || {}), ...(spec.lighting || {}) };

  const out = createCanvas(W, H);
  const g = ctx2d(out);
  g.imageSmoothingQuality = 'high';

  // ---- frame plan
  let plan;
  if (spec.customScene) {
    plan = { quad: (spec.quad || spec.customScene.quad || [[0.2, 0.3], [0.8, 0.3], [0.8, 0.7], [0.2, 0.7]]).map(([x, y]) => [x * W, y * H]), env: null, shadow: 0 };
    const e = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    plan.aspect = Math.max(0.2, (e(plan.quad[0], plan.quad[1]) + e(plan.quad[3], plan.quad[2])) / (e(plan.quad[0], plan.quad[3]) + e(plan.quad[1], plan.quad[2])));
  } else {
    let zoom = null;
    if (variation.recipe === 'closeup' && surface.kind === 'object' && spec.autoZoom !== false) {
      // cheap layout probe on a small plane to find where the words sit
      const pw0 = 420, ph0 = Math.round(pw0 / surface.aspect);
      const probe = getScene(surface, pw0, ph0, spec.sceneSeed ?? 1, spec.surfaceOverrides);
      const lay = computeLayout({ text: spec.text || ' ', treatment, font, region: probe.region, settings: typoSettings, rules: probe.rules });
      const pad = lay.fontSize * 0.6;
      zoom = { fw: (lay.bbox.w + pad * 2) / pw0, fh: (lay.bbox.h + pad * 2) / ph0, cx: (lay.bbox.x + lay.bbox.w / 2) / pw0, cy: (lay.bbox.y + lay.bbox.h / 2) / ph0 };
    }
    plan = framePlan(surface, variation, W, H, zoom);
    if (spec.quad) plan.quad = spec.quad.map(([x, y]) => [x * W, y * H]);
  }

  // ---- environment / background
  if (spec.customScene) {
    const img = spec.customScene.image;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const k = Math.max(W / iw, H / ih);
    g.drawImage(img, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
  } else if (plan.env) {
    const envP = plan.studio ? { color: tone(spec.studioColor || studioTone(surface), 0) } : {};
    g.drawImage(getEnv(plan.env, W, H, variation.seed % 7, envP), 0, 0);
  } else {
    g.fillStyle = '#777'; g.fillRect(0, 0, W, H);
  }

  // ---- scene layer (plane)
  const [pw, ph] = planeSize(plan.aspect, W, H, quality, plan.quad);
  let scene;
  if (spec.customScene) {
    scene = { base: null, w: pw, h: ph, region: { x: pw * 0.04, y: ph * 0.04, w: pw * 0.92, h: ph * 0.92 }, dark: spec.customScene.dark ?? sampleDark(out, plan.quad), porous: spec.customScene.porous ?? 0.3 };
  } else {
    scene = getScene(surface, pw, ph, spec.sceneSeed ?? 1, spec.surfaceOverrides);
    scene.porous = surface.porous ?? scene.porous ?? 0;
    if (scene.porous > 0 && !scene.detail) scene.detail = surfaceDetail(scene.base);
  }
  const surfInfo = { dark: scene.dark, porous: scene.porous || 0, glossy: scene.glossy, wipe: scene.wipe, emissive: scene.emissive, impressDepth: scene.impressDepth, bleed: surface?.bleed || 0 };

  // ---- text region with user positioning
  let region = { ...scene.region };
  if (plan.editorial) {
    region = { x: scene.w * 0.1, y: scene.h * 0.12, w: scene.w * 0.62, h: scene.h * 0.6 };
  }
  // keep the writing inside the part of the plane that's actually in frame
  if (!spec.customScene) {
    const vis = visibleUV(plan.quad, W, H, 0.07);
    if (vis) {
      const vx0 = vis.u0 * scene.w, vx1 = vis.u1 * scene.w, vy0 = vis.v0 * scene.h, vy1 = vis.v1 * scene.h;
      const nx0 = Math.max(region.x, vx0), nx1 = Math.min(region.x + region.w, vx1);
      const ny0 = Math.max(region.y, vy0), ny1 = Math.min(region.y + region.h, vy1);
      if (nx1 - nx0 > region.w * 0.2 && ny1 - ny0 > region.h * 0.2) region = { x: nx0, y: ny0, w: nx1 - nx0, h: ny1 - ny0 };
    }
  }
  const boxScale = (pos.boxScale ?? typoSettings.boxScale ?? 1);
  if (boxScale !== 1) {
    const cx = region.x + region.w / 2, cy = region.y + region.h / 2;
    region = { x: cx - (region.w * boxScale) / 2, y: cy - (region.h * boxScale) / 2, w: region.w * boxScale, h: region.h * boxScale };
  }
  region.x += (pos.offsetX || 0) * scene.w;
  region.y += (pos.offsetY || 0) * scene.h;

  // ---- typography layer
  let ink = spec.ink || defaultInk(treatment.id, { ...surface, tone: scene.dark ? 'dark' : 'light', ink: surface?.ink });
  if (!spec.ink && treatment.material !== 'impress') {
    // automatic ink must stay readable on recolored or moody surfaces
    const bg = scene.base ? meanLuminance(scene) : (scene.dark ? 0.2 : 0.8);
    if (Math.abs(luminance(ink) - bg) < 0.3) ink = bg > 0.5 ? '#141414' : '#f4f0e6';
  }
  const emRange = findEmphasis(spec.text || '', spec.emphasis?.phrase);
  const typoKey = hashString(JSON.stringify([spec.text, treatment.id, font, region, typoSettings, ink, spec.emphasis, emRange, scene.w, scene.h, scene.rules ? 1 : 0, spec.textSeed]));
  let typo = typoCache.get(typoKey);
  if (!typo) {
    const layout = computeLayout({ text: spec.text || '', treatment, font, region, settings: typoSettings, rules: scene.rules });
    const layers = renderTypography({ w: scene.w, h: scene.h, layout, treatment, font, ink, emphasis: emRange ? { range: emRange, style: spec.emphasis?.style || treatment.emphasis, color: spec.emphasis?.color, highlight: spec.emphasis?.highlight } : null, seed: spec.textSeed ?? 11, settings: typoSettings });
    typo = typoCache.set(typoKey, { layout, ...layers });
  }

  // ---- material layer
  const kind = treatment.material;
  const matKey = `${typoKey}|${kind}|${JSON.stringify(matSettings)}|${scene.key || 'custom'}|${JSON.stringify(surfInfo)}`;
  let mat = materialCache.get(matKey);
  if (!mat) {
    mat = applyMaterial({ typo, kind, params: matSettings, surface: surfInfo, detail: scene.detail, seed: spec.textSeed ?? 11, fontSize: typo.layout.fontSize, ink });
    materialCache.set(matKey, mat);
  }

  // ---- composite text onto the plane (plane space)
  const plane = createCanvas(scene.w, scene.h);
  const pg = ctx2d(plane);
  if (scene.base) pg.drawImage(scene.base, 0, 0);
  const rot = ((pos.rotation || 0) * Math.PI) / 180;
  const drawRot = (ctx, src, op = 'source-over', alpha = 1) => {
    ctx.save();
    ctx.globalCompositeOperation = op; ctx.globalAlpha = alpha;
    if (rot) {
      const cx = region.x + region.w / 2, cy = region.y + region.h / 2;
      ctx.translate(cx, cy); ctx.rotate(rot); ctx.translate(-cx, -cy);
    }
    ctx.drawImage(src, 0, 0);
    ctx.restore();
  };
  const clipToBase = (layer) => {
    if (!scene.base) return layer;
    const c = cloneCanvas(layer);
    const cg = ctx2d(c);
    cg.globalCompositeOperation = 'destination-in';
    cg.drawImage(scene.base, 0, 0);
    return c;
  };
  const opacity = matSettings.opacity ?? mat.opacity ?? 1;
  if (mat.behind) drawRot(pg, clipToBase(mat.behind), scene.dark ? 'screen' : 'multiply', 0.9);
  if (mat.halo) drawRot(pg, clipToBase(mat.halo), scene.dark || kind === 'chalk' ? 'source-over' : 'multiply', mat.haloAlpha ?? 0.3);
  if (mat.blend === 'wipe' && scene.under) {
    // wipe fog/dust away: show the clear layer through the letters
    const reveal = cloneCanvas(scene.under);
    const rg = ctx2d(reveal);
    rg.globalCompositeOperation = 'destination-in';
    rg.save();
    if (rot) { const cx = region.x + region.w / 2, cy = region.y + region.h / 2; rg.translate(cx, cy); rg.rotate(rot); rg.translate(-cx, -cy); }
    rg.drawImage(mat.wipe, 0, 0);
    rg.restore();
    pg.drawImage(reveal, 0, 0);
    // water beads at the edges of the wiped strokes
    const edge = blurCanvas(mat.wipe, Math.max(1, typo.layout.fontSize * 0.04));
    const eg = ctx2d(edge); eg.globalCompositeOperation = 'source-in'; eg.fillStyle = 'rgba(255,255,255,0.35)'; eg.fillRect(0, 0, edge.width, edge.height);
    eg.globalCompositeOperation = 'destination-out'; eg.drawImage(mat.wipe, 0, 0);
    drawRot(pg, edge, 'screen', 0.7);
  } else if (mat.blend === 'wipe' || mat.blend === 'emboss') {
    const em = mat.emboss || embossFallback(mat.wipe, typo.layout.fontSize);
    drawRot(pg, clipToBase(em.dark), 'multiply', opacity);
    drawRot(pg, clipToBase(em.light), 'screen', opacity);
  } else {
    if (mat.glow) drawRot(pg, clipToBase(mat.glow), 'screen', mat.glowAlpha ?? 0.6);
    drawRot(pg, clipToBase(mat.ink), mat.blend, opacity);
    if (surfInfo.porous > 0.05 && scene.base && (kind === 'paint' || kind === 'spray' || kind === 'chalk')) {
      // let the surface texture print through the paint film
      const tex = cloneCanvas(scene.base);
      const tg = ctx2d(tex);
      tg.globalCompositeOperation = 'saturation'; tg.fillStyle = '#808080'; tg.fillRect(0, 0, tex.width, tex.height);
      tg.globalCompositeOperation = 'destination-in';
      tg.save();
      if (rot) { const cx = region.x + region.w / 2, cy = region.y + region.h / 2; tg.translate(cx, cy); tg.rotate(rot); tg.translate(-cx, -cy); }
      tg.drawImage(mat.ink, 0, 0);
      tg.restore();
      pg.save(); pg.globalCompositeOperation = 'overlay'; pg.globalAlpha = 0.5 * surfInfo.porous * (matSettings.intensity ?? 1); pg.drawImage(tex, 0, 0); pg.restore();
    }
  }
  // surface relief over the ink (creases, grime, mortar)
  if (scene.shade) {
    pg.save();
    pg.globalCompositeOperation = scene.shadeMode === 'soft-light' ? 'soft-light' : 'overlay';
    pg.drawImage(clipToBase(scene.shade), 0, 0);
    pg.restore();
  }
  if (scene.glossy) {
    const sheen = pg.createLinearGradient(0, 0, scene.w, scene.h);
    sheen.addColorStop(0.35, 'rgba(255,255,255,0)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0.18)'); sheen.addColorStop(0.62, 'rgba(255,255,255,0)');
    pg.save(); pg.globalCompositeOperation = 'source-atop'; pg.fillStyle = sheen; pg.fillRect(0, 0, scene.w, scene.h); pg.restore();
  }
  const bend = scene.bend || 0;
  if (bend) {
    const cyl = pg.createLinearGradient(0, 0, scene.w, 0);
    cyl.addColorStop(0, 'rgba(0,0,0,0.45)'); cyl.addColorStop(0.35, 'rgba(255,255,255,0.08)'); cyl.addColorStop(0.55, 'rgba(255,255,255,0.12)'); cyl.addColorStop(1, 'rgba(0,0,0,0.5)');
    pg.save(); pg.globalCompositeOperation = 'source-atop'; pg.fillStyle = cyl; pg.fillRect(0, 0, scene.w, scene.h); pg.restore();
  }

  // ---- project plane into the frame
  const H2Q = squareToQuad(plan.quad);
  const displace = scene.displace;
  const theta = bend * Math.PI * 2;
  const map = (u, v) => {
    let uu = u;
    if (bend) uu = 0.5 + (0.5 * Math.sin((u - 0.5) * theta)) / Math.sin(theta / 2);
    let [x, y] = H2Q(uu, v);
    if (displace) { const [dx, dy] = displace(u, v); x += dx * (W / scene.w); y += dy * (H / scene.h); }
    return [x, y];
  };
  const layer = createCanvas(W, H);
  const lg = ctx2d(layer);
  lg.imageSmoothingQuality = 'high';
  meshWarp(lg, plane, map, { grid: displace || bend ? 28 : 14 });

  if (spec.customScene) {
    // text-only plane over a photograph: blend like real ink/paint would
    const blend = mat.blend === 'multiply' ? 'multiply' : mat.blend === 'screen' ? 'screen' : 'source-over';
    g.save(); g.globalCompositeOperation = blend; g.drawImage(layer, 0, 0); g.restore();
  } else {
    if (surface.pole && variation.recipe !== 'closeup') {
      // sign post below the sign
      const q = plan.quad, bx = (q[2][0] + q[3][0]) / 2, by = (q[2][1] + q[3][1]) / 2;
      const pwid = Math.min(W, H) * 0.035;
      const pg2 = g.createLinearGradient(bx - pwid, 0, bx + pwid, 0);
      pg2.addColorStop(0, '#5d6266'); pg2.addColorStop(0.4, '#c9ced1'); pg2.addColorStop(1, '#4a4e52');
      g.fillStyle = pg2; g.fillRect(bx - pwid / 2, by - pwid, pwid, H - by + pwid);
    }
    if (plan.shadow > 0) {
      const ang = lighting.angle ?? -1.2;
      const d = Math.min(W, H) * 0.018 * plan.shadow;
      g.save();
      g.shadowColor = `rgba(0,0,0,${0.42 * plan.shadow})`;
      g.shadowBlur = Math.min(W, H) * 0.035 * plan.shadow;
      g.shadowOffsetX = -Math.cos(ang) * d; g.shadowOffsetY = -Math.sin(ang) * d;
      g.drawImage(layer, 0, 0);
      g.restore();
      // tight contact shadow
      g.save(); g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = Math.min(W, H) * 0.004; g.drawImage(layer, 0, 0); g.restore();
    } else {
      g.drawImage(layer, 0, 0);
    }
    if (plan.frame) {
      // window/screen frame around the pane
      const q = plan.quad;
      g.save();
      g.lineJoin = 'miter';
      g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = Math.min(W, H) * 0.02;
      g.strokeStyle = surface.id === 'projection' ? '#0b0b0d' : '#23272c';
      g.lineWidth = Math.min(W, H) * 0.045;
      g.beginPath(); q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
      g.shadowColor = 'transparent';
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = Math.max(1, Math.min(W, H) * 0.004);
      g.stroke();
      g.restore();
    }
  }

  // ---- lighting & finish (frame space, affects everything equally)
  finish(g, W, H, lighting, spec.mood, plan, variation.seed);

  const info = {
    overflow: typo.layout.overflow,
    fontSize: typo.layout.fontSize,
    fontPx: (typo.layout.fontSize / scene.w) * avgEdge(plan.quad, 'w'),
    lines: typo.layout.lines.length,
    words: wordCount(spec.text || ''),
    maxWords: surface?.maxWords ?? 60,
    quad: plan.quad.map(([x, y]) => [x / W, y / H]),
    emphasisFound: !!emRange || !spec.emphasis?.phrase,
    textVerified: verifyLayout(spec.text || '', typo.layout),
    hasRules: !!scene.rules,
    surfaceRegion: { x: region.x / scene.w, y: region.y / scene.h, w: region.w / scene.w, h: region.h / scene.h },
    ms: Math.round(performanceNow() - t0),
  };
  info.tooLong = info.overflow || info.words > info.maxWords || info.fontPx < Math.min(W, H) * 0.022;
  return { canvas: out, info };
}

function finish(g, W, H, lighting, mood, plan, seed) {
  const strength = lighting.strength ?? 0.45;
  const ang = lighting.angle ?? -1.2;
  // directional light: bright side soft-light white, far side multiply dark
  const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2;
  const lx = cx + Math.cos(ang) * R, ly = cy + Math.sin(ang) * R;
  const gr = g.createLinearGradient(lx, ly, cx - Math.cos(ang) * R, cy - Math.sin(ang) * R);
  gr.addColorStop(0, `rgba(255,250,240,${0.35 * strength})`);
  gr.addColorStop(0.55, 'rgba(128,128,128,0)');
  gr.addColorStop(1, `rgba(0,0,0,${0.55 * strength})`);
  g.save(); g.globalCompositeOperation = 'soft-light'; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
  const warmth = lighting.warmth ?? 0;
  if (Math.abs(warmth) > 0.02) {
    g.save(); g.globalCompositeOperation = 'soft-light';
    g.fillStyle = warmth > 0 ? `rgba(255,170,90,${warmth * 0.35})` : `rgba(90,140,255,${-warmth * 0.35})`;
    g.fillRect(0, 0, W, H); g.restore();
  }
  if (mood) applyMood(g, W, H, mood);
  // vignette
  const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${plan.studio ? 0.12 : 0.28 * (0.5 + strength)})`);
  g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = vg; g.fillRect(0, 0, W, H); g.restore();
  // photographic grain ties all layers together
  fillPattern(g, grainTile(seed % 9 + 1, 256, 18), W, H, 'overlay', 1);
}

export function applyMood(g, W, H, mood) {
  const tints = {
    night: ['multiply', 'rgba(40,55,110,0.45)'],
    dusk: ['soft-light', 'rgba(255,120,80,0.45)'],
    golden: ['soft-light', 'rgba(255,180,90,0.5)'],
    overcast: ['saturation', 'rgba(128,128,128,0.35)'],
    vintage: ['soft-light', 'rgba(200,150,90,0.55)'],
    cold: ['soft-light', 'rgba(110,160,255,0.45)'],
    neon: ['screen', 'rgba(255,40,160,0.12)'],
    rain: ['multiply', 'rgba(120,140,160,0.35)'],
  };
  for (const m of [].concat(mood.tags || [])) {
    const t = tints[m];
    if (!t) continue;
    g.save(); g.globalCompositeOperation = t[0]; g.fillStyle = t[1]; g.fillRect(0, 0, W, H); g.restore();
  }
  if (mood.tint) { g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.45; g.fillStyle = mood.tint; g.fillRect(0, 0, W, H); g.restore(); }
}

function embossFallback(mask, size) {
  const off = Math.max(1, size * 0.035);
  const dark = createCanvas(mask.width, mask.height), light = createCanvas(mask.width, mask.height);
  const dg = ctx2d(dark), lgc = ctx2d(light);
  dg.drawImage(mask, -off, -off); dg.globalCompositeOperation = 'destination-out'; dg.drawImage(mask, off, off);
  dg.globalCompositeOperation = 'source-in'; dg.fillStyle = 'rgba(0,0,0,0.55)'; dg.fillRect(0, 0, dark.width, dark.height);
  lgc.drawImage(mask, off, off); lgc.globalCompositeOperation = 'destination-out'; lgc.drawImage(mask, -off, -off);
  lgc.globalCompositeOperation = 'source-in'; lgc.fillStyle = 'rgba(255,255,255,0.5)'; lgc.fillRect(0, 0, light.width, light.height);
  return { dark, light };
}

/** Portion of the plane (in UV) visible inside the frame, shrunk by a margin. */
function visibleUV(quad, W, H, margin) {
  const map = squareToQuad(quad);
  const mx = W * margin, my = H * margin;
  const inside = (u, v) => { const [x, y] = map(u, v); return Number.isFinite(x) && x >= mx && x <= W - mx && y >= my && y <= H - my; };
  const N = 32;
  let u0 = 1, u1 = 0, v0 = 1, v1 = 0, any = false;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const u = i / N, v = j / N;
    if (inside(u, v)) { any = true; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  }
  if (!any) return null;
  // shrink toward the center until the box border is entirely in frame
  for (let k = 0; k < 30; k++) {
    let ok = true;
    for (let t = 0; t <= 1.0001 && ok; t += 1 / 16) {
      const u = u0 + (u1 - u0) * t, v = v0 + (v1 - v0) * t;
      if (!inside(u, v0) || !inside(u, v1) || !inside(u0, v) || !inside(u1, v)) ok = false;
    }
    if (ok) return { u0, u1, v0, v1 };
    const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
    u0 = cu - (cu - u0) * 0.93; u1 = cu + (u1 - cu) * 0.93; v0 = cv - (cv - v0) * 0.93; v1 = cv + (v1 - cv) * 0.93;
  }
  return null;
}

function avgEdge(q, dir) {
  const e = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  return dir === 'w' ? (e(q[0], q[1]) + e(q[3], q[2])) / 2 : (e(q[0], q[3]) + e(q[1], q[2])) / 2;
}

function meanLuminance(scene) {
  if (scene.meanLum != null) return scene.meanLum;
  const r = scene.region, c = scene.base;
  const x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y));
  const w = Math.max(1, Math.min(c.width - x, Math.round(r.w))), h = Math.max(1, Math.min(c.height - y, Math.round(r.h)));
  const d = ctx2d(c).getImageData(x, y, w, h).data;
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 13) { if (d[i + 3] < 128) continue; sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; n++; }
  return (scene.meanLum = n ? sum / n : 0.5);
}

function sampleDark(canvas, quad) {
  const xs = quad.map((p) => p[0]), ys = quad.map((p) => p[1]);
  const x = Math.max(0, Math.min(...xs)), y = Math.max(0, Math.min(...ys));
  const w = Math.max(1, Math.min(canvas.width - x, Math.max(...xs) - x)), h = Math.max(1, Math.min(canvas.height - y, Math.max(...ys) - y));
  const d = ctx2d(canvas).getImageData(x, y, w, h).data;
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 17) { sum += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; n++; }
  return sum / n / 255 < 0.45;
}

function studioTone(surface) {
  const map = { paper: '#d9d3c7', boards: '#cfd3d6', objects: '#d6cfc4', outdoor: '#cdd2c8', experimental: '#cbc6d2', architecture: '#cfcac2' };
  return map[surface?.category] || '#d6d1c8';
}

const performanceNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Small preview of a surface for the library grid. */
export function renderSurfaceThumb(surfaceId, { width = 220, height = 160, sample = 'Aa' } = {}) {
  const s = getSurface(surfaceId);
  const treatmentId = s.treatments[0];
  return render({
    width, height, quality: 1, surfaceId, treatmentId, text: sample,
    variation: { recipe: 'closeup', seed: 3, camera: { rz: -2, overscan: 1.05, cx: 0, cy: 0 }, lighting: { angle: -1.2, strength: 0.4 }, layout: { align: 'center' } },
    typography: { sizeScale: 1, snapToLines: false },
  }).canvas;
}

export { luminance };
