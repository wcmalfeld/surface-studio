# Surface Studio

Turn short writing into images where the words look physically written, painted, printed or traced onto a real surface — for Substack Notes and other feeds.

The user's text is **never** drawn by an image model. Every image is composed from three independent layers, and every render checks that the drawn characters match the source text exactly.

```
packages/engine     Rendering engine (framework-free JS): scenes, typography, materials, compositor
packages/studio     The studio UI (framework-free JS + CSS), embeddable in any host
apps/prototype      Single-file browser build of the studio (no server)
apps/web            Full-stack Next.js app: REST storage, SQLite, server-side image providers
docs/               Architecture notes and the PRD gap decisions
tools/              Visual test harness (headless Chrome contact sheets)
```

## Quick start

Requires Node 22.13+ (the web app uses the built-in `node:sqlite`).

```bash
npm install
npm test                    # engine unit tests (text accuracy, layout, prompts)
npm run build:prototype     # → apps/prototype/dist/standalone.html (open in a browser)

cp apps/web/.env.example apps/web/.env.local   # optional: add image provider keys
npm run dev:web             # http://localhost:3000
npm run build:web && npm start -w apps/web
```

## How an image is made

| Layer | Module | Cached by | Recomputed when |
|---|---|---|---|
| 1. Scene | `surfaces/*`, `env.js` | surface, size, texture seed, recolor | surface, texture, image size changes |
| 2. Typography | `layout.js`, `typography.js` | text, font, layout settings, region | the words or type settings change |
| 3. Material | `material.js` | typography + material settings | ink/chalk/paint settings change |

`compose.js` merges them only at the end: the text is blended onto the surface plane (ink multiplies into paper, paint skips concrete pits, chalk leaves dust, fingers wipe fog), the surface's relief (creases, mortar, grime) is laid over the ink, then the plane is projected into the frame with perspective, bends or crumples, and a single lighting/grain pass ties it together. Editing the text never regenerates the scene; changing the surface never touches the text.

**Text accuracy.** Layout tokenizes the text with source offsets and only ever breaks lines at whitespace (or between characters of a word too long for the line). `verifyLayout()` rebuilds the drawn string from the layout and compares it to the input; the result is reported on every render (`info.textVerified`), shown in the UI as "Text exact", and export refuses to write a file if it is ever false. Tests cover punctuation, curly quotes, ellipses, emoji, accents, CJK, repeated spaces and hard line breaks.

## Extending

**Add a surface** — append to `packages/engine/src/surfaces/index.js` (or call `registerSurface()` at runtime):

```js
add({
  id: 'slate', name: 'Slate roof tile', category: 'outdoor',
  gen: rock, params: { color: '#4b5157' },   // any generator: ({w,h,rng,seed,p}) => { base, shade?, region, ... }
  aspect: 1.4, tone: 'dark', env: 'forest',
  treatments: ['chalk', 'paint'], maxWords: 20, keywords: ['slate', 'roof'],
});
```

A generator returns `base` (the surface canvas), an optional neutral-gray `shade` overlay (relief drawn over the ink), the text `region`, and optional flags: `rules` (ruled paper), `displace`/`bend` (mesh deformation), `under` + `wipe` (fog/dust that writing removes), `porous`, `glossy`, `emissive`.

**Add a category** — add to `CATEGORIES`; the library picks it up.

**Add a treatment** — append to `TREATMENTS` in `treatments.js` with its fonts, hand jitter and a material kind (`pen`, `pencil`, `marker`, `chalk`, `paint`, `spray`, `print`, `type`, `impress`). New material kinds go in `material.js`.

**Add an image provider** — implement `ImageProvider` in `apps/web/lib/providers/` and list it in `providers/index.ts`. It receives a prompt that asks for a blank surface with no text; it returns a data URL. The user places the writing by dragging four corners. Providers appear in the UI only when their key is set.

## Render spec (engine)

```js
import { render, planVariations } from '@surface-studio/engine';
const [closeup] = planVariations('brick', 1);
const { canvas, info } = render({
  width: 1080, height: 1350, text: 'Start before you’re ready.',
  surfaceId: 'brick', treatmentId: 'spray', variation: closeup,
  emphasis: { phrase: 'ready', style: 'color' },
  typography: { align: 'center', sizeScale: 1 }, position: { rotation: -3 },
  material: { intensity: 1, drips: 0.6 }, lighting: { strength: 0.5 }, mood: { tags: ['night'] },
});
// info: { textVerified, overflow, tooLong, fontSize, quad, ms, ... }
```

## Status

Verified in this build:
- 27 unit tests pass (layout accuracy, ruled-paper baselines, emphasis, prompt interpretation).
- All 61 surfaces render in all four compositions in headless Chrome without errors; text verified exact on every surface with tricky punctuation, emoji and CJK.
- The prototype's end-to-end flow (type → pick surface → scene prompt → choose variation → drag corners → undo → export → projects) runs without console errors at desktop and phone widths, light and dark.
- The web app builds and typechecks; its REST API (save, list, delete, validation, procedural scenes) and browser autosave were exercised against a running server.

Not verified: the OpenAI, Google Imagen and Replicate adapters were written to those APIs' documented shapes but have not been run against live keys. See `docs/ARCHITECTURE.md` for the remaining limitations.
