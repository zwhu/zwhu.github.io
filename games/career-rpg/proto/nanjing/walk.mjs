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

// 精灵表只有正面和背面站姿，没有左右，也没有迈步帧。
export const WALK_FRAME = {
  up: { pose: 'stand_back', flip: false },
  down: { pose: 'stand_front', flip: false },
  left: { pose: 'stand_front', flip: true },
  right: { pose: 'stand_front', flip: false },
};

export function facingOf(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  if (dy < 0) return 'up';
  return 'down';
}
