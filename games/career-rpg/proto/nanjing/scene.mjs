// 底图是空房间。人物、门按原像素叠上去，不放大。
// 门的 y-sort 用精灵顶边。脚比顶边更靠下的人画在门前面。

import { CAST, DOOR, PLAYER, WALK } from './layout.mjs';
import { facingOf, findPath, frameAt, parseGrid, planClick, playerPoseKind, resolveDirections } from './walk.mjs';

export { DOOR, WORLD, integerScale } from './layout.mjs';

let meta = null;
let plates = null;
let sheet = null;
const grid = parseGrid(WALK.rows);
let walkData = WALK;
let walkImage = null;
let walkSprites = null;
let doors = null;

const SPEED = 72;

const mover = {
  sitting: true,
  foot: { x: PLAYER.seat[0], y: PLAYER.seat[1] },
  path: [],
  effect: null,
  facing: 'up',
  elapsed: 0,
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

// 坐回自己工位时用坐姿。椅背那一格把红衣服挡住了，用还能看见衣服的背面坐姿。
export function seatedSprite(table) {
  const player = table?.cells?.player;
  const seat = player?.seat_back_body;
  const stand = player?.stand_front;
  if (!seat || seat.empty || !Array.isArray(seat.origin)) return null;
  return {
    pose: 'seat_back_body',
    origin: seat.origin,
    w: seat.w || table.cell?.[0] || 56,
    h: seat.h || table.cell?.[1] || 56,
    standOrigin: stand?.origin || null,
  };
}

export function poseName(id, pose) {
  const cell = meta?.cells?.[id]?.[pose];
  if (cell && !cell.empty) return pose;
  const front = meta?.cells?.[id]?.stand_front;
  if (front && !front.empty) return 'stand_front';
  return 'seat_back_on_chair';
}

export function whenLabel(view) {
  const night = view.ap === 0 || view.overnightUsed;
  return `第 ${view.week} 周 · ${view.dayName}${night ? ' · 夜里' : ''}`;
}

export function paintOrder(mode, playerSortY) {
  const cast = CAST[mode] || CAST.day;
  const items = [{ id: 'door', kind: 'door', sort: DOOR.ySort, x: DOOR.x, y: DOOR.y }];
  for (const actor of cast) {
    items.push({ id: actor.id, kind: 'actor', sort: actor.foot[1], actor });
  }
  items.push({ id: 'player', kind: 'player', sort: playerSortY });
  items.sort((a, b) => a.sort - b.sort || (a.kind === 'door' ? 0 : 1) - (b.kind === 'door' ? 0 : 1));
  return items;
}

export function walker() {
  return {
    sitting: mover.sitting,
    moving: mover.path.length > 0,
    facing: mover.facing,
    foot: mover.foot ? { x: mover.foot.x, y: mover.foot.y } : null,
  };
}

export async function loadArt() {
  if (plates) return;
  const [day, night, sprites, doorDay, doorNight, table, walkSheet] = await Promise.all([
    loadImage('./art/day-640x360.png'),
    loadImage('./art/night-640x360.png'),
    loadImage('./art/sprites.png'),
    loadImage('./art/door-day.png'),
    loadImage('./art/door-night.png'),
    fetch('./art/sprites.meta.json').then(response => {
      if (!response.ok) throw new Error('sprites.meta.json');
      return response.json();
    }),
    fetch('./walk/walk.sprites.json').then(response => {
      if (!response.ok) throw new Error('walk.sprites.json');
      return response.json();
    }),
  ]);
  plates = { day, night };
  doors = { day: doorDay, night: doorNight };
  sheet = sprites;
  meta = table;
  walkData = WALK;
  walkSprites = resolveDirections(walkSheet);
  walkImage = await loadImage(`./walk/${walkSheet.image}`);
}

export function bindWalk(hooks) {
  onArrive = hooks.onArrive;
  requestPaint = hooks.paint;
}

export function sceneMode(view) {
  if (view.phase === 'play' && view.boss.active) return 'boss';
  if (view.ap === 0 || view.overnightUsed) return 'night';
  return 'day';
}

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
  if (effect?.face) mover.facing = effect.face;
  if (effect && (effect.kind === 'seat' || effect.kind === 'computer')) {
    mover.sitting = true;
    mover.foot = { x: PLAYER.seat[0], y: PLAYER.seat[1] };
    mover.facing = 'up';
  }
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
    if (dist > 0.01) {
      const facing = facingOf(dx, dy);
      if (facing !== mover.facing) {
        mover.facing = facing;
        mover.elapsed = 0;
      }
    }
    if (dist < 0.01 || dist <= left) {
      mover.foot = { x: next.x, y: next.y };
      mover.path.shift();
      left -= dist;
    } else {
      mover.foot = { x: mover.foot.x + (dx / dist) * left, y: mover.foot.y + (dy / dist) * left };
      left = 0;
    }
  }
  mover.elapsed += dt * 1000;
  if (!mover.path.length) {
    finish();
    return;
  }
  requestPaint();
  frame = requestAnimationFrame(step);
}

