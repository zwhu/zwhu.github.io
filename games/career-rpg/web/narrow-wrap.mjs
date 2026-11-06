// Narrow slots share one breaker. The returned lines concatenate back to the
// source, so no spaces are invented. Chinese breaks by character, except a
// two-character word sitting between punctuation (灰度、观测、回滚) stays whole
// and the line prefers to end after 、. Latin words and product tokens stay whole.

const OPEN = new Set([...'（【《「『〈〔〖‘“([{<']);
const CLOSE = new Set([...'，。、；：？！…—·．,.;:?!%)]}>）》」』】〕〉〗’”〞〟％‰℃／～〜']);
const OPEN_BRACKET = new Set([...'（【《「『〈〔〖‘“([{<']);
const CLOSE_BRACKET = new Set([...'）】》」』〉〕〗’”)]}>']);

const isSpace = ch => /\s/u.test(ch);
const isAsciiWord = cp => (cp >= 48 && cp <= 57) || (cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122);
const isConnector = ch => ch === '/' || ch === '.' || ch === '_' || ch === '+' || ch === '-' || ch === '#';
const isEmoji = cp => (cp >= 0x2600 && cp <= 0x27bf) || cp >= 0x1f000;
const isHan = ch => /[\u4e00-\u9fff]/u.test(ch);

function protectedRanges(text) {
  const ranges = [];
  const re = /(?<=^|[、，。；：？（(])[\u4e00-\u9fff]{2}(?=$|[、，。；：？）)])/gu;
  for (const match of text.matchAll(re)) ranges.push([match.index, match.index + match[0].length]);
  return ranges;
}

function tokenize(text) {
  const glyphs = [];
  const paired = protectedRanges(text);
  let i = 0;
  const pairAt = index => paired.find(([start]) => start === index);
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
    const pair = pairAt(i);
    if (pair) {
      glyphs.push({kind: 'word', start: pair[0], end: pair[1]});
      i = pair[1];
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

function endsWithClose(text, cluster) {
  const body = text.slice(cluster.start, cluster.end);
  return [...body].some(ch => CLOSE.has(ch));
}

function baseCount(value) {
  let count = 0;
  for (const ch of value) if (isHan(ch) || isAsciiWord(ch.codePointAt(0))) count++;
  return count;
}

function lineText(text, groups, index) {
  const start = index === 0 ? 0 : groups[index][0].start;
  const end = index + 1 < groups.length ? groups[index + 1][0].start : text.length;
  return text.slice(start, end);
}

function avoidShortTail(text, groups, width, measure) {
  if (groups.length < 2 || measure('字') * 3 > width) return groups;
  const prev = groups[groups.length - 2];
  const last = groups[groups.length - 1];
  const finalText = text.slice(last[0].start);
  if (baseCount(finalText) === 0 || baseCount(finalText) >= 3) return groups;
  for (let k = prev.length - 1; k >= 1; k--) {
    if (!endsWithClose(text, prev[k - 1])) continue;
    const tail = text.slice(prev[k].start);
    if (measure(tail) <= width && baseCount(tail) >= 3) {
      groups[groups.length - 2] = prev.slice(0, k);
      groups[groups.length - 1] = prev.slice(k).concat(last);
      return groups;
    }
  }
  while (groups.length >= 2 && baseCount(text.slice(groups[groups.length - 1][0].start)) < 3) {
    const earlier = groups[groups.length - 2];
    const tail = groups[groups.length - 1];
    if (earlier.length < 2) break;
    const moved = earlier[earlier.length - 1];
    const next = text.slice(moved.start);
    if (measure(next) > width) break;
    earlier.pop();
    groups[groups.length - 1] = [moved, ...tail];
  }
  return groups;
}

export function wrapNarrow(text, maxWidth, measure) {
  if (!text) return [];
  const width = Number(maxWidth);
  if (!(width > 0) || measure(text) <= width) return [text];
  const clusters = clusterize(text);
  if (!clusters.length) return [text];
  const groups = [];
  let current = [];
  const slice = items => text.slice(items[0].start, items[items.length - 1].end);
  const fits = items => measure(slice(items)) <= width;
  const commit = () => { if (current.length) groups.push(current); current = []; };

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    if (current.length && startsOpen(text, cluster)) {
      const end = groupEnd(text, clusters, i);
      const alone = text.slice(cluster.start, clusters[end].end);
      const together = text.slice(current[0].start, clusters[end].end);
      if (measure(alone) <= width && measure(together) > width) commit();
    }
    if (current.length && current[current.length - 1].word && !cluster.word) {
      let end = i;
      for (let k = i; k < clusters.length && !clusters[k].word && k - i < 8; k++) {
        end = k;
        const body = text.slice(clusters[k].start, clusters[k].end);
        if ([...body].some(ch => CLOSE.has(ch))) break;
      }
      const together = text.slice(current[0].start, clusters[end].end);
      if (measure(together) > width) commit();
    }
    if (current.length && !fits([...current, cluster])) commit();
    current.push(cluster);
  }
  commit();
  avoidShortTail(text, groups, width, measure);
  const filled = groups.filter(group => group.length);
  const lines = filled.map((group, index) => lineText(text, filled, index));
  return lines.length ? lines : [text];
}
