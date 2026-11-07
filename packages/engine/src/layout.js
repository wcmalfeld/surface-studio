// Text layout. Pure functions (measurement is injected) so the text-accuracy
// guarantees can be unit-tested without a browser.
//
// Guarantee: every character of the source text appears in exactly one token,
// in order. Only whitespace at a soft (automatic) line break is not drawn.

/** Split text into paragraphs (hard breaks) and tokens with source offsets. */
export function tokenize(text) {
  const src = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  const paragraphs = [];
  let offset = 0;
  for (const para of src.split('\n')) {
    const tokens = [];
    const re = /\S+|\s+/g;
    let m;
    while ((m = re.exec(para))) {
      tokens.push({ text: m[0], start: offset + m.index, end: offset + m.index + m[0].length, space: /^\s+$/.test(m[0]) });
    }
    paragraphs.push(tokens);
    offset += para.length + 1;
  }
  return { paragraphs, normalized: src };
}

/** Break one paragraph's tokens into lines no wider than maxW. */
function wrapParagraph(tokens, maxW, measure) {
  const lines = [];
  let cur = [], curW = 0;
  const pushLine = () => {
    // drop trailing whitespace at a soft break
    while (cur.length && cur[cur.length - 1].space) { curW -= cur[cur.length - 1].w; cur.pop(); }
    lines.push({ tokens: cur, width: Math.max(0, curW) });
    cur = []; curW = 0;
  };
  for (const t0 of tokens) {
    const t = { ...t0, w: measure(t0.text) };
    if (t.space && cur.length === 0 && lines.length > 0) continue; // leading space after a soft break
    if (curW + t.w <= maxW || cur.length === 0) {
      if (!t.space && t.w > maxW) {
        // word longer than the line: split by characters (never alters characters)
        if (cur.length) pushLine();
        let piece = '', pieceStart = t.start;
        for (let i = 0; i < t.text.length; i++) {
          const ch = t.text[i];
          if (piece && measure(piece + ch) > maxW) {
            cur.push({ text: piece, start: pieceStart, end: t.start + i, space: false, w: measure(piece) });
            curW = cur[0].w; pushLine();
            piece = ''; pieceStart = t.start + i;
          }
          piece += ch;
        }
        if (piece) { cur.push({ text: piece, start: pieceStart, end: t.end, space: false, w: measure(piece) }); curW = measure(piece); }
        continue;
      }
      cur.push(t); curW += t.w;
    } else if (t.space) {
      // whitespace that overflows: becomes the soft break
      pushLine();
    } else {
      pushLine();
      cur.push(t); curW = t.w;
    }
  }
  if (cur.length || lines.length === 0) pushLine();
  return lines;
}

export function wrap(paragraphs, maxW, measure) {
  const lines = [];
  paragraphs.forEach((p, i) => {
    const pl = wrapParagraph(p, maxW, measure);
    pl.forEach((l, j) => { l.hardBreakAfter = j === pl.length - 1 && i < paragraphs.length - 1; l.paragraph = i; });
    lines.push(...pl);
  });
  return lines;
}

/** Narrowest width that keeps the same number of lines (even, balanced rag). */
function balanceWidth(paragraphs, maxW, measure, count) {
  let lo = maxW * 0.45, hi = maxW;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const ls = wrap(paragraphs, mid, measure);
    if (ls.length <= count && ls.every((l) => l.width <= mid + 0.5)) hi = mid; else lo = mid;
  }
  return hi;
}

/**
 * Lay out text inside a region.
 * opts: { text, region:{x,y,w,h}, measureAt(size)->(str=>width), lineHeight, align,
 *         valign, sizeMode ('auto'|number), minSize, maxSize, balance, rules }
 */
