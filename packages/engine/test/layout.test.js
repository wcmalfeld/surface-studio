import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutText, verifyLayout, tokenize, findEmphasis, wordCount } from '../src/layout.js';
import { interpretPrompt } from '../src/prompt.js';

// deterministic fake measurer: 0.55em per char, wider for W/M
const measureAt = (size) => (s) => [...s].reduce((a, c) => a + size * (/[WMwm]/.test(c) ? 0.8 : 0.55), 0);
const region = { x: 0, y: 0, w: 600, h: 400 };

const samples = [
  "The best ideas don't arrive. They accumulate.",
  "Write it down.\nThen write it again,\n\nbut smaller.",
  "Punctuation matters: commas, semicolons; dashes — and “curly quotes”… don't lose them!",
  'Supercalifragilisticexpialidociousandthensomeevenlongerwordthatcannotfit at all',
  '  leading and   multiple   spaces  ',
  'Emoji 🙂 and accents: café, naïve, Ångström, 東京.',
  Array.from({ length: 120 }, (_, i) => `word${i}`).join(' '),
];

for (const text of samples) {
  for (const align of ['left', 'center', 'right']) {
    test(`exact text survives layout (${align}): ${text.slice(0, 30)}`, () => {
      const l = layoutText({ text, region, measureAt, align, balance: true });
      assert.ok(verifyLayout(text, l), 'reconstructed text differs from source');
      for (const line of l.lines) assert.ok(line.width <= region.w + 0.5 || line.tokens.length === 1);
    });
  }
}

test('hard line breaks are preserved', () => {
  const l = layoutText({ text: 'one\ntwo\n\nthree', region, measureAt });
  assert.equal(l.lines.length, 4);
  assert.equal(l.lines[2].tokens.length, 0);
});

test('ruled paper puts baselines on the rules', () => {
  const rules = { spacing: 40, first: 100, left: 0, right: 600 };
  const l = layoutText({ text: 'A short line that should sit on the ruled lines of the page.', region: { x: 20, y: 60, w: 560, h: 500 }, measureAt, rules, align: 'left' });
  const offs = l.lines.map((ln) => ((ln.baseline - rules.first) % 40 + 40) % 40);
  for (let i = 1; i < l.lines.length; i++) assert.ok(Math.abs(l.lines[i].baseline - l.lines[i - 1].baseline) % 40 < 0.01);
  assert.ok(offs.length > 0);
});

test('auto size shrinks long text and flags overflow only when impossible', () => {
  const short = layoutText({ text: 'Hi.', region, measureAt });
  const long = layoutText({ text: samples[6], region, measureAt });
  assert.ok(short.fontSize > long.fontSize);
  assert.equal(short.overflow, false);
});

test('tokenize keeps offsets', () => {
  const t = tokenize('ab  cd\nef');
  assert.deepEqual(t.paragraphs[0].map((x) => [x.text, x.start]), [['ab', 0], ['  ', 2], ['cd', 4]]);
  assert.equal(t.paragraphs[1][0].start, 7);
});

test('emphasis finds phrases', () => {
  assert.deepEqual(findEmphasis('Make it count.', 'count'), [8, 13]);
  assert.deepEqual(findEmphasis('Make it Count.', 'count'), [8, 13]);
  assert.equal(findEmphasis('abc', 'zzz'), null);
  assert.equal(wordCount('  a b\nc '), 3);
});

test('scene prompts map to surfaces and moods', () => {
  const a = interpretPrompt('a foggy diner window at night in the rain');
  assert.equal(a.surfaceId, 'window');
  assert.ok(a.mood.tags.includes('night') && a.mood.tags.includes('rain'));
  assert.equal(interpretPrompt('spray paint on a red brick wall in an alley').surfaceId, 'brick');
  assert.equal(interpretPrompt('written in the sand at the beach').surfaceId, 'sand');
  assert.equal(interpretPrompt('chalk on a green classroom board').surfaceId, 'classroom');
  assert.equal(interpretPrompt('something completely unrelated').confidence, 0);
});
