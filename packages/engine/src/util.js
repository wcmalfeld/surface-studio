// Low-level helpers shared by every layer: canvas factory, seeded randomness,
// value noise, fast blur, homography and mesh warping.

let canvasFactory = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

/** Swap the canvas factory (e.g. OffscreenCanvas in a worker). */
export function setCanvasFactory(fn) { canvasFactory = fn; }

export function createCanvas(w, h) { return canvasFactory(w, h); }

export function ctx2d(c) { return c.getContext('2d', { willReadFrequently: false }); }

export function cloneCanvas(src) {
  const c = createCanvas(src.width, src.height);
  ctx2d(c).drawImage(src, 0, 0);
  return c;
}

// ---------- seeded randomness ----------
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let a = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.chance = (p) => next() < p;
  next.gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  next.fork = (salt) => makeRng((hashString(String(salt)) ^ Math.floor(next() * 4294967296)) >>> 0);
  return next;
}

// ---------- value noise ----------
export function makeNoise2D(rng) {
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = rng(); }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const lattice = (x, y) => vals[perm[(x & 255) + perm[y & 255]]];
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = fade(xf), v = fade(yf);
    const a = lattice(xi, yi), b = lattice(xi + 1, yi);
    const c = lattice(xi, yi + 1), d = lattice(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/**
 * Grayscale fractal noise field rendered at reduced resolution and returned as
 * a Float32Array of size w*h (values ~0..1). `scale` is the feature size in px.
 */
export function noiseField(w, h, { scale = 64, octaves = 4, rng, stretchX = 1, stretchY = 1, step = 2 } = {}) {
  const noise = makeNoise2D(rng);
  const sw = Math.max(2, Math.ceil(w / step)), sh = Math.max(2, Math.ceil(h / step));
  const small = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      let amp = 1, freq = 1 / scale, sum = 0, norm = 0;
      for (let o = 0; o < octaves; o++) {
        sum += amp * noise((x * step * freq) / stretchX + o * 17.3, (y * step * freq) / stretchY + o * 31.7);
        norm += amp; amp *= 0.5; freq *= 2;
      }
      small[y * sw + x] = sum / norm;
    }
  }
  if (step === 1) return small;
  // bilinear upsample
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(sh - 1.001, y / step);
    const y0 = Math.floor(fy), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(sw - 1.001, x / step);
      const x0 = Math.floor(fx), tx = fx - x0;
      const i = y0 * sw + x0;
      const a = small[i], b = small[i + 1], c = small[i + sw], d = small[i + sw + 1];
      out[y * w + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    }
  }
  return out;
}

/** Renders a noise field into a canvas as a tinted layer. */
export function fieldToCanvas(field, w, h, colorFn) {
  const c = createCanvas(w, h);
  const g = ctx2d(c);
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let i = 0, p = 0; i < field.length; i++, p += 4) {
    const [r, gg, b, a] = colorFn(field[i], i % w, (i / w) | 0);
    d[p] = r; d[p + 1] = gg; d[p + 2] = b; d[p + 3] = a;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Fine per-pixel grain tile (for speckle/fiber), cached by seed+size. */
const grainCache = new Map();
export function grainTile(seed = 1, size = 256, alpha = 40, mono = true) {
  const key = `${seed}|${size}|${alpha}|${mono}`;
  if (grainCache.has(key)) return grainCache.get(key);
  const rng = makeRng(seed);
  const c = createCanvas(size, size);
  const g = ctx2d(c);
  const img = g.createImageData(size, size);
  for (let p = 0; p < img.data.length; p += 4) {
    const v = rng() * 255;
    img.data[p] = mono ? v : rng() * 255;
    img.data[p + 1] = mono ? v : rng() * 255;
    img.data[p + 2] = mono ? v : rng() * 255;
    img.data[p + 3] = alpha;
  }
  g.putImageData(img, 0, 0);
  grainCache.set(key, c);
  return c;
}

export function fillPattern(g, tile, w, h, op = 'source-over', alpha = 1) {
  g.save();
  g.globalCompositeOperation = op;
  g.globalAlpha = alpha;
  g.fillStyle = g.createPattern(tile, 'repeat');
  g.fillRect(0, 0, w, h);
  g.restore();
}

// ---------- blur ----------
function boxBlurChannel(src, dst, w, h, r, horizontal) {
  const iarr = 1 / (r + r + 1);
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const stride = horizontal ? 1 : w;
  for (let l = 0; l < lines; l++) {
    const base = horizontal ? l * w : l;
    const at = (k) => src[base + (k < 0 ? 0 : k >= len ? len - 1 : k) * stride];
    let val = 0;
    for (let k = -r; k <= r; k++) val += at(k);
    for (let k = 0; k < len; k++) {
      dst[base + k * stride] = val * iarr;
      val += at(k + r + 1) - at(k - r);
    }
  }
}

/** Gaussian-ish blur of a whole canvas (all channels, premultiplied-safe enough for our layers). */
export function blurCanvas(src, radius) {
  if (radius <= 0.25) return cloneCanvas(src);
  const w = src.width, h = src.height;
  // Large radii: downscale, blur, upscale (much faster, visually identical).
  if (radius > 8) {
    const f = Math.min(8, radius / 4);
    const sw = Math.max(1, Math.round(w / f)), sh = Math.max(1, Math.round(h / f));
    const small = createCanvas(sw, sh);
    const sg = ctx2d(small);
    sg.imageSmoothingQuality = 'high';
    sg.drawImage(src, 0, 0, sw, sh);
    const blurred = blurCanvas(small, radius / f);
    const out = createCanvas(w, h);
    const og = ctx2d(out);
    og.imageSmoothingQuality = 'high';
    og.drawImage(blurred, 0, 0, w, h);
    return out;
  }
  const g = ctx2d(src);
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;
  const r = Math.max(1, Math.round(radius / 1.7));
  const chans = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  // premultiply
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const a = d[p + 3] / 255;
    chans[0][i] = d[p] * a; chans[1][i] = d[p + 1] * a; chans[2][i] = d[p + 2] * a; chans[3][i] = d[p + 3];
  }
  const tmp = new Float32Array(n);
  for (const ch of chans) {
    for (let pass = 0; pass < 3; pass++) {
      boxBlurChannel(ch, tmp, w, h, r, true);
      boxBlurChannel(tmp, ch, w, h, r, false);
    }
  }
  const out = createCanvas(w, h);
  const og = ctx2d(out);
  const oimg = og.createImageData(w, h);
  const o = oimg.data;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const a = chans[3][i];
    const inv = a > 0.5 ? 255 / a : 0;
    o[p] = chans[0][i] * inv; o[p + 1] = chans[1][i] * inv; o[p + 2] = chans[2][i] * inv; o[p + 3] = a;
  }
  og.putImageData(oimg, 0, 0);
  return out;
}

