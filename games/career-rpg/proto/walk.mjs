import { WALK_GRID, integerScale, viewOrigin } from './walk-grid.mjs';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export { WALK_GRID, integerScale, viewOrigin };

function key(cell) {
  return `${cell[0]},${cell[1]}`;
}

function cellOf(point) {
  const size = WALK_GRID.cell;
  return [Math.floor(point.x / size), Math.floor(point.y / size)];
}

function centerOf(cell) {
  const size = WALK_GRID.cell;
  return { x: cell[0] * size + size / 2, y: cell[1] * size + size / 2 };
}

export function pointBlocked(x, y) {
  const { bounds, obstacles } = WALK_GRID;
  if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return true;
  return obstacles.some(item => x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h);
}

export function footBox(x, y) {
  const w = 14;
  const h = 10;
  return { x: x - w / 2, y: y - h, w, h };
}

export function occupiedBox(point) {
  if (point.pose === 'seated') {
    const seat = WALK_GRID.seat;
    return { x: seat.x, y: seat.y, w: seat.w, h: seat.h };
  }
  return footBox(point.x, point.y);
}

export function boxesOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function peopleAt(night) {
  return night ? WALK_GRID.people.night : WALK_GRID.people.day;
}

function cellBlocked(cell, night) {
  const point = centerOf(cell);
  if (pointBlocked(point.x, point.y)) return true;
  const foot = footBox(point.x, point.y);
  return peopleAt(night).some(person => boxesOverlap(foot, person));
}

export function findPath(from, to, ctx) {
  const night = Boolean(ctx && ctx.night);
  const start = cellOf(from);
  const goal = cellOf(to);
  if (cellBlocked(start, night) || cellBlocked(goal, night)) return null;
  if (start[0] === goal[0] && start[1] === goal[1]) return [];
  const heuristic = cell => Math.abs(cell[0] - goal[0]) + Math.abs(cell[1] - goal[1]);
  const open = [start];
  const openKeys = new Set([key(start)]);
  const cost = new Map([[key(start), 0]]);
  const previous = new Map();
  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i += 1) {
      const score = cost.get(key(open[i])) + heuristic(open[i]);
      const bestScore = cost.get(key(open[best])) + heuristic(open[best]);
      if (score < bestScore) best = i;
    }
    const current = open.splice(best, 1)[0];
    openKeys.delete(key(current));
    if (current[0] === goal[0] && current[1] === goal[1]) {
      const path = [];
      let step = current;
      while (previous.has(key(step))) {
        path.push(centerOf(step));
        step = previous.get(key(step));
      }
      path.reverse();
      return path;
    }
    for (const [dx, dy] of DIRS) {
      const next = [current[0] + dx, current[1] + dy];
      if (cellBlocked(next, night)) continue;
      const nextCost = cost.get(key(current)) + 1;
      if (nextCost >= (cost.get(key(next)) ?? Infinity)) continue;
      cost.set(key(next), nextCost);
      previous.set(key(next), current);
      if (!openKeys.has(key(next))) {
        open.push(next);
        openKeys.add(key(next));
      }
    }
  }
  return null;
}

function inside(point, box) {
  const [x0, y0, x1, y1] = box;
  return point.x >= x0 && point.x < x1 && point.y >= y0 && point.y < y1;
}

export function resolveClick(point, ctx) {
  const night = Boolean(ctx && ctx.night);
  for (const id of ['water', 'door', 'computer']) {
    const target = WALK_GRID.targets[id];
    if (target && inside(point, target.hit)) return { kind: 'go', target, action: target.action };
  }
  if (night) {
    const party = WALK_GRID.targets.party;
    if (inside(point, party.hit)) return { kind: 'go', target: party, action: party.action };
    if (WALK_GRID.nightMute.some(box => inside(point, box))) return { kind: 'none', target: null, action: null };
  } else {
    for (const target of Object.values(WALK_GRID.targets)) {
      if (target.when !== 'day' || !inside(point, target.hit)) continue;
      const action = target.needs === 'canStudy' && !(ctx && ctx.canStudy) ? null : target.action;
      return { kind: 'go', target, action };
    }
  }
  if (pointBlocked(point.x, point.y)) return { kind: 'none', target: null, action: null };
  return {
    kind: 'walk',
    target: { x: point.x, y: point.y, facing: null, pose: 'stand' },
    action: null,
  };
}

export function commitArrival(state, hit, apply) {
  if (!hit || !hit.action) return state;
  return apply(state, hit.action);
}

export function facingOf(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}
