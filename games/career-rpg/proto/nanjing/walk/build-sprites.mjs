// 把设计师的 meta.json 转成加载器使用的 walk.sprites.json。
// node games/career-rpg/proto/nanjing/walk/build-sprites.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
const order = ['idle', ...meta.cycles.walk6];
const directions = {};
for (const name of meta.rows) {
  const frames = order.map(id => {
    const [x, y, w, h] = meta.frames[name][id].rect;
    return { x, y, w, h };
  });
  directions[name] = {
    count: frames.length,
    duration: meta.frame_ms.walk6,
    anchor: meta.foot_anchor,
    mirror: false,
    frames,
  };
}
const sheet = {
  image: 'player-walk-nanjing.png',
  directions,
};
writeFileSync(join(dir, 'walk.sprites.json'), `${JSON.stringify(sheet, null, 2)}\n`);
console.log(`wrote walk.sprites.json (${meta.rows.join(' / ')}, ${order.length} frames, ${meta.frame_ms.walk6}ms)`);
