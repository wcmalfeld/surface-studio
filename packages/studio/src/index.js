// Surface Studio — the creative workspace UI (framework-free, embeddable).
//
//   createStudio(root, { storage, exporter, providers, loadImage })
//
// Hosts inject storage (projects/styles/favorites), an exporter (how files
// leave the app) and scene providers (procedural, image models).
import * as E from '@surface-studio/engine';
import { icon } from './icons.js';
import { newProject, styleFrom, History, SIZE_PRESETS, localStorageAdapter, anchorExporter, uid } from './state.js';

export { localStorageAdapter, memoryAdapter, apiAdapter, anchorExporter, SIZE_PRESETS } from './state.js';

// ---------- tiny DOM helper ----------
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'text') el.textContent = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== null && v !== undefined));
const slug = (s) => (s || 'surface').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'surface';
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

const INK_SWATCHES = ['#1c2754', '#141414', '#3a2414', '#b3261e', '#1f6b45', '#2e44c7', '#f4f0e6', '#ffffff', '#ffd23f', '#e23d2b'];
const EMPHASIS_STYLES = [['', 'Treatment default'], ['underline', 'Underline'], ['highlight', 'Highlighter'], ['circle', 'Circled'], ['color', 'Color'], ['bold', 'Heavier']];
const MOOD_LABELS = { night: 'Night', dusk: 'Dusk', golden: 'Golden hour', overcast: 'Overcast', vintage: 'Vintage', cold: 'Cold', neon: 'Neon', rain: 'Rain' };

