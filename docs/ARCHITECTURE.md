# Architecture & decisions

## Decisions where the PRD was incomplete

The PRD text ends partway through §5.5 (Generate Variations). These choices fill the rest; each is easy to revisit.

| Area | Decision |
|---|---|
| Variations (§5.5) | Four compositions per surface, chosen to differ in framing, not font size: **Close-up** (camera moves in on the words), **In context** (the surface in its environment — a page on a desk, a facade with sky and sidewalk, ground toward a horizon), **Angled** (3D perspective), **Editorial** (quiet backdrop, generous space). "New takes" re-rolls all four; "New texture" repaints the surface only. |
| Editing (§5 right panel) | Typography (font, size, line/letter spacing, hand variation, alignment, vertical position, line balancing, ruled-line snapping, ink color, emphasis style/color), Position (offset, rotation, text-area size, four-corner perspective handles), Material (strength, opacity, rough edges, texture, bleed, drips, light strength/direction/warmth, mood). |
| Layout optimization (§5.2) | "Optimize layout" changes only layout parameters (balancing, line spacing, text area). The words are never changed. Over-long text triggers a warning with that action and a "roomier surface" suggestion. |
| Emphasis (§5.2 optional) | Select a phrase in the editor → "Emphasize selection". Styles: underline, highlighter, circled, color, heavier. Partial-word emphasis is supported. |
| Export | PNG / JPEG / WebP at 1× or 2×; presets for Substack Note (1080×1350), square, story, landscape, link preview, plus custom sizes 400–4000 px. Copy-to-clipboard where the browser allows. |
| Saving (§4.6) | Projects autosave (with a thumbnail); duplicate, open, delete. Favorite surfaces. Saved styles (treatment, font, type, material, light, mood) apply to any writing. Full undo/redo. |
| Custom scenes (§1) | "Describe a scene" maps free text to a surface, treatment, recolor and mood with the built-in provider; with a key configured, an image model generates a blank photograph instead. Users can also upload their own photo. On photos the writing is placed with four draggable corners. |
| Identity | No accounts in v1. The web app gives each browser an anonymous HTTP-only cookie; `lib/owner.ts` is the single place to swap in real auth. |
| Storage | SQLite via Node's built-in `node:sqlite` behind four functions in `lib/db.ts`. Single-instance only; swap for Postgres/KV when deploying to multiple instances or serverless. |

## Module map

```
engine/src
  util.js          seeded RNG, value noise, blur, homography, mesh warp
  paint.js         procedural painting primitives (mottle, fibers, torn edges, crumple relief…)
  surfaces/        generators (paper, boards, walls, objects) + registry (index.js)
  env.js           environments for in-context shots
  treatments.js    writing treatments: fonts, hand jitter, material kind, default ink
  layout.js        pure text layout + exactness verification (unit-tested)
  typography.js    draws the layout (per-glyph hand jitter, emphasis marks)
  material.js      ink/pencil/marker/chalk/paint/spray/print/type/impress effects
  compose.js       variation planning, framing, caching, compositing, lighting
  prompt.js        scene-prompt interpretation + provider registry
studio/src
  index.js         the workspace UI; hosts inject storage, exporter, providers
  state.js         project model, history, storage adapters (localStorage, memory, REST)
web
  app/api/store    GET list · PUT/DELETE item  (kinds: projects, styles, prefs)
  app/api/scenes   POST → procedural plan or generated photo
  app/api/providers GET → configured image providers (names only)
  lib/providers    OpenAI, Google Imagen, Replicate adapters
```

## Known limitations

- Built-in scenes are procedural textures, not photographs. They read as convincing at feed size; for photographic realism, configure an image provider or upload a photo.
- Image provider adapters are untested against live APIs (no keys were available during the build).
- Rendering runs on the main thread. A full-resolution export takes roughly 0.3–1.5 s; moving rendering into a worker with `OffscreenCanvas` (via `setCanvasFactory`) is the next performance step.
- When perspective pushes a corner far outside the frame, its handle cannot be grabbed; use Reset or the Position sliders.
- Rate limiting for image generation is per process.
- Treatment fonts load from Google Fonts. If they fail to load, the canvas falls back to system fonts (the text stays exact).