function arm(cells, effect) {
  if (mover.sitting && (effect?.kind === 'computer' || effect?.kind === 'seat')) {
    mover.effect = effect;
    finish();
    return;
  }
  const points = cells.map(tileCenter);
  if (effect?.stand) points[points.length - 1] = { x: effect.stand[0], y: effect.stand[1] };
  if (effect && (effect.kind === 'seat' || effect.kind === 'computer')) {
    points.push({ x: PLAYER.seat[0], y: PLAYER.seat[1] });
  }
  mover.sitting = false;
  if (!mover.foot) mover.foot = { ...points[0] };
  mover.path = points;
  mover.effect = effect;
  mover.elapsed = 0;
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

function drawWalkFrame(ctx, spec, elapsed, moving) {
  if (!walkImage || !spec) return;
  const { frame: cell } = frameAt(spec, elapsed, moving);
  const anchor = spec.anchor;
  const dx = mover.foot.x - anchor[0];
  const dy = mover.foot.y - anchor[1];
  if (!spec.mirror) {
    ctx.drawImage(walkImage, cell.x, cell.y, cell.w, cell.h, dx, dy, cell.w, cell.h);
    return;
  }
  ctx.save();
  ctx.translate(dx + cell.w, dy);
  ctx.scale(-1, 1);
  ctx.drawImage(walkImage, cell.x, cell.y, cell.w, cell.h, 0, 0, cell.w, cell.h);
  ctx.restore();
}

function drawActor(ctx, id, pose, footX, footY) {
  const name = poseName(id, pose);
  const cell = meta?.cells?.[id]?.[name];
  if (!cell || cell.empty || !Array.isArray(cell.origin)) return;
  const [sx, sy] = cell.origin;
  const anchor = cell.foot || [28, 54];
  const cw = meta.cell?.[0] || 56;
  const ch = meta.cell?.[1] || 56;
  ctx.drawImage(sheet, sx, sy, cw, ch, footX - anchor[0], footY - anchor[1], cw, ch);
}

function drawPlayer(ctx) {
  const pose = playerPoseKind({ sitting: mover.sitting, moving: mover.path.length > 0 });
  if (pose === 'sit') {
    drawActor(ctx, 'player', 'seat_back_body', PLAYER.seat[0], PLAYER.seat[1]);
    return;
  }
  drawWalkFrame(ctx, walkSprites?.[mover.facing] || walkSprites?.down, mover.elapsed, pose === 'walk');
}

function drawDoor(ctx, mode) {
  const door = mode === 'night' ? doors?.night : doors?.day;
  if (door) ctx.drawImage(door, DOOR.x, DOOR.y);
}

export function drawScene(canvas, mode) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const plate = mode === 'night' ? plates?.night : plates?.day;
  if (!plate) return;
  ctx.drawImage(plate, 0, 0);
  if (!sheet || !meta) {
    drawDoor(ctx, mode);
    return;
  }
  const playerSort = mover.sitting ? PLAYER.seat[1] : (mover.foot?.y ?? PLAYER.seat[1]);
  for (const item of paintOrder(mode, playerSort)) {
    if (item.kind === 'door') drawDoor(ctx, mode);
    else if (item.kind === 'actor') drawActor(ctx, item.actor.id, item.actor.pose, item.actor.foot[0], item.actor.foot[1]);
    else drawPlayer(ctx);
  }
}
