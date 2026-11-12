// 网格寻路。可走区域在 art/walk.json，不写在这里。

export function parseGrid(rows) {
  const height = rows.length;
  const width = rows[0].length;
  const blocked = new Set();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rows[y][x] === '#') blocked.add(y * width + x);
    }
  }
  return { width, height, blocked };
}

export function isWalkable(grid, x, y) {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return false;
  return !grid.blocked.has(y * grid.width + x);
}

export function findPath(grid, start, goal) {
  if (!isWalkable(grid, start[0], start[1]) || !isWalkable(grid, goal[0], goal[1])) return null;
  const key = (x, y) => y * grid.width + x;
  const queue = [start];
  const prev = new Map([[key(start[0], start[1]), null]]);
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === goal[0] && y === goal[1]) {
      const path = [];
      let cur = [x, y];
      while (cur) {
        path.push(cur);
        cur = prev.get(key(cur[0], cur[1]));
      }
      path.reverse();
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isWalkable(grid, nx, ny) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), [x, y]);
      queue.push([nx, ny]);
    }
  }
  return null;
}

export function nearestWalkable(grid, x, y, radius) {
  if (isWalkable(grid, x, y)) return [x, y];
  for (let ring = 1; ring <= radius; ring += 1) {
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        if (isWalkable(grid, x + dx, y + dy)) return [x + dx, y + dy];
      }
    }
  }
  return null;
}

export function planClick(grid, targets, from, pixel, tile = 8) {
  const hit = targets.find(spec => pixel[0] >= spec.hit[0] && pixel[1] >= spec.hit[1] && pixel[0] < spec.hit[2] && pixel[1] < spec.hit[3]);
  let goal;
  let effect = null;
  if (hit) {
    goal = hit.tile;
    effect = hit.effect;
  } else {
    const tx = Math.floor(pixel[0] / tile);
    const ty = Math.floor(pixel[1] / tile);
    const near = nearestWalkable(grid, tx, ty, 4);
    if (!near) return null;
    goal = near;
  }
  const path = findPath(grid, from, goal);
  if (!path) return null;
  return { path, effect };
}

const DIRECTIONS = ['up', 'down', 'left', 'right'];

function normalizeDirection(spec) {
  if (!spec) return null;
  const frames = (spec.frames || []).map(frame => ({
    x: frame.x,
    y: frame.y,
    w: frame.w,
    h: frame.h,
  })).filter(frame => frame.w > 0 && frame.h > 0);
  if (!frames.length) return null;
  const anchor = Array.isArray(spec.anchor) && spec.anchor.length === 2
    ? spec.anchor
    : [frames[0].w / 2, frames[0].h - 2];
  return {
    frames,
    count: frames.length,
    duration: Number(spec.duration) > 0 ? Number(spec.duration) : 160,
    anchor,
    mirror: Boolean(spec.mirror),
  };
}

// 数据里缺某个方向时才用：左=下的镜像，右=下，上=下。有写出来的方向原样用。
export function resolveDirections(data) {
  const raw = data?.directions || {};
  const directions = {};
  for (const name of DIRECTIONS) {
    const spec = normalizeDirection(raw[name]);
    if (spec) directions[name] = spec;
  }
  const down = directions.down || directions.right || directions.left || directions.up;
  if (!down) return directions;
  if (!directions.down) directions.down = { ...down, mirror: false };
  if (!directions.right) directions.right = { ...directions.down, mirror: false };
  if (!directions.left) directions.left = { ...directions.down, mirror: true };
  if (!directions.up) directions.up = { ...directions.down, mirror: false };
  return directions;
}

export function playerPoseKind({ sitting, moving }) {
  if (sitting) return 'sit';
  if (moving) return 'walk';
  return 'stand';
}

// 第 0 帧是该方向的站姿，后面的帧是走路循环。停下用站姿，走动只循环后面的帧。
export function frameAt(spec, elapsedMs, moving = false) {
  const frames = spec.frames;
  if (!frames.length) return null;
  if (!moving || frames.length <= 1) return { index: 0, frame: frames[0], pose: 'stand' };
  const cycle = frames.slice(1);
  const duration = spec.duration > 0 ? spec.duration : 160;
  const index = Math.floor(Math.max(0, elapsedMs) / duration) % cycle.length;
  return { index: index + 1, frame: cycle[index], pose: 'walk' };
}

export function facingOf(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  if (dy < 0) return 'up';
  return 'down';
}