// ---------- geometry ----------
/** Homography mapping unit square (0,0)-(1,1) onto quad [tl,tr,br,bl]. Returns fn(u,v)->[x,y]. */
export function squareToQuad(q) {
  const [p0, p1, p2, p3] = q; // tl, tr, br, bl
  const x0 = p0[0], y0 = p0[1], x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1], x3 = p3[0], y3 = p3[1];
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g, h;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    a = x1 - x0; b = x2 - x1; c = x0; d = y1 - y0; e = y2 - y1; f = y0; g = 0; h = 0;
  } else {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    h = (dx1 * sy - sx * dy1) / den;
    a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
    return (u, v) => {
      const w = g * u + h * v + 1;
      return [(a * u + b * v + c) / w, (d * u + e * v + f) / w];
    };
  }
  // affine case: (u,v) basis tl->tr, tl->bl
  return (u, v) => [x0 + (x1 - x0) * u + (x3 - x0) * v, y0 + (y1 - y0) * u + (y3 - y0) * v];
}

/**
 * Draw `src` into `g` using an arbitrary mapping from source UV (0..1) to
 * destination pixels, via a subdivided triangle mesh with affine pieces.
 */
export function meshWarp(g, src, map, { grid = 20, overlap = 0.6 } = {}) {
  const sw = src.width, sh = src.height;
  const pts = [];
  for (let j = 0; j <= grid; j++) {
    const row = [];
    for (let i = 0; i <= grid; i++) row.push(map(i / grid, j / grid));
    pts.push(row);
  }
  const tri = (s0, s1, s2, d0, d1, d2) => {
    // expand destination triangle slightly about its centroid to hide seams
    const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
    const ex = (p) => {
      const dx = p[0] - cx, dy = p[1] - cy;
      const len = Math.hypot(dx, dy) || 1;
      return [p[0] + (dx / len) * overlap, p[1] + (dy / len) * overlap];
    };
    const e0 = ex(d0), e1 = ex(d1), e2 = ex(d2);
    g.save();
    g.beginPath();
    g.moveTo(e0[0], e0[1]); g.lineTo(e1[0], e1[1]); g.lineTo(e2[0], e2[1]);
    g.closePath();
    g.clip();
    // solve affine transform mapping s -> d
    const [u0, v0] = s0, [u1, v1] = s1, [u2, v2] = s2;
    const den = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
    if (Math.abs(den) < 1e-9) { g.restore(); return; }
    const a = ((d1[0] - d0[0]) * (v2 - v0) - (d2[0] - d0[0]) * (v1 - v0)) / den;
    const b = ((d1[1] - d0[1]) * (v2 - v0) - (d2[1] - d0[1]) * (v1 - v0)) / den;
    const c = ((d2[0] - d0[0]) * (u1 - u0) - (d1[0] - d0[0]) * (u2 - u0)) / den;
    const d = ((d2[1] - d0[1]) * (u1 - u0) - (d1[1] - d0[1]) * (u2 - u0)) / den;
    const e = d0[0] - a * u0 - c * v0;
    const f = d0[1] - b * u0 - d * v0;
    g.setTransform(a, b, c, d, e, f);
    g.drawImage(src, 0, 0);
    g.restore();
  };
  const baseTransform = g.getTransform ? g.getTransform() : null;
  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
      const s00 = [(i / grid) * sw, (j / grid) * sh], s10 = [((i + 1) / grid) * sw, (j / grid) * sh];
      const s01 = [(i / grid) * sw, ((j + 1) / grid) * sh], s11 = [((i + 1) / grid) * sw, ((j + 1) / grid) * sh];
      const d00 = pts[j][i], d10 = pts[j][i + 1], d01 = pts[j + 1][i], d11 = pts[j + 1][i + 1];
      tri(s00, s10, s01, d00, d10, d01);
      tri(s10, s11, s01, d10, d11, d01);
    }
  }
  if (baseTransform) g.setTransform(baseTransform);
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
}
export function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return rgbToHex([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
}
export function shade(hex, amt) { return amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#000000', -amt); }
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
