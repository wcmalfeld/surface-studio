// Project model, undo history and storage adapters.

export const SIZE_PRESETS = [
  { id: 'substack', name: 'Substack Note', note: '4:5 portrait', width: 1080, height: 1350 },
  { id: 'square', name: 'Square', note: '1:1', width: 1080, height: 1080 },
  { id: 'story', name: 'Story', note: '9:16', width: 1080, height: 1920 },
  { id: 'landscape', name: 'Landscape', note: '16:9', width: 1600, height: 900 },
  { id: 'og', name: 'Link preview', note: '1.91:1', width: 1200, height: 630 },
];

export const SAMPLE_TEXT = "The best ideas don't arrive all at once. They accumulate, quietly, while you're busy doing something else.";

export function uid(prefix = 'p') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function newProject(overrides = {}) {
  return {
    id: uid('p'),
    name: '',
    text: SAMPLE_TEXT,
    emphasis: { phrase: 'accumulate', style: null, color: null },
    surfaceId: 'notebook',
    treatmentId: 'handwritten',
    fontIndex: 0,
    ink: null,
    typography: { sizeScale: 1, lineHeight: null, letterSpacing: 0, align: null, valign: null, balance: true, snapToLines: true, handVariation: 1 },
    position: { offsetX: 0, offsetY: 0, rotation: 0, boxScale: 1 },
    material: { intensity: 1, opacity: null, roughness: null, grain: null, bleed: null, drips: null },
    lighting: { strength: null, angle: null, warmth: null },
    size: { preset: 'substack', width: 1080, height: 1350 },
    variationSeed: 1,
    selected: 0,
    quads: {},
    scenePrompt: '',
    sceneSummary: '',
    mood: { tags: [] },
    surfaceOverrides: {},
    sceneSeed: 1,
    textSeed: 11,
    custom: null, // { image: dataURL, quad }
    exportFmt: { format: 'png', scale: 1, quality: 0.92 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

/** Everything that defines a reusable look (no text, no surface-specific placement). */
export function styleFrom(p, name) {
  return {
    id: uid('s'), name, createdAt: Date.now(),
    treatmentId: p.treatmentId, fontIndex: p.fontIndex, ink: p.ink, emphasis: { style: p.emphasis.style, color: p.emphasis.color },
    typography: { ...p.typography }, material: { ...p.material }, lighting: { ...p.lighting }, surfaceId: p.surfaceId, mood: p.mood,
  };
}

export class History {
  constructor(limit = 120) { this.limit = limit; this.past = []; this.future = []; this.last = null; this.timer = null; }
  /** Record the state before a change; changes within `coalesceMs` merge into one step. */
  record(snapshot, coalesceMs = 500) {
    const now = Date.now();
    if (this.last && now - this.lastAt < coalesceMs && this.coalesceKey === snapshot.key) { this.lastAt = now; return; }
    this.past.push(snapshot.json);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    this.last = snapshot.json; this.lastAt = now; this.coalesceKey = snapshot.key;
  }
  undo(currentJson) { if (!this.past.length) return null; this.future.push(currentJson); this.last = null; return this.past.pop(); }
  redo(currentJson) { if (!this.future.length) return null; this.past.push(currentJson); this.last = null; return this.future.pop(); }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}

// ---------- storage adapters ----------
// Interface: list(kind) -> Promise<item[]>, put(kind, item), remove(kind, id)

export function localStorageAdapter(prefix = 'surface-studio') {
  const key = (kind) => `${prefix}:${kind}`;
  const read = (kind) => { try { return JSON.parse(localStorage.getItem(key(kind)) || '[]'); } catch { return []; } };
  const write = (kind, arr) => { try { localStorage.setItem(key(kind), JSON.stringify(arr)); return true; } catch { return false; } };
  return {
    name: 'This browser',
    async list(kind) { return read(kind).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)); },
    async put(kind, item) {
      const arr = read(kind).filter((x) => x.id !== item.id);
      arr.push(item);
      if (!write(kind, arr)) {
        // quota: drop embedded photos from the oldest projects first
        const slim = arr.map((x) => (x.id === item.id ? x : { ...x, custom: x.custom ? { ...x.custom, image: null } : null }));
        if (!write(kind, slim)) throw new Error('Storage is full. Delete a few saved projects and try again.');
      }
      return item;
    },
    async remove(kind, id) { write(kind, read(kind).filter((x) => x.id !== id)); },
  };
}

export function memoryAdapter() {
  const m = new Map();
  return {
    name: 'This session',
    async list(kind) { return [...(m.get(kind) || new Map()).values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); },
    async put(kind, item) { if (!m.has(kind)) m.set(kind, new Map()); m.get(kind).set(item.id, item); return item; },
    async remove(kind, id) { m.get(kind)?.delete(id); },
  };
}

/** Fetch-based adapter for the full-stack app's REST API. */
export function apiAdapter(base = '/api') {
  const j = async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Request failed (${r.status})`); return r.json(); };
  return {
    name: 'Your account',
    async list(kind) { return (await j(await fetch(`${base}/store/${kind}`))).items; },
    async put(kind, item) { return (await j(await fetch(`${base}/store/${kind}/${encodeURIComponent(item.id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(item) }))).item; },
    async remove(kind, id) { await j(await fetch(`${base}/store/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' })); },
  };
}

/** Default exporter: a normal browser download. */
export function anchorExporter() {
  return {
    async save({ blob, filename }) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return 'saved';
    },
  };
}
