// 主角四向帧只从 walk/walk.sprites.json 读。缺某个方向时退回同名站姿图，mirror 保持 false。

export const SPRITE_DIRECTIONS = Object.freeze(['down', 'up', 'left', 'right']);

function standFrame(file) {
  return {
    file,
    frames: [{ x: 0, y: 0, w: 28, h: 44 }],
    anchor: [14, 44],
    mirror: false,
  };
}

const FALLBACK_FILE = Object.freeze({
  down: 'down.png',
  up: 'up.png',
  left: 'left.png',
  right: 'right.png',
});

export function fallbackDirection(name) {
  return standFrame(FALLBACK_FILE[name] || 'down.png');
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
  const walkCount = frameCount - 1;
  return 1 + (Math.floor(elapsedMs / duration) % walkCount);
}

export function poseKind({ seated = false, moving = false } = {}) {
  if (seated && !moving) return 'sit';
  if (!moving) return 'stand';
  return 'walk';
}

// 坐下只用坐姿，不回正面站姿。走路跳过第 0 帧（站姿），停下回到该方向的站姿帧。
export function clipFor(sprites, direction, { seated = false, moving = false, elapsedMs = 0 } = {}) {
  const pose = poseKind({ seated, moving });
  if (pose === 'sit') return { pose };
  const spec = sprites.directions[direction] || sprites.directions.down;
  const index = frameIndex(spec.frames.length, sprites.frameDuration, elapsedMs, moving);
  return { pose, index, rect: spec.frames[index], spec };
}
