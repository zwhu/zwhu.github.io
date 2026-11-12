// 把设计师的 meta.json 转成加载器用的 walk.sprites.json。
// node games/career-rpg/proto/walk/build-sprites.mjs
// node games/career-rpg/proto/walk/build-sprites.mjs --check
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DIRECTIONS = ['down', 'up', 'left', 'right'];

function sizeOf(value, fallback) {
  if (!value) return fallback;
  if (Array.isArray(value)) return { w: value[0], h: value[1] };
  return { w: value.w, h: value.h };
}

function rect(frame, imageSize) {
  return {
    x: frame?.x ?? 0,
    y: frame?.y ?? 0,
    w: frame?.w ?? imageSize.w,
    h: frame?.h ?? imageSize.h,
  };
}

function box(value) {
  return { x: value[0], y: value[1], w: value[2], h: value[3] };
}

function point(value) {
  return { x: value[0], y: value[1] };
}

function walkCycle(meta) {
  const cycles = meta.cycles || {};
  const timing = meta.frame_ms || {};
  const names = Object.keys(cycles).filter(name => name !== 'stand' && timing[name] != null);
  names.sort((a, b) => cycles[b].length - cycles[a].length);
  const name = names[0];
  if (!name) return { frames: meta.cols?.filter(col => col !== 'idle') || [], frameMs: 160 };
  return { frames: cycles[name], frameMs: timing[name] };
}

function sheetDirection(meta, facing, image, imageSize, cycle) {
  const row = meta.frames?.[facing] || meta.frames?.down;
  const standName = meta.cycles?.stand?.[0] || 'idle';
  const idle = box(row[standName].rect);
  const anchor = point(row[standName].foot || meta.foot_anchor);
  const frames = cycle.frames.map(name => box(row[name].rect));
  return {
    image,
    mirror: false,
    anchor,
    imageSize,
    frameMs: cycle.frameMs,
    frameCount: frames.length,
    idle,
    frames,
  };
}

export function convertMeta(meta, options = {}) {
  if (meta.frames && meta.rows) {
    const image = options.image;
    const imageSize = options.imageSize;
    const cycle = walkCycle(meta);
    const directions = {};
    for (const facing of (meta.rows.length ? meta.rows : DIRECTIONS)) {
      if (!DIRECTIONS.includes(facing)) continue;
      directions[facing] = sheetDirection(meta, facing, image, imageSize, cycle);
    }
    for (const facing of DIRECTIONS) {
      if (!directions[facing]) directions[facing] = sheetDirection(meta, 'down', image, imageSize, cycle);
    }
    return {
      frameMs: cycle.frameMs,
      directions,
      fallback: {
        down: { use: 'down', mirror: false },
        up: { use: 'up', mirror: false },
        left: { use: 'down', mirror: false },
        right: { use: 'down', mirror: false },
      },
    };
  }
  const frameMs = meta.frameMs ?? 160;
  const imageSize = sizeOf(meta.imageSize || meta.cell, { w: 28, h: 44 });
  const anchor = meta.anchor || { x: Math.floor(imageSize.w / 2), y: imageSize.h - 1 };
  const source = meta.directions || {};
  const front = source.down || source.up;
  const back = source.up || source.down;
  const directions = {};
  for (const facing of DIRECTIONS) {
    const own = source[facing];
    const fill = facing === 'up' ? back : (own || front);
    const used = own || fill;
    const sheet = sizeOf(used?.imageSize, imageSize);
    const frames = (used?.frames?.length ? used.frames : [{ x: 0, y: 0, w: sheet.w, h: sheet.h }]).map(frame => rect(frame, sheet));
    directions[facing] = {
      image: used.image,
      mirror: false,
      anchor: used.anchor || anchor,
      imageSize: sheet,
      frameMs: used.frameMs ?? frameMs,
      frameCount: frames.length,
      idle: used.idle || frames[0],
      frames,
    };
  }
  return {
    frameMs,
    directions,
    fallback: {
      down: { use: 'down', mirror: false },
      up: { use: 'up', mirror: false },
      left: { use: 'down', mirror: false },
      right: { use: 'down', mirror: false },
    },
  };
}

export function pngSize(file) {
  const buf = readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

export function spritesText(meta, options) {
  return `${JSON.stringify(convertMeta(meta, options), null, 2)}\n`;
}

function readArgs(argv) {
  const dir = path.dirname(new URL(import.meta.url).pathname);
  let metaPath = path.join(dir, 'meta.json');
  let outPath = path.join(dir, 'walk.sprites.json');
  let check = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') check = true;
    else if (arg === '--meta') metaPath = path.resolve(argv[++i]);
    else if (arg === '--out') outPath = path.resolve(argv[++i]);
  }
  return { metaPath, outPath, check };
}

function sheetFile(metaPath, meta) {
  if (meta.image) return path.resolve(path.dirname(metaPath), meta.image);
  const dir = path.dirname(metaPath);
  const pngs = readdirSync(dir).filter(name => name.endsWith('.png') && !name.includes('preview') && !name.includes('-x4'));
  if (pngs.length !== 1) throw new Error(`walk/ 里应有一张帧表，现在是 ${pngs.join(', ')}`);
  return path.join(dir, pngs[0]);
}

export function buildSprites(argv = []) {
  const { metaPath, outPath, check } = readArgs(argv);
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  const imagePath = meta.frames ? sheetFile(metaPath, meta) : '';
  const next = spritesText(meta, imagePath ? { image: path.basename(imagePath), imageSize: pngSize(imagePath) } : {});
  if (check) {
    const current = readFileSync(outPath, 'utf8');
    return { changed: current !== next, outPath };
  }
  writeFileSync(outPath, next);
  return { changed: true, outPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = buildSprites(process.argv.slice(2));
  if (process.argv.includes('--check') && result.changed) {
    console.error('walk.sprites.json 和 meta.json 不一致，重新跑 build-sprites.mjs');
    process.exit(1);
  }
}
