// 主角四向帧从 walk/walk.sprites.json 读。缺某个方向时才退回：上=背面，下=正面，左=正面镜像，右=正面。

export const SPRITE_DIRECTIONS = Object.freeze(['down', 'up', 'left', 'right']);

function standFrame(file) {
  return {
    file,
    frames: [{ x: 0, y: 0, w: 28, h: 44 }],
    anchor: [14, 44],
    mirror: false,
  };
}

export function fallbackDirection(name, data = {}) {
  const given = data.directions || {};
  const front = given.down?.frames?.length ? given.down : standFrame('down.png');
  const back = given.up?.frames?.length ? given.up : standFrame('up.png');
  if (name === 'up') return { ...back, mirror: false };
  if (name === 'left') return { ...front, mirror: true };
  return { ...front, mirror: false };
}

export function resolveSprites(data) {
  const frameDuration = data.frameDuration > 0 ? data.frameDuration : 160;
  const directions = {};
  for (const name of SPRITE_DIRECTIONS) {
    const given = data.directions?.[name];
    const spec = given?.frames?.length ? given : fallbackDirection(name, data);
    const frame = spec.frames[0];
    directions[name] = {
      file: spec.file,
      frames: spec.frames.map(item => ({ x: item.x, y: item.y, w: item.w, h: item.h })),
      anchor: spec.anchor || [frame.w / 2, frame.h],
      mirror: Boolean(spec.mirror),
    };
  }
  return { frameDuration, directions };
}

export function frameIndex(frameCount, durationMs, elapsedMs, moving) {
  if (!moving || frameCount <= 1) return 0;
  const duration = durationMs > 0 ? durationMs : 160;
  return Math.floor(elapsedMs / duration) % frameCount;
}
