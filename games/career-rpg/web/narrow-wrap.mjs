// Narrow slots (skill names, speech, awards, journey copy) share one breaker.
// Chinese breaks by character. A Latin word, product token (CI/CD, jQuery) or
// emoji stays whole. Closing punctuation stays with the previous character so
// it cannot sit at the start of a line; opening punctuation stays with the next.
// A CJK run after a Latin word moves down together instead of leaving one
// character glued to the word. The last line will not be a single character.

const OPEN = new Set([...'（【《「『〈〔〖‘“([{<']);
const CLOSE = new Set([...'，。、；：？！…—·．,.;:?!%)]}>）》」』】〕〉〗’”〞〟％‰℃／～〜']);
const OPEN_BRACKET = new Set([...'（【《「『〈〔〖‘“([{<']);
const CLOSE_BRACKET = new Set([...'）】》」』〉〕〗’”)]}>']);

const isSpace = ch => /\s/u.test(ch);
const isAsciiWord = cp => (cp >= 48 && cp <= 57) || (cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122);
const isConnector = ch => ch === '/' || ch === '.' || ch === '_' || ch === '+' || ch === '-' || ch === '#';
const isEmoji = cp => (cp >= 0x2600 && cp <= 0x27bf) || cp >= 0x1f000;

function tokenize(text) {
  const glyphs = [];
  let i = 0;
  while (i < text.length) {
    const cp = text.codePointAt(i);
    const ch = String.fromCodePoint(cp);
    if (isSpace(ch)) {
      let j = i + ch.length;
      while (j < text.length && isSpace(String.fromCodePoint(text.codePointAt(j)))) j += String.fromCodePoint(text.codePointAt(j)).length;
      glyphs.push({kind: 'space', start: i, end: j});
      i = j;
      continue;
    }
    if (isAsciiWord(cp)) {
      let j = i + ch.length;
      while (j < text.length) {
        const next = text.codePointAt(j);
        const nextChar = String.fromCodePoint(next);
        if (isAsciiWord(next)) { j += nextChar.length; continue; }
        const after = j + nextChar.length;
        if (isConnector(nextChar) && after < text.length && isAsciiWord(text.codePointAt(after))) { j += nextChar.length; continue; }
        break;
      }
      glyphs.push({kind: 'word', start: i, end: j});
      i = j;
      continue;
    }
    if (isEmoji(cp)) {
      let j = i + ch.length;
      while (j < text.length) {
        const next = text.codePointAt(j);
        if (next !== 0xfe0e && next !== 0xfe0f && next !== 0x200d) break;
        j += String.fromCodePoint(next).length;
        if (next === 0x200d && j < text.length) j += String.fromCodePoint(text.codePointAt(j)).length;
      }
      glyphs.push({kind: 'word', start: i, end: j});
      i = j;
      continue;
    }
    const kind = OPEN.has(ch) ? 'open' : CLOSE.has(ch) ? 'close' : 'char';
    glyphs.push({kind, start: i, end: i + ch.length});
    i += ch.length;
  }
  return glyphs;
}

function clusterize(text) {
  const clusters = [];
  let openStart = -1;
  let spaced = false;
  const push = (start, end, word) => {
    clusters.push({start, end, word, spaceBefore: spaced && clusters.length > 0});
    openStart = -1;
    spaced = false;
  };
  for (const glyph of tokenize(text)) {
    if (glyph.kind === 'space') { spaced = true; continue; }
    if (glyph.kind === 'open') { if (openStart < 0) openStart = glyph.start; continue; }
    if (glyph.kind === 'close') {
      if (clusters.length && openStart < 0) clusters[clusters.length - 1].end = glyph.end;
      else push(openStart >= 0 ? openStart : glyph.start, glyph.end, false);
      continue;
    }
    push(openStart >= 0 ? openStart : glyph.start, glyph.end, glyph.kind === 'word');
  }
  if (openStart >= 0) clusters.push({start: openStart, end: text.length, word: false, spaceBefore: spaced && clusters.length > 0});
  return clusters;
}

function startsOpen(text, cluster) {
  return OPEN_BRACKET.has(text[cluster.start]);
}

function groupEnd(text, clusters, index) {
  let depth = 0;
  let seen = false;
  for (let i = index; i < clusters.length; i++) {
    for (let p = clusters[i].start; p < clusters[i].end;) {
      const ch = String.fromCodePoint(text.codePointAt(p));
      if (OPEN_BRACKET.has(ch)) { depth++; seen = true; }
      else if (CLOSE_BRACKET.has(ch) && depth) depth--;
      p += ch.length;
    }
    if (seen && depth === 0) return i;
  }
  return index;
}

function isOrphan(text, cluster) {
  const body = text.slice(cluster.start, cluster.end);
  const base = [...body].filter(ch => !CLOSE.has(ch));
  return base.length === 1 && !isAsciiWord(base[0].codePointAt(0));
}

function lineText(text, groups, index) {
  const start = index === 0 ? 0 : groups[index][0].start;
  const end = index + 1 < groups.length ? groups[index + 1][0].start : text.length;
  return text.slice(start, end);
}

export function wrapNarrow(text, maxWidth, measure) {
  if (!text) return [];
  const width = Number(maxWidth);
  if (!(width > 0) || measure(text) <= width) return [text];
  // A break keeps the space on the previous line. Reserve that space so the
  // trailing gap still lands inside the slot.
  const limit = Math.max(1, width - measure(' '));
  const clusters = clusterize(text);
  if (!clusters.length) return [text];
  const groups = [];
  let current = [];
  const fits = items => measure(text.slice(items[0].start, items[items.length - 1].end)) <= limit;
  const commit = () => { if (current.length) groups.push(current); current = []; };

  for (let i = 0; i < clusters.length; i++) {
    let cluster = clusters[i];
    if (current.length && startsOpen(text, cluster)) {
      const end = groupEnd(text, clusters, i);
      const alone = text.slice(cluster.start, clusters[end].end);
      const together = text.slice(current[0].start, clusters[end].end);
      if (measure(alone) <= limit && measure(together) > limit) commit();
    }
    // Keep a short CJK phrase with the Latin word when the phrase fits
    // (C 端，). If it does not, move the whole phrase down so one character
    // is not left glued to the word (Linux 系 / 统).
    if (current.length && current[current.length - 1].word && !cluster.word) {
      let end = i;
      for (let k = i; k < clusters.length && !clusters[k].word && k - i < 8; k++) {
        end = k;
        const body = text.slice(clusters[k].start, clusters[k].end);
        if ([...body].some(ch => CLOSE.has(ch))) break;
      }
      const together = text.slice(current[0].start, clusters[end].end);
      if (measure(together) > limit) commit();
    }
    if (current.length && !fits([...current, cluster])) commit();
    if (!current.length) cluster = {...cluster, spaceBefore: false};
    current.push(cluster);
  }
  commit();

  for (let i = groups.length - 1; i >= 1; i--) {
    const line = groups[i];
    const prev = groups[i - 1];
    if (line.length !== 1 || prev.length < 2 || !isOrphan(text, line[0])) continue;
    const moved = prev[prev.length - 1];
    if (moved.word) continue;
    const pulled = [moved, line[0]];
    if (measure(text.slice(moved.start, line[0].end)) > width) continue;
    prev.pop();
    groups[i] = pulled;
  }

  const lines = groups.filter(group => group.length).map((group, index, list) => lineText(text, list, index));
  return lines.length ? lines : [text];
}
