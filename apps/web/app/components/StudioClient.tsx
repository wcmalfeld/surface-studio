'use client';
import { useEffect, useRef, useState } from 'react';
import type { SceneProvider } from '@surface-studio/studio';

/** Mounts the framework-free studio and wires it to this app's API. */
export default function StudioClient() {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ createStudio, apiAdapter, anchorExporter }, engine] = await Promise.all([import('@surface-studio/studio'), import('@surface-studio/engine')]);
      const procedural: SceneProvider = engine.getProvider('procedural');
      let remote: SceneProvider[] = [];
      try {
        const r = await fetch('/api/providers');
        const { providers } = await r.json();
        remote = (providers as { id: string; name: string }[]).map((p) => ({
          id: p.id, name: p.name, kind: 'image' as const,
          async generate(req) {
            const res = await fetch('/api/scenes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...req, provider: p.id }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Scene generation failed.');
            return data;
          },
        }));
      } catch { /* built-in scenes still work */ }
      if (cancelled || !ref.current) return;
      await createStudio(ref.current, { storage: apiAdapter('/api'), exporter: anchorExporter(), providers: [procedural, ...remote] });
    })().catch((e) => setError(e?.message || 'Surface Studio could not start.'));
    return () => { cancelled = true; };
  }, []);

  return (
    <div id="studio-root" ref={ref}>
      <p style={{ padding: 24, font: '14px system-ui' }}>{error ? `Surface Studio could not start: ${error}` : 'Loading Surface Studio…'}</p>
    </div>
  );
}
