// Browser prototype entry: picks the best storage and export path available.
import { createStudio, localStorageAdapter, anchorExporter } from '@surface-studio/studio';

const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

/** Saves to the viewer's private area of the artifact database when available. */
async function artifactStorage() {
  const c = window.claude;
  if (!c || typeof c.use !== 'function') return null;
  const [db, user, assets] = await withTimeout(Promise.all([c.use('db'), c.use('user'), c.use('assets')]), 5000) || [];
  if (!db || !user) return null;
  const uid = await user.id().catch(() => null);
  if (!uid) return null;
  const col = db.collection('data/users/' + uid);
  const uploaded = new Map();
  async function externalizePhoto(item) {
    const src = item?.custom?.image;
    if (!src || !src.startsWith('data:')) return item;
    if (!assets) return { ...item, custom: { ...item.custom, image: null } };
    if (!uploaded.has(src)) {
      const blob = await (await fetch(src)).blob();
      const res = await assets.upload(blob);
      uploaded.set(src, res.url);
    }
    return { ...item, custom: { ...item.custom, image: uploaded.get(src) } };
  }
  return {
    name: 'Your account',
    async list(kind) {
      const snap = await col.where('kind', '==', kind).get();
      return snap.docs.map((d) => { try { return JSON.parse(d.data().json); } catch { return null; } }).filter(Boolean)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },
    async put(kind, item) {
      const stored = await externalizePhoto(item);
      let json = JSON.stringify(stored);
      if (json.length > 240000) json = JSON.stringify({ ...stored, thumb: null });
      if (json.length > 240000) throw new Error('This project is too large to save.');
      await col.doc(`${kind}_${item.id}`).set({ kind, updatedAt: Date.now(), json });
      return item;
    },
    async remove(kind, id) { await col.doc(`${kind}_${id}`).delete(); },
  };
}

/** Uses the artifact download prompt when available, else a normal download. */
async function artifactExporter() {
  const c = window.claude;
  const dl = c && typeof c.use === 'function' ? await withTimeout(c.use('downloads'), 5000) : null;
  if (!dl) return anchorExporter();
  return {
    async save({ blob, filename }) {
      try { const r = await dl.save({ filename, data: blob }); return r.status; }
      catch (e) {
        if (e?.code === 'declined') throw { code: 'declined' };
        if (e?.code === 'rate_limited') throw new Error('A save prompt is already open.');
        throw new Error('Downloads are unavailable here.');
      }
    },
  };
}

async function boot() {
  const root = document.getElementById('surface-studio');
  const [store, exporter] = await Promise.all([artifactStorage().catch(() => null), artifactExporter().catch(() => anchorExporter())]);
  window.surfaceStudio = await createStudio(root, { storage: store || localStorageAdapter(), exporter });
  document.getElementById('ss-boot')?.remove();
}
boot().catch((e) => {
  console.error(e);
  const b = document.getElementById('ss-boot');
  if (b) b.textContent = `Surface Studio could not start: ${e.message}`;
});
