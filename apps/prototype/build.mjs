// Builds the single-file prototype (dist/surface-studio.html) and a local dev page.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { googleFontsUrls } from '../../packages/engine/src/treatments.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'dist');
fs.mkdirSync(out, { recursive: true });

const res = await build({ entryPoints: [path.join(here, 'src/main.js')], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(here, '../../packages/studio/src/styles.css'), 'utf8');
const uiFonts = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,650&family=Figtree:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap';
const fontLinks = [uiFonts, ...googleFontsUrls()].map((u) => `<link rel="stylesheet" href="${u}">`).join('\n');

const body = `<div id="surface-studio"><p id="ss-boot" style="padding:24px;font:14px system-ui">Loading Surface Studio…</p></div>
<script>${js}</script>`;
const pageCss = `html,body{height:100%}body{background:var(--ss-bg)}#surface-studio{height:100%}
@media (max-width:960px){#surface-studio{height:auto;min-height:100%}}`;

// Artifact page: the publisher wraps it in the document skeleton.
const artifact = `<title>Surface Studio</title>
<meta name="description" content="Turn short writing into images of words written on real surfaces.">
${fontLinks}
<style>${css}
${pageCss}</style>
${body}`;
fs.writeFileSync(path.join(out, 'surface-studio.html'), artifact);

// Standalone page for opening directly in a browser.
const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Surface Studio</title>
${fontLinks}
<style>body{margin:0}${css}
${pageCss}</style>`;
const standalone = `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`;
fs.writeFileSync(path.join(out, 'standalone.html'), standalone);

// Local test page (fonts from node_modules instead of Google; network is not needed).
const local = standalone.replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>\n?/g, '').replace('<head>', '<head><link rel="stylesheet" href="../../../tools/local-fonts.css">');
fs.writeFileSync(path.join(out, 'local.html'), local);
console.log('prototype:', (Buffer.byteLength(artifact) / 1024).toFixed(0), 'KB');
