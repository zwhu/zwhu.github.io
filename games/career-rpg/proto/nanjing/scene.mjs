// 场景板是去掉主角之后的底图。主角在运行时画：坐着用坐姿，走开用站姿。
// 左右没有侧面帧，左行把正面水平翻转，右行用正面。上用背面，下用正面。没有迈步帧。

import { WALK_FRAME, facingOf, findPath, parseGrid, planClick } from './walk.mjs';

let meta = null;
let plates = null;
let sheet = null;
let grid = null;
let walkData = null;

const MISSING_BACK = ['cto', 'feixiang', 'beige', 'newbie'];
const SPEED = 72;

const mover = {
  sitting: true,
  foot: null,
  path: [],
  effect: null,
  facing: 'down',
};

let frame = 0;
let onArrive = () => {};
let requestPaint = () => {};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(src));
    image.src = src;
  });
}

export function poseName(id, pose) {
  const cell = meta?.cells?.[id]?.[pose];
  if (cell && !cell.empty) return pose;
  const front = meta?.cells?.[id]?.stand_front;
  if (front && !front.empty) return 'stand_front';
  return 'seat_back_on_chair';
}

export async function loadArt() {
  if (plates) return;
  const [day, night, boss, sprites, table, walk] = await Promise.all([
    loadImage('./art/day.png'),
    loadImage('./art/night.png'),
    loadImage('./art/boss.png'),
    loadImage('./art/sprites.png'),
    fetch('./art/sprites.meta.json').then(response => {
      if (!response.ok) throw new Error('sprites.meta.json');
      return response.json();
    }),
    fetch('./art/walk.json').then(response => {
      if (!response.ok) throw new Error('walk.json');
      return response.json();
    }),
  ]);
  plates = { day, night, boss };
  sheet = sprites;
  meta = table;
  walkData = walk;
  grid = parseGrid(walk.rows);
  for (const id of MISSING_BACK) {
    if (poseName(id, 'stand_back') !== 'stand_front') throw new Error(`背面缺失未替换 ${id}`);
  }
}

export function bindWalk(hooks) {
  onArrive = hooks.onArrive;
  requestPaint = hooks.paint;
}

export function sceneMode(view) {
  if (view.phase === 'play' && view.boss.active) return 'boss';
  if (view.ap === 0) return 'night';
  return 'day';
}

const STAMPS = {
  day: [
    { id: 'pusher', pose: 'stand_front', x: 95, y: 80 },
    { id: 'manager', pose: 'stand_front', x: 310, y: 104 },
  ],
  night: [],
  boss: [
    { id: 'pusher', pose: 'stand_front', x: 11, y: 96 },
    { id: 'manager', pose: 'stand_front', x: 76, y: 86 },
  ],
};

export function hotspots(mode) {
  const items = walkData?.modes?.[mode] || {};
  return Object.entries(items).filter(([, spec]) => spec.effect.kind !== 'seat').map(([id, spec]) => ({
    id,
    name: spec.name || (spec.effect.kind === 'computer' ? '我的电脑' : '书架'),
    person: spec.effect.person || '',
    x: spec.hit[0],
    y: spec.hit[1],
    w: spec.hit[2] - spec.hit[0],
    h: spec.hit[3] - spec.hit[1],
  }));
}

function tileCenter(tile) {
  return { x: tile[0] * walkData.tile + walkData.tile / 2, y: tile[1] * walkData.tile + walkData.tile / 2 };
}

function currentTile() {
  if (mover.sitting || !mover.foot) return walkData.start;
  return [
    Math.round((mover.foot.x - walkData.tile / 2) / walkData.tile),
    Math.round((mover.foot.y - walkData.tile / 2) / walkData.tile),
  ];
}

function finish() {
  const effect = mover.effect;
  mover.path = [];
  mover.effect = null;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  if (effect && (effect.kind === 'seat' || effect.kind === 'computer')) mover.sitting = true;
  onArrive(effect);
  requestPaint();
}

function step(now) {
  const previous = step.last || now;
  step.last = now;
  const dt = Math.min(0.05, (now - previous) / 1000);
  let left = SPEED * dt;
  while (left > 0 && mover.path.length) {
    const next = mover.path[0];
    const dx = next.x - mover.foot.x;
    const dy = next.y - mover.foot.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01 || dist <= left) {
      mover.foot = { x: next.x, y: next.y };
      mover.path.shift();
      left -= dist;
    } else {
      mover.facing = facingOf(dx, dy);
      mover.foot = { x: mover.foot.x + (dx / dist) * left, y: mover.foot.y + (dy / dist) * left };
      left = 0;
    }
  }
  if (!mover.path.length) {
    finish();
    return;
  }
  requestPaint();
  frame = requestAnimationFrame(step);
}

function arm(cells, effect) {
  const points = cells.map(tileCenter);
  mover.sitting = false;
  if (!mover.foot) mover.foot = { ...points[0] };
  mover.path = points;
  mover.effect = effect;
  if (points.length <= 1 && Math.hypot(mover.foot.x - points[0].x, mover.foot.y - points[0].y) < 1) {
    finish();
    return;
  }
  if (!frame) {
    step.last = 0;
    frame = requestAnimationFrame(step);
  }
}

export function startWalk(id, mode) {
  const spec = walkData?.modes?.[mode]?.[id];
  if (!spec) return;
  const route = findPath(grid, currentTile(), spec.tile);
  if (!route) return;
  arm(route, spec.effect);
}

export function clickGround(x, y, mode) {
  const targets = Object.values(walkData?.modes?.[mode] || {});
  const plan = planClick(grid, targets, currentTile(), [x, y], walkData.tile);
  if (!plan) return;
  arm(plan.path, plan.effect);
}

function drawSprite(ctx, id, pose, footX, footY, flip) {
  const cell = meta.cells[id][pose];
  if (!cell || cell.empty) return;
  const [sx, sy] = cell.origin;
  const anchor = cell.foot || [28, 54];
  const dx = footX - anchor[0];
  const dy = footY - anchor[1];
  if (!flip) {
    ctx.drawImage(sheet, sx, sy, 56, 56, dx, dy, 56, 56);
    return;
  }
  ctx.save();
  ctx.translate(dx + 56, dy);
  ctx.scale(-1, 1);
  ctx.drawImage(sheet, sx, sy, 56, 56, 0, 0, 56, 56);
  ctx.restore();
}

export function drawScene(canvas, mode) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const plate = plates?.[mode];
  if (!plate) return;
  ctx.drawImage(plate, 0, 0);
  if (!sheet || !meta) return;
  for (const stamp of STAMPS[mode] || []) {
    const pose = poseName(stamp.id, stamp.pose);
    const cell = meta.cells[stamp.id][pose];
    if (!cell || cell.empty) continue;
    const [sx, sy] = cell.origin;
    ctx.drawImage(sheet, sx, sy, 56, 56, stamp.x, stamp.y, 56, 56);
  }
  if (mover.sitting) {
    const seat = meta.cells.player.seat_back_on_chair;
    const [sx, sy] = seat.origin;
    ctx.drawImage(sheet, sx, sy, 56, 56, 54, 62, 56, 56);
    return;
  }
  const frameSpec = WALK_FRAME[mover.facing] || WALK_FRAME.down;
  const pose = poseName('player', frameSpec.pose);
  drawSprite(ctx, 'player', pose, mover.foot.x, mover.foot.y, frameSpec.flip);
}
