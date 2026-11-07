// Builds an @font-face stylesheet from local @fontsource files (for offline testing only).
import fs from 'node:fs';
import path from 'node:path';
import { allFontFamilies } from '../packages/engine/src/treatments.js';
const out = [];
for (const f of allFontFamilies()) {
  const id = f.family.toLowerCase().replace(/ /g, '-');
  const dir = path.resolve('node_modules/@fontsource', id, 'files');
  if (!fs.existsSync(dir)) { console.error('missing', id); continue; }
  const files = fs.readdirSync(dir).filter((n) => n.includes('-latin-') && !n.includes('-ext-') && n.endsWith('-normal.woff2'));
  let file = files.find((n) => n.includes(`-${f.weight}-normal`)) || files.find((n) => n.includes('-400-normal')) || files[0];
  if (!file) { console.error('nofile', id); continue; }
  out.push(`@font-face{font-family:"${f.family}";font-weight:${f.weight};src:url("../tools/node_modules/@fontsource/${id}/files/${file}") format("woff2");}`);
}
fs.writeFileSync('local-fonts.css', out.join('\n'));
console.log(out.length, 'faces');
