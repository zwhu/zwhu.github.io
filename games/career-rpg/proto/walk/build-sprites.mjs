// 把设计师的 meta.json 转成加载器用的 walk.sprites.json。
// node games/career-rpg/proto/walk/build-sprites.mjs
// node games/career-rpg/proto/walk/build-sprites.mjs --check
import { readFileSync, writeFileSync } from 'node:fs';
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

export function convertMeta(meta) {
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

export function spritesText(meta) {
  return `${JSON.stringify(convertMeta(meta), null, 2)}\n`;
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

export function buildSprites(argv = []) {
  const { metaPath, outPath, check } = readArgs(argv);
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  const next = spritesText(meta);
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
