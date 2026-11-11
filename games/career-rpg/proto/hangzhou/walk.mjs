// 网格寻路。障碍只来自传入的格子，不在这里写死桌子和墙。

export function cellOf(x, y, nav) {
  return [Math.floor(x / nav.cell), Math.floor(y / nav.cell)];
}

export function isWalkable(nav, cell) {
  const [x, y] = cell;
  if (x < 0 || y < 0 || x >= nav.cols || y >= nav.rows) return false;
  return nav.grid[y][x] === '1';
}

export function nearestWalkable(nav, x, y) {
  const [cx, cy] = cellOf(x, y, nav);
  let best = null;
  let bestDistance = Infinity;
  for (let row = 0; row < nav.rows; row += 1) {
    for (let col = 0; col < nav.cols; col += 1) {
      if (!isWalkable(nav, [col, row])) continue;
      const distance = Math.abs(col - cx) + Math.abs(row - cy);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = [col, row];
      }
    }
  }
  return best;
}

export function findPath(nav, start, goal) {
  if (!start || !goal || !isWalkable(nav, start) || !isWalkable(nav, goal)) return null;
  const key = cell => `${cell[0]},${cell[1]}`;
  const queue = [start];
  const previous = new Map([[key(start), null]]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current[0] === goal[0] && current[1] === goal[1]) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [current[0] + dx, current[1] + dy];
      const id = key(next);
      if (previous.has(id) || !isWalkable(nav, next)) continue;
      previous.set(id, current);
      queue.push(next);
    }
  }
  if (!previous.has(key(goal))) return null;
  const path = [];
  let current = goal;
  while (current) {
    path.push(current);
    current = previous.get(key(current));
  }
  path.reverse();
  return path;
}

export function cellCenter(nav, cell) {
  return [cell[0] * nav.cell + nav.cell / 2, cell[1] * nav.cell + nav.cell / 2];
}

export function sceneFile({ night = false, boss = false } = {}) {
  if (night) return 'night-384x216.png';
  if (boss) return 'boss-384x216.png';
  return 'day-384x216.png';
}

// 夜里同事已离开，白板也不开门。电脑和书架都打开学习。空地没有效果。
export function effectFor(spot, { night = false } = {}) {
  if (!spot || !spot.kind || spot.kind === 'ground') return null;
  if (night && (spot.kind === 'colleague' || spot.kind === 'board')) return null;
  if (spot.kind === 'colleague') return { type: 'open', who: spot.who };
  if (spot.kind === 'computer') return { type: 'show', id: night ? 'skills' : 'tickets', sit: true };
  if (spot.kind === 'shelf') return { type: 'show', id: 'skills' };
  if (spot.kind === 'board') return { type: 'show', id: 'whiteboard' };
  return null;
}

export function visibleSpots(spots, { night = false } = {}) {
  if (!night) return spots;
  return spots.filter(spot => spot.kind === 'computer' || spot.kind === 'shelf');
}
