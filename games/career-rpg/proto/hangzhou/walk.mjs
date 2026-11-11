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

// 走到空地没有效果。同事、电脑、书架、白板只打开现在已有的界面，不在这里改数值。
export function effectFor(spot) {
  if (!spot || !spot.kind || spot.kind === 'ground') return null;
  if (spot.kind === 'colleague') return { type: 'open', who: spot.who };
  if (spot.kind === 'computer') return { type: 'show', id: 'tickets' };
  if (spot.kind === 'shelf') return { type: 'show', id: 'skills' };
  if (spot.kind === 'board') return { type: 'show', id: 'whiteboard' };
  return null;
}
