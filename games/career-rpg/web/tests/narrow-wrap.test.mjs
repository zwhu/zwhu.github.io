import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wrapNarrow} from '../narrow-wrap.mjs';

const root = new URL('../../design/', import.meta.url);
const chapters = ['chapter-hefei.json', 'chapter-01.json', 'chapter-hangzhou.json'].map(name => JSON.parse(readFileSync(new URL(name, root), 'utf8')));
const NO_START = /^[，。、；：？！…—·．,.;:?!%)\]}>》）】》」』〉〕〗’”〞〟％‰℃／～〜]/u;
const NO_END = /[（【《「『〈〔〖‘“([<{]$/u;
const WORD = /[A-Za-z0-9]+(?:[/._+#-][A-Za-z0-9]+)*/g;

function measure(size) {
  return text => {
    let width = 0;
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (ch === ' ' || ch === '\n' || ch === '\t') width += size * 0.33;
      else if (ch === '/' || ch === '.' || ch === '-' || ch === '_' || ch === '+' || ch === '#') width += size * 0.45;
      else if (ch === '\uFE0F' || ch === '\uFE0E' || ch === '\u200D') width += 0;
      else if (ch === '☕' || cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf)) width += size * 1.4;
      else if (cp >= 65 && cp <= 90) width += size * 0.95;
      else if ((cp >= 97 && cp <= 122) || (cp >= 48 && cp <= 57)) width += size * 0.62;
      else width += size;
    }
    return Math.ceil(width - 1e-9);
  };
}

function objectives(data) {
  const texts = [];
  for (const rule of Object.values(data.objectives || {})) {
    if (typeof rule === 'string') { texts.push(rule); continue; }
    if (rule.before) texts.push(rule.before);
    const nexts = (rule.steps || []).map(step => step.text);
    if (rule.elseStep) nexts.push(rule.elseStep);
    if (!nexts.length) nexts.push('');
    for (const template of [rule.pending, rule.done].filter(Boolean)) {
      for (const next of nexts) for (const n of [0, rule.count?.length || 0]) texts.push(template.replaceAll('{n}', String(n)).replaceAll('{next}', next));
    }
  }
  return texts;
}

function dialogue(data) {
  return (data.dialogues || []).map(line => line.playerText ?? line.text ?? '').filter(Boolean);
}

function journey(data) {
  const pack = data.journey;
  if (!pack) return [];
  const groups = [pack.stops || [], pack.toHangzhou?.stops || []];
  return groups.flatMap(stops => stops.length ? [...stops.map(stop => stop.text), stops.map(stop => stop.text).join('')] : []);
}

const contentWidth = 320 - 14 * 2 - 2;
const skillWidth = count => (contentWidth - 6 * (count - 1)) / count;
const slots = [];
for (const data of chapters) {
  const names = (data.skills || []).map(skill => skill.name);
  const count = names.length;
  slots.push({id: `${data.id}:skill`, width: skillWidth(count), size: 10, texts: names});
  slots.push({id: `${data.id}:award`, width: contentWidth, size: 14, texts: names.map(name => `获得技能：${name}`)});
  slots.push({id: `${data.id}:dialogue`, width: contentWidth, size: 14, texts: [...dialogue(data), ...(data.transitions || []).map(item => item.label).filter(Boolean)]});
  slots.push({id: `${data.id}:task`, width: 360, size: 13, texts: objectives(data)});
  slots.push({id: `${data.id}:journey`, width: 900, size: 13, texts: journey(data)});
}
const main = readFileSync(new URL('../main.mjs', import.meta.url), 'utf8');
const extras = [...main.matchAll(/'([^'\n]*[\u4e00-\u9fff][^'\n]*)'/g)].map(match => match[1]);
slots.push({id: 'main:bubble', width: contentWidth, size: 14, texts: extras});

const PROTECTED = ['Webpack', 'React', 'Babel', 'jQuery', 'CI/CD', 'nodejs', 'fibjs', 'NoSQL', 'Linux', 'Java', 'Git', 'Google', 'Alibaba', 'E2E', 'SQL'];

function enumeratedWords(text) {
  const words = [];
  for (const group of text.matchAll(/（([^）]+)）/g)) {
    if (!group[1].includes('、')) continue;
    for (const part of group[1].split('、')) {
      const word = part.trim();
      if ([...word].length >= 2 && [...word].length <= 6) words.push(word);
    }
  }
  return words;
}

function baseChars(line) {
  return [...line].filter(ch => /[\u4e00-\u9fff]/u.test(ch) || /[A-Za-z0-9]/u.test(ch)).length;
}

function assertLines(text, lines, width, size) {
  assert.equal(lines.join(''), text, text);
  assert.equal(lines.join('').replace(/\s+/gu, ''), text.replace(/\s+/gu, ''), text);
  const cursor = [];
  let at = 0;
  for (const line of lines) { cursor.push({start: at, end: at + line.length, line}); at += line.length; }
  for (const match of text.matchAll(WORD)) {
    const end = match.index + match[0].length;
    assert.ok(cursor.some(span => match.index >= span.start && end <= span.end), `${match[0]} split ${JSON.stringify(lines)}`);
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    assert.ok(line.length, 'empty line');
    const start = line.trimStart();
    const end = line.trimEnd();
    if (i > 0 && start) assert.equal(NO_START.test(start), false, `lead ${JSON.stringify(line)}`);
    if (i < lines.length - 1 && end) assert.equal(NO_END.test(end), false, `tail ${JSON.stringify(line)}`);
    assert.ok(measure(size)(end) <= width, `${measure(size)(end)} > ${width} ${JSON.stringify(line)}`);
  }
  for (let i = 0; i < lines.length - 1; i++) {
    const tail = lines[i].trimEnd();
    const next = lines[i + 1].trimStart();
    assert.equal(/[A-Za-z][A-Za-z0-9]*\s+[^\sA-Za-z0-9]$/u.test(tail) && /^[^\sA-Za-z0-9（【《「]/u.test(next), false, `dangling ${tail} | ${next}`);
  }
  const han = measure(size)('字');
  if (lines.length > 1 && width >= han * 3) {
    const tail = lines.at(-1);
    const hans = [...tail].filter(ch => /[\u4e00-\u9fff]/u.test(ch)).join('');
    const wholeWord = enumeratedWords(text).includes(hans) || PROTECTED.includes(hans);
    if (!wholeWord) assert.ok(baseChars(tail) === 0 || baseChars(tail) >= 3, `orphan ${JSON.stringify(tail)} in ${text}`);
  }
  for (const word of [...PROTECTED, ...enumeratedWords(text)]) {
    let at = 0;
    const spans = lines.map(line => { const start = at; at += line.length; return {start, end: at}; });
    let from = 0;
    while (from <= text.length) {
      const index = text.indexOf(word, from);
      if (index < 0) break;
      const end = index + word.length;
      assert.ok(spans.some(span => index >= span.start && end <= span.end), `${word} split ${JSON.stringify(lines)}`);
      from = index + word.length;
    }
  }
}

test('narrow copy from all three chapters stays inside the slot', () => {
  assert.ok(slots.reduce((sum, slot) => sum + slot.texts.length, 0) > 40);
  for (const slot of slots) for (const text of slot.texts) {
    assertLines(text, wrapNarrow(text, slot.width, measure(slot.size)), slot.width, slot.size);
  }
});

function chromeLike(size) {
  return text => {
    let width = 0;
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (ch === ' ') width += size * 0.26;
      else if (ch === '/') width += size * 0.373;
      else if (ch === '\uFE0F' || ch === '\uFE0E' || ch === '\u200D') width += 0;
      else if (ch === '☕') width += size * 1.25;
      else if (cp >= 65 && cp <= 90) width += size * (ch === 'W' ? 0.93 : ch === 'I' ? 0.339 : ch === 'M' ? 0.907 : 0.7);
      else if (cp >= 97 && cp <= 122) width += size * (ch === 'j' ? 0.259 : ch === 'i' || ch === 'l' || ch === 'f' ? 0.32 : 0.56);
      else if (cp >= 48 && cp <= 57) width += size * 0.62;
      else width += size;
    }
    return Math.ceil(width - 1e-9);
  };
}

test('skill names break around product words instead of through them', () => {
  const at = (text, width, size) => wrapNarrow(text, width, chromeLike(size)).map(line => line.trim());
  assert.deepEqual(at('精通 Linux 系统重装', skillWidth(4), 10), ['精通 Linux', '系统重装']);
  assert.deepEqual(at('fibjs／nodejs 做全栈', skillWidth(5), 10), ['fibjs／', 'nodejs', '做全栈']);
  assert.deepEqual(at('React／Webpack', skillWidth(5), 10), ['React／', 'Webpack']);
  assert.deepEqual(at('吃透 Webpack 插件机制', skillWidth(5), 10), ['吃透', 'Webpack', '插件机制']);
  assert.deepEqual(at('吃透 Babel 插件机制', skillWidth(5), 10), ['吃透 Babel', '插件机制']);
  const award = at('获得技能：对上线要有敬畏之心（灰度、观测、回滚）', contentWidth, 14);
  assert.deepEqual(award, ['获得技能：对上线要有敬畏之心', '（灰度、观测、回滚）']);
  const manual = at('去中间的排查电脑，分别看看补测清单和坑点注释；两项都看过后，到右侧书架写下这页手册。', contentWidth, 14);
  assert.equal(manual.at(-1).includes('写下这页手册。'), true, manual.join(' | '));
  assert.ok(baseChars(manual.at(-1)) >= 3);
  const name = at('对上线要有敬畏之心（灰度、观测、回滚）', skillWidth(5), 10);
  assert.ok(name.some(line => line.endsWith('、')), name.join(' | '));
  assert.equal(name.some(line => line.includes('观测') && !line.endsWith('观') && !line.startsWith('测')), true, name.join(' | '));
  for (const word of ['Webpack', 'React', 'Babel', 'jQuery', 'CI/CD', 'nodejs', 'NoSQL']) {
    assert.ok(at(`吃透 ${word} 插件`, skillWidth(5), 10).some(line => line.includes(word)));
  }
});