export async function createStudio(root, opts = {}) {
  const storage = opts.storage || localStorageAdapter();
  const exporter = opts.exporter || anchorExporter();
  const providers = opts.providers?.length ? opts.providers : [E.getProvider('procedural')];
  const imgCache = new Map();
  const loadImage = (src) => {
    if (!src) return Promise.resolve(null);
    if (imgCache.has(src)) return imgCache.get(src);
    const p = new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('Could not load that image.')); i.src = src; });
    imgCache.set(src, p);
    return p;
  };

  // ---------- state ----------
  let p = newProject();
  let favorites = [];
  let styles = [];
  let lastInfo = null;
  let customImg = null;
  let ui = { category: 'all', search: '', adjust: false, saveState: 'idle', saveError: '', drawer: false, interactive: false };
  const history = new History();
  const listeners = new Set();
  const onChange = (fn) => { listeners.add(fn); return fn; };

  try {
    const saved = await storage.list('projects');
    if (saved.length) p = { ...newProject(), ...saved[0] };
    const prefs = await storage.list('prefs');
    favorites = prefs.find((x) => x.id === 'favorites')?.ids || [];
    styles = await storage.list('styles');
  } catch (e) { console.warn(e); }
  if (p.custom?.image) customImg = await loadImage(p.custom.image).catch(() => null);

  const snapshot = (key) => ({ key, json: JSON.stringify(p) });
  /**
   * Apply a change. `what` names what changed so only that work reruns:
   *   'text' | 'type' (typography/material/position) | 'scene' (surface/variations) | 'meta'
   */
  function set(patch, { what = 'type', key = what, record = true, interactive = false } = {}) {
    if (record) history.record(snapshot(key));
    p = { ...p, ...(typeof patch === 'function' ? patch(p) : patch), updatedAt: Date.now() };
    ui.interactive = interactive;
    emit(what);
    if (what !== 'meta-only') scheduleSave();
    if (what !== 'meta' && what !== 'meta-only') scheduleRender(what === 'scene' ? 'all' : 'main');
  }
  function emit(what) { for (const fn of listeners) fn(what); }

  // ---------- derived ----------
  const surface = () => E.getSurface(p.surfaceId);
  const treatment = () => E.TREATMENT_MAP[p.treatmentId];
  const variations = () => E.planVariations(p.surfaceId, p.variationSeed);
  const variation = (i = p.selected) => variations()[i];
  const matKind = () => treatment().material;
  const effMat = (k) => p.material[k] ?? E.MATERIAL_DEFAULTS[matKind()]?.[k] ?? 0;
  const effLight = (k) => p.lighting[k] ?? variation()?.lighting?.[k] ?? ({ strength: 0.45, angle: -1.2, warmth: 0 })[k];
  const effAlign = () => p.typography.align ?? variation()?.layout?.align ?? 'center';
  const effVAlign = () => p.typography.valign ?? variation()?.layout?.valign ?? 'middle';

  function specFor(i, { width, height, quality = 1 }) {
    const v = variations()[i];
    return {
      width, height, quality, text: p.text,
      emphasis: p.emphasis?.phrase ? { phrase: p.emphasis.phrase, style: p.emphasis.style || undefined, color: p.emphasis.color || undefined } : null,
      surfaceId: p.surfaceId, treatmentId: p.treatmentId, fontIndex: p.fontIndex, ink: p.ink || undefined,
      typography: clean(p.typography), position: clean(p.position), material: clean(p.material), lighting: clean(p.lighting),
      variation: v, quad: p.quads?.[i] || null, mood: p.mood, surfaceOverrides: p.surfaceOverrides, sceneSeed: p.sceneSeed, textSeed: p.textSeed,
      customScene: p.custom && customImg ? { image: customImg, quad: p.custom.quad } : null,
    };
  }

  // ---------- fonts ----------
  const fontsFor = (t) => t.fonts.map((f) => ({ family: f.family, weight: f.weight }));
  await E.loadFonts(fontsFor(treatment()).slice(0, 1).concat(fontsFor(treatment())), [40]);
  const allFontsReady = E.loadFonts(E.allFontFamilies(), [40]);

  // ================= DOM =================
  root.classList.add('ss-app');
  root.innerHTML = '';

  // --- top bar
  const nameInput = h('input', { class: 'ss-projname', 'aria-label': 'Project name', placeholder: 'Untitled', id: 'ss-projname' });
  nameInput.addEventListener('input', () => set({ name: nameInput.value }, { what: 'meta', key: 'name' }));
  const undoBtn = h('button', { class: 'ss-btn ghost', title: 'Undo (Ctrl/⌘ Z)', 'aria-label': 'Undo', onclick: () => undo() }, icon('undo'));
  const redoBtn = h('button', { class: 'ss-btn ghost', title: 'Redo (Ctrl/⌘ Shift Z)', 'aria-label': 'Redo', onclick: () => redo() }, icon('redo'));
  const saveState = h('span', { class: 'ss-save-state', 'aria-live': 'polite' });
  const top = h('header', { class: 'ss-top' },
    h('div', { class: 'ss-brand' }, h('div', { class: 'ss-mark', 'aria-hidden': 'true' }, 'S'), h('span', { class: 'ss-brand-name' }, 'Surface Studio')),
    nameInput,
    h('div', { class: 'ss-top-actions' },
      saveState, undoBtn, redoBtn,
      h('button', { class: 'ss-btn', onclick: () => openDrawer() }, icon('folder'), h('span', { class: 'ss-hide-sm' }, 'Projects')),
      h('button', { class: 'ss-btn primary ss-hide-sm', onclick: () => doExport() }, icon('download'), 'Export'),
    ));
  onChange(() => {
    if (document.activeElement !== nameInput) nameInput.value = p.name || '';
    undoBtn.disabled = !history.canUndo; redoBtn.disabled = !history.canRedo;
    saveState.textContent = ui.saveState === 'saving' ? 'Saving…' : ui.saveState === 'saved' ? `Saved · ${storage.name}` : ui.saveState === 'error' ? 'Not saved' : '';
    saveState.title = ui.saveError || '';
  });

  // ================= LEFT: writing, surface, treatment, scene =================
  const left = h('aside', { class: 'ss-col ss-left', 'aria-label': 'Writing and surface' });

  // --- writing
  const ta = h('textarea', { class: 'ss-textarea', id: 'ss-text', spellcheck: 'true', 'aria-label': 'Your writing', placeholder: 'Paste or type something worth looking at…' });
  ta.value = p.text;
  ta.addEventListener('input', () => set({ text: ta.value }, { what: 'text', key: 'text' }));
  const counts = h('div', { class: 'ss-counts' });
  const notice = h('div', { class: 'ss-notice', hidden: true });
  const emphBtn = h('button', { class: 'ss-btn small', disabled: true, onclick: () => {
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    if (sel.trim()) set({ emphasis: { ...p.emphasis, phrase: sel } }, { key: 'emph' });
  } }, 'Emphasize selection');
  const syncSel = () => { emphBtn.disabled = !(ta.selectionEnd > ta.selectionStart && ta.value.slice(ta.selectionStart, ta.selectionEnd).trim()); };
  ['select', 'keyup', 'mouseup', 'input'].forEach((ev) => ta.addEventListener(ev, syncSel));
  const emphRow = h('div', { class: 'ss-emph' });
  left.append(h('section', { class: 'ss-section ss-sec-write' },
    h('h2', { class: 'ss-h' }, 'Your writing', h('small', {}, 'Kept exactly as written')),
    ta, counts, emphRow, notice));
  onChange((what) => {
    if (document.activeElement !== ta && ta.value !== p.text) ta.value = p.text;
    const words = E.wordCount(p.text), chars = [...p.text].length;
    counts.replaceChildren(h('span', {}, `${words} word${words === 1 ? '' : 's'}`), h('span', {}, `${chars} characters`),
      lastInfo && p.text.trim() ? (lastInfo.textVerified ? h('span', { class: 'ss-verified', title: 'Every character in the image matches your text' }, icon('check'), 'Text exact') : h('span', { style: { color: 'var(--ss-danger)' } }, 'Text mismatch')) : null);
    const ph = p.emphasis?.phrase;
    emphRow.replaceChildren(emphBtn,
      ph ? h('span', { class: 'ss-chip', title: 'Emphasized phrase' }, h('span', {}, `“${ph}”`), h('button', { 'aria-label': 'Remove emphasis', onclick: () => set({ emphasis: { ...p.emphasis, phrase: '' } }, { key: 'emph' }) }, '×')) : h('span', { class: 'ss-hint' }, 'Select a phrase to make it stand out.'));
    if (ph && lastInfo && !lastInfo.emphasisFound) emphRow.append(h('span', { class: 'ss-hint', style: { color: 'var(--ss-warn)' } }, 'That phrase is no longer in your text.'));
    // length warnings
    const s = surface();
    if (!p.text.trim()) {
      notice.hidden = false; notice.replaceChildren(h('span', {}, 'Add some writing to see it on a surface.'));
    } else if (lastInfo?.tooLong && !p.custom) {
      notice.hidden = false;
      notice.replaceChildren(
        h('span', {}, lastInfo.overflow ? `This doesn't fit on a ${s.name.toLowerCase()} at a readable size.` : `${words} words is long for a ${s.name.toLowerCase()} (about ${s.maxWords} reads best). It may be hard to read in a feed.`),
        h('div', { class: 'ss-row' },
          h('button', { class: 'ss-btn small', onclick: optimizeLayout }, 'Optimize layout'),
          h('button', { class: 'ss-btn small ghost', onclick: () => suggestRoomier() }, 'Try a roomier surface')));
    } else notice.hidden = true;
  });

  // --- surface library
  const search = h('input', { class: 'ss-search', type: 'search', placeholder: 'Search surfaces', 'aria-label': 'Search surfaces', id: 'ss-search' });
  search.addEventListener('input', () => { ui.search = search.value; renderLibrary(); });
  const tabs = h('div', { class: 'ss-tabs', role: 'toolbar', 'aria-label': 'Surface categories' });
  const lib = h('div', { class: 'ss-lib' });
  left.append(h('section', { class: 'ss-section' },
    h('h2', { class: 'ss-h' }, 'Surface', h('small', {}, `${E.SURFACES.length} to choose from`)),
    search, tabs, lib));
  const cats = [{ id: 'all', name: 'All' }, { id: 'fav', name: 'Favorites' }, ...E.CATEGORIES];
  function renderTabs() {
    tabs.replaceChildren(...cats.map((c) => h('button', { class: 'ss-tab', 'aria-pressed': String(ui.category === c.id), onclick: () => { ui.category = c.id; renderTabs(); renderLibrary(); } }, c.name)));
  }
  const thumbCache = new Map();
  const thumbQueue = [];
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); thumbQueue.push(e.target); pumpThumbs(); }
  }, { root: null, rootMargin: '200px' }) : null;
  let pumping = false;
  async function pumpThumbs() {
    if (pumping) return; pumping = true;
    await allFontsReady;
    while (thumbQueue.length) {
      if (renderBusy) { await new Promise((r) => setTimeout(r, 120)); continue; }
      const el = thumbQueue.shift();
      const id = el.dataset.sid;
      if (!thumbCache.has(id)) {
        try { thumbCache.set(id, E.renderSurfaceThumb(id, { width: 264, height: 192, sample: sampleWord(id) }).toDataURL('image/jpeg', 0.82)); }
        catch (err) { console.warn('thumb', id, err); thumbCache.set(id, ''); }
      }
      const src = thumbCache.get(id);
      if (src) el.replaceChildren(h('img', { src, alt: '', loading: 'lazy' }));
      await nextFrame();
    }
    pumping = false;
  }
  const sampleWord = (id) => (['streetsign', 'skateboard', 'sleeve', 'polaroid', 'trailsign', 'extsign'].includes(id) ? 'Hello' : 'Write');
  function renderLibrary() {
    const q = ui.search.trim().toLowerCase();
    let list = E.SURFACES.filter((s) => (ui.category === 'all' || (ui.category === 'fav' ? favorites.includes(s.id) : s.category === ui.category)));
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(q) || s.keywords.some((k) => k.includes(q)) || s.category.includes(q));
    if (!list.length) {
      lib.replaceChildren(h('div', { class: 'ss-empty' }, ui.category === 'fav' && !q ? 'Star a surface to keep it here.' : 'No surfaces match. Try describing it as a scene below.'));
      return;
    }
    lib.replaceChildren(...list.map((s) => {
      const img = h('div', { class: 'ss-tile-img', 'data-sid': s.id });
      if (thumbCache.get(s.id)) img.append(h('img', { src: thumbCache.get(s.id), alt: '' }));
      else if (io) io.observe(img); else { thumbQueue.push(img); pumpThumbs(); }
      const fav = favorites.includes(s.id);
      const star = h('span', { class: 'ss-star', role: 'button', tabindex: '0', 'aria-pressed': String(fav), 'aria-label': fav ? `Remove ${s.name} from favorites` : `Add ${s.name} to favorites` }, icon('star'));
      const toggleFav = (ev) => { ev.stopPropagation(); ev.preventDefault(); toggleFavorite(s.id); };
      star.addEventListener('click', toggleFav);
      star.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') toggleFav(ev); });
      return h('button', { class: 'ss-tile', 'aria-pressed': String(p.surfaceId === s.id && !p.custom), title: s.name, onclick: () => chooseSurface(s.id) }, img, h('span', { class: 'ss-tile-name' }, s.name), star);
    }));
  }
  async function toggleFavorite(id) {
    favorites = favorites.includes(id) ? favorites.filter((x) => x !== id) : [...favorites, id];
    renderLibrary();
    try { await storage.put('prefs', { id: 'favorites', ids: favorites, updatedAt: Date.now() }); } catch (e) { toast(e.message); }
  }
  function chooseSurface(id) {
    const s = E.getSurface(id);
    const keep = s.treatments.includes(p.treatmentId);
    const patch = { surfaceId: id, custom: null, quads: {}, selected: Math.min(p.selected, 3), surfaceOverrides: {}, sceneSummary: '', mood: p.custom ? { tags: [] } : p.mood };
    if (!keep) Object.assign(patch, { treatmentId: s.treatments[0], fontIndex: 0, material: { intensity: p.material.intensity ?? 1 } });
    customImg = null;
    set(patch, { what: 'scene', key: 'surface' });
    if (!keep) toast(`Switched to ${E.TREATMENT_MAP[s.treatments[0]].name.toLowerCase()} for ${s.name.toLowerCase()}`);
    renderLibrary();
  }
  onChange((what) => { if (what === 'scene' || what === 'load') renderLibrary(); });

  // --- treatments
  const treats = h('div', { class: 'ss-treats', role: 'group', 'aria-label': 'Writing treatment' });
  left.append(h('section', { class: 'ss-section' }, h('h2', { class: 'ss-h' }, 'Writing', h('small', {}, 'How the words are made')), treats));
  function renderTreats() {
    const recs = p.custom ? [] : surface().treatments;
    const order = [...E.TREATMENTS].sort((a, b) => (recs.indexOf(a.id) + 1 || 99) - (recs.indexOf(b.id) + 1 || 99));
    treats.replaceChildren(...order.map((t) => h('button', { class: 'ss-treat', 'aria-pressed': String(p.treatmentId === t.id), onclick: () => chooseTreatment(t.id) },
      h('b', {}, t.name), h('span', {}, t.blurb), recs.includes(t.id) ? h('span', { class: 'ss-rec', title: `Suggested for ${surface().name}` }, 'SUGGESTED') : null)));
  }
  async function chooseTreatment(id) {
    const t = E.TREATMENT_MAP[id];
    await E.loadFonts(fontsFor(t), [40]);
    set({ treatmentId: id, fontIndex: 0, material: { intensity: p.material.intensity ?? 1 }, emphasis: { ...p.emphasis, style: null } }, { key: 'treat' });
  }
  onChange(renderTreats);

  // --- scene prompt & photo
  const promptTa = h('textarea', { class: 'ss-textarea', id: 'ss-prompt', style: { minHeight: '72px', fontSize: '14px' }, placeholder: 'e.g. a foggy diner window at night, rain outside', 'aria-label': 'Describe a scene' });
  const providerSel = providers.length > 1 ? h('select', { class: 'ss-select', id: 'ss-provider', 'aria-label': 'Scene source' }, ...providers.map((pr) => h('option', { value: pr.id }, pr.name))) : null;
  const sceneBtn = h('button', { class: 'ss-btn', onclick: () => buildScene() }, icon('sparkle'), 'Build scene');
  const sceneResult = h('div', { class: 'ss-scene-result', 'aria-live': 'polite' });
  const fileIn = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Use your own photo', id: 'ss-photo' });
  fileIn.addEventListener('change', () => { if (fileIn.files[0]) usePhoto(fileIn.files[0]); fileIn.value = ''; });
  left.append(h('section', { class: 'ss-section' },
    h('h2', { class: 'ss-h' }, 'Describe a scene', h('small', {}, 'Or bring a photo')),
    promptTa, providerSel, h('div', { class: 'ss-row' }, sceneBtn, h('label', { class: 'ss-btn ghost ss-file' }, icon('image'), 'Use a photo', fileIn)),
    sceneResult));
  promptTa.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) buildScene(); });
  onChange(() => {
    if (document.activeElement !== promptTa && promptTa.value !== (p.scenePrompt || '')) promptTa.value = p.scenePrompt || '';
    sceneResult.replaceChildren();
    if (p.custom) sceneResult.append(h('span', {}, h('b', {}, p.sceneSummary || 'Your photo'), '. Drag the corners on the image to place the writing.'), ' ', h('button', { class: 'ss-btn small ghost', onclick: () => chooseSurface(p.surfaceId) }, 'Back to surfaces'));
    else if (p.sceneSummary) sceneResult.append('Built as ', h('b', {}, p.sceneSummary), '.');
  });
  async function buildScene() {
    const prompt = promptTa.value.trim();
    if (!prompt) { promptTa.focus(); toast('Describe the place you want the words to appear.'); return; }
    const prov = providers.find((x) => x.id === (providerSel?.value || providers[0].id));
    sceneBtn.disabled = true; sceneBtn.lastChild.textContent = prov.kind === 'procedural' ? 'Building…' : 'Generating…';
    try {
      const W = p.size.width, H = p.size.height;
      const res = await prov.generate({ prompt, width: W, height: H, current: p.surfaceId });
      if (res.type === 'image') {
        customImg = await loadImage(res.image);
        set({ custom: { image: res.image, quad: res.quad || [[0.2, 0.32], [0.8, 0.32], [0.8, 0.68], [0.2, 0.68]] }, scenePrompt: prompt, sceneSummary: res.summary || prov.name, mood: { tags: [] } }, { what: 'scene', key: 'scene' });
        ui.adjust = true; emit('ui');
      } else {
        const s = E.getSurface(res.surfaceId);
        const t = res.treatmentId && E.TREATMENT_MAP[res.treatmentId] ? res.treatmentId : (s.treatments.includes(p.treatmentId) ? p.treatmentId : s.treatments[0]);
        await E.loadFonts(fontsFor(E.TREATMENT_MAP[t]), [40]);
        customImg = null;
        set({ surfaceId: s.id, treatmentId: t, fontIndex: t === p.treatmentId ? p.fontIndex : 0, custom: null, quads: {}, mood: res.mood, surfaceOverrides: res.overrides || {}, scenePrompt: prompt, sceneSummary: res.summary, variationSeed: p.variationSeed + 1 }, { what: 'scene', key: 'scene' });
        if (res.confidence === 0) toast("I couldn't match that to a surface, so I kept this one. Try naming a material (brick, napkin, snow…).");
      }
    } catch (e) { toast(e.message || 'Scene generation failed.'); }
    finally { sceneBtn.disabled = false; sceneBtn.lastChild.textContent = 'Build scene'; }
  }
  async function usePhoto(file) {
    try {
      const url = await downscaleImage(file, 2200);
      customImg = await loadImage(url);
      set({ custom: { image: url, quad: [[0.2, 0.32], [0.8, 0.32], [0.8, 0.68], [0.2, 0.68]] }, sceneSummary: file.name.replace(/\.[^.]+$/, ''), mood: { tags: [] } }, { what: 'scene', key: 'scene' });
      ui.adjust = true; emit('ui');
      toast('Drag the four corners to the surface in your photo.');
    } catch (e) { toast(e.message || 'That image could not be opened.'); }
  }

  // ================= CENTER: stage =================
  const canvas = h('canvas', { role: 'img', 'aria-label': 'Preview of your image' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ss-handles');
  svg.hidden = true;
  const dim = h('div', { class: 'ss-dim' });
  const busy = h('div', { class: 'ss-busy' }, 'Rendering');
  const frame = h('div', { class: 'ss-frame' }, canvas, svg, dim);
  const adjustBtn = h('button', { class: 'ss-btn small', 'aria-pressed': 'false', onclick: () => { ui.adjust = !ui.adjust; emit('ui'); } }, icon('corners'), 'Adjust placement');
  const resetQuadBtn = h('button', { class: 'ss-btn small', onclick: () => resetPlacement() }, icon('reset'), 'Reset');
  const canvasWrap = h('div', { class: 'ss-canvas-wrap' }, frame, busy, h('div', { class: 'ss-stage-tools' }, adjustBtn, resetQuadBtn));
  const varStrip = h('div', { class: 'ss-variations', role: 'group', 'aria-label': 'Variations' });
  const stage = h('section', { class: 'ss-stage', 'aria-label': 'Preview' }, canvasWrap, varStrip);
  onChange(() => {
    adjustBtn.setAttribute('aria-pressed', String(ui.adjust));
    resetQuadBtn.hidden = !(p.quads?.[p.selected] || (ui.adjust && !p.custom));
    dim.textContent = `${p.size.width} × ${p.size.height} px`;
    svg.hidden = !ui.adjust;
    drawHandles();
  });

  const varCanvases = [0, 1, 2, 3].map(() => h('canvas'));
  function renderVarStrip() {
    if (p.custom) {
      varStrip.replaceChildren(h('p', { class: 'ss-hint', style: { alignSelf: 'center' } }, 'Placing your writing on your own photo. Variations are available on library surfaces.'));
      return;
    }
    const vs = variations();
    varStrip.replaceChildren(...vs.map((v, i) => h('button', { class: 'ss-var', 'aria-pressed': String(p.selected === i), onclick: () => set({ selected: i }, { what: 'main', key: 'sel' }) },
      h('div', { class: 'ss-var-img' }, varCanvases[i]), h('span', { class: 'ss-var-label' }, E.RECIPES[v.recipe].label, h('small', {}, String(i + 1))))),
    h('div', { class: 'ss-var-actions' },
      h('button', { class: 'ss-btn small', title: 'Generate four new compositions', onclick: () => set({ variationSeed: p.variationSeed + 1, quads: {} }, { what: 'scene', key: 'shuffle' }) }, icon('shuffle'), 'New takes'),
      h('button', { class: 'ss-btn small ghost', title: 'Repaint the surface texture', onclick: () => set({ sceneSeed: p.sceneSeed + 1 }, { what: 'scene', key: 'texture' }) }, 'New texture')));
  }
  onChange((what) => { if (['scene', 'main', 'load', 'ui'].includes(what) || what === 'type') renderVarStrip(); });

  // --- handles (perspective / placement)
  let dragIdx = -1;
  function currentQuad() { return p.custom ? p.custom.quad : (p.quads?.[p.selected] || lastInfo?.quad); }
  function drawHandles() {
    if (svg.hidden) return;
    const q = currentQuad();
    const r = canvas.getBoundingClientRect();
    if (!q || !r.width) return;
    svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    const pts = q.map(([x, y]) => [x * r.width, y * r.height]);
    svg.innerHTML = '';
    const poly = document.createElementNS(svg.namespaceURI, 'polygon');
    poly.setAttribute('points', pts.map((pt) => pt.join(',')).join(' '));
    svg.append(poly);
    pts.forEach(([x, y], i) => {
      const c = document.createElementNS(svg.namespaceURI, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 9);
      c.setAttribute('tabindex', '0'); c.setAttribute('aria-label', ['Top left', 'Top right', 'Bottom right', 'Bottom left'][i] + ' corner');
      c.addEventListener('pointerdown', (e) => { dragIdx = i; svg.setPointerCapture(e.pointerId); history.record(snapshot('quad' + Date.now())); e.preventDefault(); });
      c.addEventListener('keydown', (e) => {
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!d) return; e.preventDefault();
        moveCorner(i, q[i][0] + d[0] * 0.005 * (e.shiftKey ? 5 : 1), q[i][1] + d[1] * 0.005 * (e.shiftKey ? 5 : 1), true);
      });
      svg.append(c);
    });
  }
  svg.addEventListener('pointermove', (e) => {
    if (dragIdx < 0) return;
    const r = canvas.getBoundingClientRect();
    moveCorner(dragIdx, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, false);
  });
  const endDrag = () => { if (dragIdx >= 0) { dragIdx = -1; scheduleRender('main'); } };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  function moveCorner(i, x, y, record) {
    const q = (currentQuad() || []).map((pt) => [...pt]);
    if (!q.length) return;
    q[i] = [Math.max(-0.5, Math.min(1.5, x)), Math.max(-0.5, Math.min(1.5, y))];
    if (p.custom) set({ custom: { ...p.custom, quad: q } }, { what: 'main', record, interactive: !record, key: 'quad' });
    else set({ quads: { ...p.quads, [p.selected]: q } }, { what: 'main', record, interactive: !record, key: 'quad' });
  }
  function resetPlacement() {
    if (p.custom) set({ custom: { ...p.custom, quad: [[0.2, 0.32], [0.8, 0.32], [0.8, 0.68], [0.2, 0.68]] } }, { what: 'main', key: 'quad' });
    else { const qs = { ...p.quads }; delete qs[p.selected]; set({ quads: qs, position: { offsetX: 0, offsetY: 0, rotation: 0, boxScale: 1 } }, { what: 'main', key: 'quad' }); }
  }

  // ================= RIGHT: editing controls =================
  const right = h('aside', { class: 'ss-col ss-right', 'aria-label': 'Edit' });
  const acc = (title, open, ...body) => h('details', { class: 'ss-acc', open }, h('summary', {}, title), h('div', { class: 'ss-acc-body' }, ...body));

  function slider({ id, label, min, max, step, get, put, fmt = (v) => v, interactiveKey }) {
    const out = h('output', { for: id });
    const input = h('input', { class: 'ss-range', type: 'range', id, min, max, step });
    input.addEventListener('input', () => { put(parseFloat(input.value), true); out.textContent = fmt(parseFloat(input.value)); });
    input.addEventListener('change', () => { put(parseFloat(input.value), false); });
    onChange(() => { if (document.activeElement !== input) input.value = get(); out.textContent = fmt(get()); });
    return h('div', { class: 'ss-field' }, h('label', { for: id }, label, out), input);
  }
  function seg(id, label, options, get, put) {
    const wrap = h('div', { class: 'ss-seg', role: 'group', 'aria-label': label });
    const btns = options.map(([v, t]) => { const b = h('button', { onclick: () => put(v) }, t); b.dataset.v = v; return b; });
    wrap.append(...btns);
    onChange(() => btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(get())))));
    return h('div', { class: 'ss-field' }, h('span', { class: 'ss-label' }, label), wrap);
  }
  const typo = (k) => (v, live) => set({ typography: { ...p.typography, [k]: v } }, { key: 'typo-' + k, interactive: live, record: true });
  const posi = (k) => (v, live) => set({ position: { ...p.position, [k]: v } }, { key: 'pos-' + k, interactive: live });
  const mat = (k) => (v, live) => set({ material: { ...p.material, [k]: v } }, { key: 'mat-' + k, interactive: live });
  const lit = (k) => (v, live) => set({ lighting: { ...p.lighting, [k]: v } }, { key: 'lit-' + k, interactive: live });
  const pct = (v) => `${Math.round(v * 100)}%`;

  // typography
  const fontSel = h('select', { class: 'ss-select', id: 'ss-font', 'aria-label': 'Font' });
  fontSel.addEventListener('change', () => set({ fontIndex: +fontSel.value }, { key: 'font' }));
  onChange(() => {
    const t = treatment();
    const opts = t.fonts.map((f, i) => `${i}|${f.family}`).join(',');
    if (fontSel.dataset.opts !== opts) { fontSel.dataset.opts = opts; fontSel.replaceChildren(...t.fonts.map((f, i) => h('option', { value: i }, f.family))); }
    fontSel.value = String(Math.min(p.fontIndex, t.fonts.length - 1));
  });
  const inkRow = h('div', { class: 'ss-swatches' });
  const inkPicker = h('input', { type: 'color', class: 'ss-color', 'aria-label': 'Custom ink color', id: 'ss-ink' });
  inkPicker.addEventListener('input', () => set({ ink: inkPicker.value }, { key: 'ink', interactive: true }));
  inkPicker.addEventListener('change', () => set({ ink: inkPicker.value }, { key: 'ink' }));
  onChange(() => {
    inkRow.replaceChildren(
      h('button', { class: 'ss-swatch auto', title: 'Automatic (suits the surface)', 'aria-label': 'Automatic ink color', 'aria-pressed': String(!p.ink), onclick: () => set({ ink: null }, { key: 'ink' }) }),
      ...INK_SWATCHES.map((c) => h('button', { class: 'ss-swatch', style: { background: c }, 'aria-label': `Ink ${c}`, 'aria-pressed': String(p.ink === c), onclick: () => set({ ink: c }, { key: 'ink' }) })),
      inkPicker);
    inkPicker.value = p.ink || E.defaultInk(p.treatmentId, surface());
  });
  const emphStyle = h('select', { class: 'ss-select', id: 'ss-emph-style', 'aria-label': 'Emphasis style' }, ...EMPHASIS_STYLES.map(([v, t]) => h('option', { value: v }, t)));
  emphStyle.addEventListener('change', () => set({ emphasis: { ...p.emphasis, style: emphStyle.value || null } }, { key: 'emph' }));
  const emphColor = h('input', { type: 'color', class: 'ss-color', 'aria-label': 'Emphasis color', id: 'ss-emph-color' });
  emphColor.addEventListener('change', () => set({ emphasis: { ...p.emphasis, color: emphColor.value } }, { key: 'emph' }));
  const emphField = h('div', { class: 'ss-field' }, h('span', { class: 'ss-label' }, 'Emphasis'), h('div', { class: 'ss-row' }, h('div', { style: { flex: '1' } }, emphStyle), emphColor,
    h('button', { class: 'ss-btn small ghost', onclick: () => set({ emphasis: { ...p.emphasis, color: null } }, { key: 'emph' }) }, 'Auto')));
  onChange(() => {
    emphField.hidden = !p.emphasis?.phrase;
    emphStyle.value = p.emphasis?.style || '';
    emphColor.value = p.emphasis?.color || '#e23d2b';
  });
  const balanceCk = h('input', { type: 'checkbox', id: 'ss-balance' });
  balanceCk.addEventListener('change', () => set({ typography: { ...p.typography, balance: balanceCk.checked } }, { key: 'bal' }));
  const rulesCk = h('input', { type: 'checkbox', id: 'ss-rules' });
  rulesCk.addEventListener('change', () => set({ typography: { ...p.typography, snapToLines: rulesCk.checked } }, { key: 'rules' }));
  const rulesLabel = h('label', { class: 'ss-check', for: 'ss-rules' }, rulesCk, 'Sit on the ruled lines');
  onChange(() => { balanceCk.checked = p.typography.balance !== false; rulesCk.checked = p.typography.snapToLines !== false; rulesLabel.hidden = !lastInfo?.hasRules && !/ruled|index/.test(surface().params?.lines || ''); });

  right.append(
    acc('Typography', true,
      h('div', { class: 'ss-field' }, h('label', { for: 'ss-font' }, 'Font'), fontSel),
      slider({ id: 'ss-size', label: 'Size', min: 0.5, max: 1.6, step: 0.01, get: () => p.typography.sizeScale ?? 1, put: typo('sizeScale'), fmt: pct }),
      slider({ id: 'ss-lh', label: 'Line spacing', min: 0.8, max: 2, step: 0.01, get: () => p.typography.lineHeight ?? treatment().lineHeight, put: typo('lineHeight'), fmt: (v) => v.toFixed(2) }),
      slider({ id: 'ss-ls', label: 'Letter spacing', min: -0.05, max: 0.3, step: 0.005, get: () => p.typography.letterSpacing ?? 0, put: typo('letterSpacing'), fmt: (v) => `${(v * 100).toFixed(1)}%` }),
      slider({ id: 'ss-hand', label: 'Hand variation', min: 0, max: 2, step: 0.05, get: () => p.typography.handVariation ?? 1, put: typo('handVariation'), fmt: pct }),
      seg('ss-align', 'Alignment', [['left', 'Left'], ['center', 'Center'], ['right', 'Right']], effAlign, (v) => typo('align')(v, false)),
      seg('ss-valign', 'Vertical', [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']], effVAlign, (v) => typo('valign')(v, false)),
      h('label', { class: 'ss-check', for: 'ss-balance' }, balanceCk, 'Balance line lengths'),
      rulesLabel,
      h('div', { class: 'ss-field' }, h('span', { class: 'ss-label' }, 'Ink color'), inkRow),
      emphField),
    acc('Position', false,
      slider({ id: 'ss-ox', label: 'Move sideways', min: -0.3, max: 0.3, step: 0.005, get: () => p.position.offsetX ?? 0, put: posi('offsetX'), fmt: pct }),
      slider({ id: 'ss-oy', label: 'Move up / down', min: -0.3, max: 0.3, step: 0.005, get: () => p.position.offsetY ?? 0, put: posi('offsetY'), fmt: pct }),
      slider({ id: 'ss-rot', label: 'Rotate', min: -25, max: 25, step: 0.5, get: () => p.position.rotation ?? 0, put: posi('rotation'), fmt: (v) => `${v}°` }),
      slider({ id: 'ss-box', label: 'Text area', min: 0.5, max: 1.3, step: 0.01, get: () => p.position.boxScale ?? 1, put: posi('boxScale'), fmt: pct }),
      h('p', { class: 'ss-hint' }, 'Use “Adjust placement” on the image to change the perspective by dragging corners.')),
    acc('Material', true,
      slider({ id: 'ss-int', label: 'Effect strength', min: 0, max: 1.6, step: 0.01, get: () => p.material.intensity ?? 1, put: mat('intensity'), fmt: pct }),
      slider({ id: 'ss-op', label: 'Opacity', min: 0.3, max: 1, step: 0.01, get: () => effMat('opacity'), put: mat('opacity'), fmt: pct }),
      slider({ id: 'ss-rough', label: 'Rough edges', min: 0, max: 1, step: 0.01, get: () => effMat('roughness'), put: mat('roughness'), fmt: pct }),
      slider({ id: 'ss-grain', label: 'Surface texture', min: 0, max: 1, step: 0.01, get: () => effMat('grain'), put: mat('grain'), fmt: pct }),
      slider({ id: 'ss-bleed', label: 'Ink bleed', min: 0, max: 1.5, step: 0.01, get: () => effMat('bleed'), put: mat('bleed'), fmt: pct }),
      (() => { const f = slider({ id: 'ss-drips', label: 'Drips', min: 0, max: 1, step: 0.01, get: () => effMat('drips'), put: mat('drips'), fmt: pct }); onChange(() => { f.hidden = !['paint', 'spray'].includes(matKind()); }); return f; })(),
      slider({ id: 'ss-light', label: 'Light strength', min: 0, max: 1, step: 0.01, get: () => effLight('strength'), put: lit('strength'), fmt: pct }),
      slider({ id: 'ss-angle', label: 'Light direction', min: -3.14, max: 3.14, step: 0.02, get: () => effLight('angle'), put: lit('angle'), fmt: (v) => `${Math.round((v * 180) / Math.PI)}°` }),
      slider({ id: 'ss-warm', label: 'Warmth', min: -0.6, max: 0.6, step: 0.01, get: () => effLight('warmth'), put: lit('warmth'), fmt: (v) => (v > 0 ? `+${Math.round(v * 100)}` : Math.round(v * 100)) }),
      (() => {
        const row = h('div', { class: 'ss-swatches' });
        onChange(() => row.replaceChildren(...Object.entries(MOOD_LABELS).map(([k, label]) => {
          const on = p.mood?.tags?.includes(k);
          return h('button', { class: 'ss-tab', 'aria-pressed': String(!!on), onclick: () => set({ mood: { ...p.mood, tags: on ? p.mood.tags.filter((x) => x !== k) : [...(p.mood?.tags || []), k] } }, { key: 'mood' }) }, label);
        })));
        return h('div', { class: 'ss-field' }, h('span', { class: 'ss-label' }, 'Mood'), row);
      })(),
      h('button', { class: 'ss-btn small ghost', style: { justifySelf: 'start' }, onclick: () => set({ material: { intensity: 1 }, lighting: { strength: null, angle: null, warmth: null } }, { key: 'matreset' }) }, icon('reset'), 'Reset material')),
  );

  // size
  const presets = h('div', { class: 'ss-presets', role: 'group', 'aria-label': 'Image size' });
  const wIn = h('input', { class: 'ss-num', type: 'number', min: 400, max: 4000, step: 10, id: 'ss-w', 'aria-label': 'Width in pixels' });
  const hIn = h('input', { class: 'ss-num', type: 'number', min: 400, max: 4000, step: 10, id: 'ss-h', 'aria-label': 'Height in pixels' });
  const applyCustom = () => {
    const w = Math.max(400, Math.min(4000, Math.round(+wIn.value || 1080))), hh = Math.max(400, Math.min(4000, Math.round(+hIn.value || 1350)));
    set({ size: { preset: 'custom', width: w, height: hh }, quads: {} }, { what: 'scene', key: 'size' });
  };
  wIn.addEventListener('change', applyCustom); hIn.addEventListener('change', applyCustom);
  onChange(() => {
    presets.replaceChildren(...SIZE_PRESETS.map((s) => h('button', { class: 'ss-preset', 'aria-pressed': String(p.size.preset === s.id), onclick: () => set({ size: { preset: s.id, width: s.width, height: s.height }, quads: {} }, { what: 'scene', key: 'size' }) },
      h('span', {}, s.name), h('small', {}, `${s.width}×${s.height}`))));
    if (document.activeElement !== wIn) wIn.value = p.size.width;
    if (document.activeElement !== hIn) hIn.value = p.size.height;
  });
  right.append(acc('Image size', false, presets, h('div', { class: 'ss-row' }, h('span', { class: 'ss-label' }, 'Custom'), wIn, '×', hIn)));

  // export
  const exportBtn = h('button', { class: 'ss-btn primary', onclick: () => doExport() }, icon('download'), 'Download image');
  const copyBtn = h('button', { class: 'ss-btn', onclick: () => copyImage() }, icon('copy'), 'Copy');
  const styleName = h('input', { class: 'ss-search', placeholder: 'Style name', 'aria-label': 'Style name', id: 'ss-stylename' });
  right.append(acc('Export', true,
    seg('ss-fmt', 'Format', [['png', 'PNG'], ['jpeg', 'JPEG'], ['webp', 'WebP']], () => p.exportFmt.format, (v) => set({ exportFmt: { ...p.exportFmt, format: v } }, { what: 'meta', key: 'fmt' })),
    seg('ss-scale', 'Resolution', [['1', '1×'], ['2', '2×']], () => String(p.exportFmt.scale), (v) => set({ exportFmt: { ...p.exportFmt, scale: +v } }, { what: 'meta', key: 'fmt' })),
    (() => { const f = slider({ id: 'ss-q', label: 'Quality', min: 0.6, max: 1, step: 0.01, get: () => p.exportFmt.quality, put: (v) => set({ exportFmt: { ...p.exportFmt, quality: v } }, { what: 'meta', key: 'q' }), fmt: pct }); onChange(() => { f.hidden = p.exportFmt.format === 'png'; }); return f; })(),
    (() => { const out = h('p', { class: 'ss-hint' }); onChange(() => { out.textContent = `Exports at ${p.size.width * p.exportFmt.scale} × ${p.size.height * p.exportFmt.scale} px.`; }); return out; })(),
    h('div', { class: 'ss-row' }, exportBtn, copyBtn),
    h('div', { class: 'ss-field' }, h('span', { class: 'ss-label' }, 'Reuse this look'),
      h('div', { class: 'ss-row' }, h('div', { style: { flex: '1' } }, styleName), h('button', { class: 'ss-btn small', onclick: () => saveStyle() }, 'Save style')))));

  const mobilebar = h('div', { class: 'ss-mobilebar' },
    h('button', { class: 'ss-btn', onclick: () => set({ variationSeed: p.variationSeed + 1, quads: {} }, { what: 'scene', key: 'shuffle' }) }, icon('shuffle'), 'New takes'),
    h('button', { class: 'ss-btn primary', onclick: () => doExport() }, icon('download'), 'Export'));

  const main = h('main', { class: 'ss-main' }, left, stage, right);
  root.append(top, main, mobilebar);

  // ================= rendering =================
  let renderTimer = 0, renderToken = 0, renderBusy = false, pendingAll = false;
  function scheduleRender(scope = 'main') {
    if (scope === 'all') pendingAll = true;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(runRender, ui.interactive ? 30 : 60);
  }
  async function runRender() {
    const token = ++renderToken;
    const all = pendingAll; pendingAll = false;
    renderBusy = true; busy.classList.add('on');
    await nextFrame();
    try {
      const W = p.size.width, H = p.size.height;
      const box = canvasWrap.getBoundingClientRect();
      const narrow = window.matchMedia('(max-width: 960px)').matches;
      const maxW = Math.max(200, (narrow ? box.width : box.width) - 48), maxH = Math.max(200, narrow ? window.innerHeight * 0.7 : box.height - 60);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const fitK = Math.min(maxW / W, maxH / H);
      const cssW = Math.round(W * fitK), cssH = Math.round(H * fitK);
      let k = Math.min(1, (fitK * dpr)) * (ui.interactive ? 0.6 : 1);
      k = Math.min(k, 1600 / Math.max(W, H));
      const rw = Math.round(W * k), rh = Math.round(H * k);
      const r = E.render(specFor(p.selected, { width: rw, height: rh, quality: ui.interactive ? 0.75 : 1 }));
      if (token !== renderToken) return;
      canvas.width = rw; canvas.height = rh;
      canvas.getContext('2d').drawImage(r.canvas, 0, 0);
      canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
      lastInfo = r.info;
      emit('info');
      if (!ui.interactive) {
        // variation thumbnails (skip when previewing a photo)
        if (!p.custom) {
          const order = [0, 1, 2, 3];
          for (const i of order) {
            await nextFrame();
            if (token !== renderToken) return;
            const tw = 236, th = Math.round((tw * H) / W);
            const tr = i === p.selected ? null : E.render(specFor(i, { width: tw, height: th, quality: 0.8 }));
            const c = varCanvases[i];
            c.width = tw; c.height = th;
            const g = c.getContext('2d');
            g.drawImage(tr ? tr.canvas : canvas, 0, 0, tw, th);
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast(`Rendering failed: ${e.message}`);
    } finally {
      if (token === renderToken) { renderBusy = false; busy.classList.remove('on'); }
    }
    void all;
  }
  new ResizeObserver(() => scheduleRender('main')).observe(canvasWrap);

  // ================= actions =================
  function undo() {
    const prev = history.undo(JSON.stringify(p));
    if (prev) { p = JSON.parse(prev); restoreCustom(); emit('load'); scheduleRender('all'); scheduleSave(); }
  }
  function redo() {
    const nxt = history.redo(JSON.stringify(p));
    if (nxt) { p = JSON.parse(nxt); restoreCustom(); emit('load'); scheduleRender('all'); scheduleSave(); }
  }
  async function restoreCustom() {
    customImg = p.custom?.image ? await loadImage(p.custom.image).catch(() => null) : null;
    await E.loadFonts(fontsFor(treatment()), [40]);
    scheduleRender('all');
  }
  function optimizeLayout() {
    const t = treatment();
    set({ typography: { ...p.typography, balance: true, sizeScale: 1, lineHeight: +(t.lineHeight * 0.92).toFixed(2), letterSpacing: Math.min(p.typography.letterSpacing || 0, 0) },
      position: { ...p.position, boxScale: 1.15, offsetX: 0, offsetY: 0 } }, { key: 'optimize' });
    toast('Layout optimized. Your words are unchanged.');
  }
  function suggestRoomier() {
    const words = E.wordCount(p.text);
    const cands = E.SURFACES.filter((s) => s.maxWords >= words && s.treatments.includes(p.treatmentId) && s.id !== p.surfaceId);
    const pick = cands[0] || E.SURFACES.filter((s) => s.maxWords >= words)[0];
    if (pick) chooseSurface(pick.id);
  }

  function filename(ext) {
    const base = slug(p.name || p.text.split(/\s+/).slice(0, 6).join(' '));
    return `${base}-${p.custom ? 'photo' : p.surfaceId}-${p.size.width * p.exportFmt.scale}x${p.size.height * p.exportFmt.scale}.${ext}`;
  }
  async function renderBlob() {
    await allFontsReady;
    const { format, scale, quality } = p.exportFmt;
    const W = p.size.width * scale, H = p.size.height * scale;
    const r = E.render(specFor(p.selected, { width: W, height: H, quality: 1 }));
    if (!r.info.textVerified) throw new Error('Export stopped: the rendered text did not match your writing.');
    const mime = `image/${format}`;
    const blob = await new Promise((res) => r.canvas.toBlob(res, mime, format === 'png' ? undefined : quality));
    if (!blob) throw new Error('Your browser could not encode that image format. Try PNG.');
    return { blob, mime, ext: format === 'jpeg' ? 'jpg' : format };
  }
  async function doExport() {
    toast('Preparing full-resolution image…', 900);
    try {
      const { blob, mime, ext } = await renderBlob();
      const res = await exporter.save({ blob, filename: filename(ext), mime });
      if (res === 'saved') toast(`Saved ${filename(ext)}`);
      else if (res === 'shown') toast('Long-press or right-click the image to save it.');
    } catch (e) {
      if (e?.code === 'declined') return;
      toast(e.message || 'Export failed.');
    }
  }
  async function copyImage() {
    try {
      if (!window.ClipboardItem || !navigator.clipboard?.write) throw new Error('Copying images is not supported here. Use Download instead.');
      const item = new ClipboardItem({ 'image/png': (async () => { const r = E.render(specFor(p.selected, { width: p.size.width, height: p.size.height, quality: 1 })); return new Promise((res) => r.canvas.toBlob(res, 'image/png')); })() });
      await navigator.clipboard.write([item]);
      toast('Image copied. Paste it into your note.');
    } catch (e) { toast(e.message && !/denied|not allowed/i.test(e.message) ? e.message : 'Copying is blocked here. Use Download instead.'); }
  }

  // ---------- saving ----------
  let saveTimer = 0;
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 1400); }
  async function makeThumb() {
    const tw = 200, th = Math.round((tw * p.size.height) / p.size.width);
    return E.render(specFor(p.selected, { width: tw, height: th, quality: 0.6 })).canvas.toDataURL('image/jpeg', 0.75);
  }
  async function saveNow() {
    ui.saveState = 'saving'; emit('meta-only');
    try {
      const item = { ...p, thumb: await makeThumb(), updatedAt: Date.now() };
      await storage.put('projects', item);
      ui.saveState = 'saved'; ui.saveError = '';
    } catch (e) { ui.saveState = 'error'; ui.saveError = e.message; toast(`Couldn't save: ${e.message}`); }
    emit('meta-only');
  }
  async function saveStyle() {
    const name = styleName.value.trim() || `${treatment().name} on ${p.custom ? 'photo' : surface().name}`;
    try {
      const st = styleFrom(p, name);
      await storage.put('styles', st);
      styles = await storage.list('styles');
      styleName.value = '';
      toast(`Saved style “${name}”`);
    } catch (e) { toast(e.message); }
  }
  async function applyStyle(st) {
    await E.loadFonts(fontsFor(E.TREATMENT_MAP[st.treatmentId]), [40]);
    set({ treatmentId: st.treatmentId, fontIndex: st.fontIndex, ink: st.ink, emphasis: { ...p.emphasis, ...st.emphasis }, typography: { ...st.typography }, material: { ...st.material }, lighting: { ...st.lighting }, mood: st.mood || { tags: [] } }, { key: 'style' });
    toast(`Applied “${st.name}”`);
  }

  // ---------- projects drawer ----------
  let drawerEl = null;
  async function openDrawer() {
    closeDrawer();
    await saveNow();
    let projects = [];
    try { projects = await storage.list('projects'); styles = await storage.list('styles'); } catch (e) { toast(e.message); }
    const body = h('div', { class: 'ss-drawer-body' });
    const render = () => {
      body.replaceChildren(
        h('div', { class: 'ss-row' }, h('button', { class: 'ss-btn primary', onclick: () => { closeDrawer(); loadProject(newProject({ text: '' })); setTimeout(() => ta.focus(), 50); } }, icon('plus'), 'New project'),
          h('button', { class: 'ss-btn', onclick: async () => { const copy = { ...p, id: uid('p'), name: `${p.name || 'Untitled'} copy`, createdAt: Date.now(), updatedAt: Date.now() }; closeDrawer(); loadProject(copy); await saveNow(); toast('Duplicated'); } }, 'Duplicate current')),
        h('h3', { class: 'ss-h' }, 'Projects', h('small', {}, `Saved in ${storage.name.toLowerCase()}`)),
        projects.length ? h('div', { class: 'ss-plist' }, ...projects.map((pr) => {
          let confirm = false;
          const del = h('button', { class: 'ss-btn small ghost', 'aria-label': `Delete ${pr.name || 'project'}`, onclick: async () => {
            if (!confirm) { confirm = true; del.textContent = 'Confirm delete'; return; }
            await storage.remove('projects', pr.id); projects = projects.filter((x) => x.id !== pr.id);
            if (pr.id === p.id) loadProject(projects[0] ? { ...newProject(), ...projects[0] } : newProject());
            render();
          } }, icon('trash'));
          return h('div', { class: 'ss-pitem' }, pr.thumb ? h('img', { src: pr.thumb, alt: '' }) : h('img', { alt: '' }),
            h('div', { class: 'ss-pitem-text' }, h('b', {}, pr.name || (pr.text || 'Untitled').slice(0, 40)), h('small', {}, `${pr.custom ? 'Photo' : E.getSurface(pr.surfaceId).name} · ${new Date(pr.updatedAt || pr.createdAt).toLocaleString()}`)),
            h('div', { class: 'ss-pitem-actions' }, h('button', { class: 'ss-btn small', disabled: pr.id === p.id, onclick: () => { closeDrawer(); loadProject({ ...newProject(), ...pr }); } }, pr.id === p.id ? 'Open now' : 'Open'), del));
        })) : h('p', { class: 'ss-hint' }, 'Nothing saved yet. Your current work saves automatically.'),
        h('h3', { class: 'ss-h' }, 'Saved styles'),
        styles.length ? h('div', { class: 'ss-plist' }, ...styles.map((st) => h('div', { class: 'ss-pitem', style: { gridTemplateColumns: 'minmax(0,1fr) auto' } },
          h('div', { class: 'ss-pitem-text' }, h('b', {}, st.name), h('small', {}, `${E.TREATMENT_MAP[st.treatmentId]?.name || ''} · ${E.TREATMENT_MAP[st.treatmentId]?.fonts[st.fontIndex || 0]?.family || ''}`)),
          h('div', { class: 'ss-pitem-actions' }, h('button', { class: 'ss-btn small', onclick: () => { applyStyle(st); closeDrawer(); } }, 'Apply'),
            h('button', { class: 'ss-btn small ghost', 'aria-label': `Delete style ${st.name}`, onclick: async () => { await storage.remove('styles', st.id); styles = styles.filter((x) => x.id !== st.id); render(); } }, icon('trash')))))) : h('p', { class: 'ss-hint' }, 'Save a look from the Export panel to reuse it on new writing.'),
      );
    };
    render();
    drawerEl = h('div', { class: 'ss-drawer-back', onclick: (e) => { if (e.target === drawerEl) closeDrawer(); } },
      h('div', { class: 'ss-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Projects and styles' },
        h('div', { class: 'ss-drawer-head' }, h('h2', {}, 'Projects'), h('button', { class: 'ss-btn ghost', 'aria-label': 'Close', onclick: closeDrawer }, icon('x'))), body));
    document.body.append(drawerEl);
  }
  function closeDrawer() { drawerEl?.remove(); drawerEl = null; }
  async function loadProject(np) {
    p = np;
    customImg = p.custom?.image ? await loadImage(p.custom.image).catch(() => null) : null;
    await E.loadFonts(fontsFor(treatment()), [40]);
    ta.value = p.text;
    history.past = []; history.future = [];
    emit('load'); emit('scene');
    scheduleRender('all');
  }

  // ---------- toast ----------
  let toastEl = null, toastTimer = 0;
  function toast(msg, ms = 2600) {
    toastEl?.remove();
    toastEl = h('div', { class: 'ss-toast', role: 'status' }, msg);
    document.body.append(toastEl);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl?.remove(); toastEl = null; }, ms);
  }

  // ---------- keyboard ----------
  window.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) { if (e.key === 'Escape') closeDrawer(); return; }
    const inText = ['TEXTAREA', 'INPUT'].includes(document.activeElement?.tagName) && document.activeElement.type !== 'range';
    if (e.key.toLowerCase() === 'z' && !inText) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (e.key.toLowerCase() === 'y' && !inText) { e.preventDefault(); redo(); }
    else if (e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); }
    else if (e.key.toLowerCase() === 'e') { e.preventDefault(); doExport(); }
  });

  // ---------- go ----------
  renderTabs();
  renderLibrary();
  emit('load');
  emit('scene');
  scheduleRender('all');
  allFontsReady.then(() => scheduleRender('all'));

  return {
    get project() { return p; },
    setText: (t) => set({ text: t }, { what: 'text', key: 'text' }),
    chooseSurface, chooseTreatment, exportImage: doExport, save: saveNow,
    lastInfo: () => lastInfo,
  };
}

async function downscaleImage(file, max) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file is not an image this browser can open.')); i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88);
  } finally { URL.revokeObjectURL(url); }
}
