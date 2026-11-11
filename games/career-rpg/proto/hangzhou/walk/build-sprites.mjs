// 把设计师的 meta.json 转成加载器用的 walk.sprites.json。可重复运行：
// node games/career-rpg/proto/hangzhou/walk/build-sprites.mjs
// 加载器不读 meta.json。四个方向的 mirror 固定为 false，左右各用自己的图。
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const NAMES = ['down', 'up', 'left', 'right'];

export function convertMeta(meta) {
  const frameDuration = meta.frameDuration > 0 ? meta.frameDuration : 160;
  const directions = {};
  for (const name of NAMES) {
    const spec = meta.directions?.[name];
    if (!spec?.file) throw new Error(`meta.json 缺少方向 ${name}`);
    directions[name] = {
      file: spec.file,
      frames: framesOf(spec),
      anchor: spec.anchor || [Math.round((spec.frameWidth || spec.frames[0].w) / 2), spec.frameHeight || spec.frames[0].h],
      mirror: false,
    };
  }
  return { frameDuration, directions };
}

function framesOf(spec) {
  if (spec.frames?.length) {
    return spec.frames.map(item => ({ x: item.x, y: item.y, w: item.w, h: item.h }));
  }
  const width = spec.frameWidth;
  const height = spec.frameHeight;
  const count = spec.count > 0 ? spec.count : 1;
  if (!width || !height) throw new Error(`${spec.file} 缺少 frameWidth/frameHeight 或 frames`);
  const y = spec.y || 0;
  return Array.from({ length: count }, (_, index) => ({
    x: index * width,
    y,
    w: width,
    h: height,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = new URL('.', import.meta.url);
  const meta = JSON.parse(readFileSync(new URL('./meta.json', dir), 'utf8'));
  const json = `${JSON.stringify(convertMeta(meta), null, 2)}\n`;
  writeFileSync(new URL('./walk.sprites.json', dir), json);
}