export function layoutText(opts) {
  const { text, region, measureAt, lineHeight = 1.2, align = 'center', valign = 'middle', balance = true, rules = null } = opts;
  const { paragraphs, normalized } = tokenize(text);
  const minSize = opts.minSize ?? 8, maxSize = opts.maxSize ?? region.h * 0.5;
  const fits = (size) => {
    const m = measureAt(size);
    const lh = rules ? rulesLineHeight(size, rules) : size * lineHeight;
    const lines = wrap(paragraphs, region.w, m);
    const tall = lines.length * lh;
    const wide = lines.every((l) => l.width <= region.w + 0.5);
    return { ok: tall <= region.h && wide, lines, lh, m };
  };

  let size;
  if (typeof opts.sizeMode === 'number') size = opts.sizeMode;
  else if (rules) {
    // ruled paper: writing sits on the rules. Use the biggest hand (spanning
    // 1-3 rules) that fits; shrink below one rule only if necessary.
    size = 0;
    for (const k of [2, 1]) {
      const cand = Math.min(maxSize, rules.spacing * 0.95 * k * (rules.sizeAdj || 1));
      if (fits(cand).ok) { size = cand; break; }
    }
    if (!size) {
      let lo = minSize, hi = rules.spacing * 0.95 * (rules.sizeAdj || 1);
      for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; fits(mid).ok ? (lo = mid) : (hi = mid); }
      size = lo;
    }
  } else {
    let lo = minSize, hi = maxSize;
    if (fits(hi).ok) lo = hi;
    for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; fits(mid).ok ? (lo = mid) : (hi = mid); }
    size = lo;
  }

  let { lines, lh, m, ok } = fits(size);
  if (balance && lines.length > 1 && !rules) {
    const bw = balanceWidth(paragraphs, region.w, m, lines.length);
    lines = wrap(paragraphs, bw, m);
  }

  // positions
  const blockH = lines.length * lh;
  let top;
  if (rules) {
    const ruleStep = Math.max(1, Math.round(lh / rules.spacing));
    lh = ruleStep * rules.spacing;
    const block = lines.length * lh;
    const want = valign === 'top' ? region.y : valign === 'bottom' ? region.y + region.h - block : region.y + (region.h - block) / 2;
    // baseline of first line on a rule at or below the desired top
    const firstBase = Math.max(rules.first, Math.round((want + lh * 0.8 - rules.first) / rules.spacing) * rules.spacing + rules.first);
    top = firstBase - lh * 0.8;
  } else {
    top = valign === 'top' ? region.y : valign === 'bottom' ? region.y + region.h - blockH : region.y + (region.h - blockH) / 2;
  }
  const placed = lines.map((l, i) => {
    let x = align === 'left' ? region.x : align === 'right' ? region.x + region.w - l.width : region.x + (region.w - l.width) / 2;
    const baseline = top + i * lh + lh * 0.8;
    const tokens = [];
    for (const t of l.tokens) { tokens.push({ ...t, x }); x += t.w; }
    return { tokens, width: l.width, baseline, hardBreakAfter: l.hardBreakAfter, x: tokens[0]?.x ?? region.x };
  });

  const minW = Math.min(...placed.map((l) => l.x));
  const maxW = Math.max(...placed.map((l) => l.x + l.width));
  return {
    fontSize: size,
    lineHeightPx: lh,
    lines: placed,
    overflow: !ok,
    normalized,
    bbox: { x: minW, y: top, w: maxW - minW, h: blockH },
  };
}

function rulesLineHeight(size, rules) {
  return Math.max(1, Math.ceil((size * 1.0) / (rules.sizeAdj || 1) / rules.spacing - 0.02)) * rules.spacing;
}

/**
 * Rebuild the drawn text from a layout. Soft breaks become a single space so
 * the result can be compared to the source with whitespace normalized.
 */
export function reconstruct(layout) {
  let out = '';
  layout.lines.forEach((l, i) => {
    out += l.tokens.map((t) => t.text).join('');
    if (i < layout.lines.length - 1) out += l.hardBreakAfter ? '\n' : ' ';
  });
  return out;
}

/** True when the layout draws exactly the source characters (whitespace-normalized at soft breaks). */
export function verifyLayout(text, layout) {
  const norm = (s) => s.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n').map((p) => p.replace(/\s+/g, ' ').trim()).join('\n');
  // character-split words are rejoined without a space in reconstruct comparison
  const rebuilt = reconstructExact(layout);
  return norm(rebuilt) === norm(text);
}

function reconstructExact(layout) {
  // Join using source offsets so words split across lines rejoin without spaces.
  let out = '', lastEnd = null;
  for (const l of layout.lines) {
    for (const t of l.tokens) {
      if (lastEnd !== null && t.start > lastEnd) {
        // gap = dropped whitespace or a hard break
        out += layout.normalized.slice(lastEnd, t.start).includes('\n') ? '\n'.repeat((layout.normalized.slice(lastEnd, t.start).match(/\n/g) || []).length) : ' ';
      }
      out += t.text; lastEnd = t.end;
    }
  }
  return out;
}

/** Find the emphasis phrase in the text: returns [start, end) or null. */
export function findEmphasis(text, phrase) {
  if (!phrase || !phrase.trim()) return null;
  const src = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  let i = src.indexOf(phrase);
  if (i < 0) i = src.toLowerCase().indexOf(phrase.toLowerCase());
  return i < 0 ? null : [i, i + phrase.length];
}

export function wordCount(text) { return (text.trim().match(/\S+/g) || []).length; }
