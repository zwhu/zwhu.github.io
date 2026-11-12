// 南京房间 640×360。坐标来自美术表，脚底锚点；桌子和人物不另缩放。
// 可走格由边界和不可走矩形生成，寻路只读这里的网格。

export const TILE = 8;

export const WORLD = Object.freeze({ width: 640, height: 360 });

export const BOUNDS = Object.freeze({ left: 4, right: 636, top: 72, bottom: 344 });

export const DOOR = Object.freeze({
  x: 288,
  y: 320,
  w: 64,
  h: 40,
  ySort: 320,
  anchor: Object.freeze([320, 347]),
  spawn: Object.freeze([320, 336]),
  facing: 'up',
});

export const PLAYER = Object.freeze({
  seat: Object.freeze([142, 108]),
  interaction: Object.freeze([142, 120]),
});

const SEATS = Object.freeze({
  TM: Object.freeze([317, 108]),
  TR: Object.freeze([500, 108]),
  BL: Object.freeze([142, 277]),
  BR: Object.freeze([500, 277]),
});

const STAND = Object.freeze({
  TM: Object.freeze([317, 120]),
  TR: Object.freeze([500, 120]),
  BL: Object.freeze([142, 289]),
  BR: Object.freeze([500, 289]),
  pusher: Object.freeze([184, 134]),
  manager: Object.freeze([594, 160]),
  pusherBoss: Object.freeze([100, 150]),
  managerBoss: Object.freeze([184, 150]),
  water: Object.freeze([44, 108]),
  shelf: Object.freeze([588, 80]),
  board: Object.freeze([571, 80]),
});

export const OBSTACLES = Object.freeze([
  Object.freeze([7, 70, 29, 33]),
  Object.freeze([101, 70, 78, 46]),
  Object.freeze([280, 70, 77, 46]),
  Object.freeze([461, 70, 79, 46]),
  Object.freeze([597, 70, 39, 3]),
  Object.freeze([610, 94, 26, 60]),
  Object.freeze([101, 223, 81, 59]),
  Object.freeze([461, 223, 82, 59]),
  Object.freeze([2, 304, 34, 42]),
  Object.freeze([2, 184, 26, 60]),
  Object.freeze([602, 304, 34, 42]),
]);

function tileOf(point) {
  return [Math.floor(point[0] / TILE), Math.floor(point[1] / TILE)];
}

function blocked(tx, ty) {
  const cx = tx * TILE + TILE / 2;
  const cy = ty * TILE + TILE / 2;
  if (cx < BOUNDS.left || cx > BOUNDS.right || cy < BOUNDS.top || cy > BOUNDS.bottom) return true;
  const x0 = tx * TILE;
  const y0 = ty * TILE;
  const x1 = x0 + TILE;
  const y1 = y0 + TILE;
  return OBSTACLES.some(([x, y, w, h]) => x0 < x + w && x1 > x && y0 < y + h && y1 > y);
}

function rows() {
  const cols = WORLD.width / TILE;
  const count = WORLD.height / TILE;
  const grid = [];
  for (let ty = 0; ty < count; ty += 1) {
    let line = '';
    for (let tx = 0; tx < cols; tx += 1) line += blocked(tx, ty) ? '#' : '.';
    grid.push(line);
  }
  return grid;
}

function spot(name, x, y, w, h, stand, effect) {
  return {
    name,
    hit: [x, y, x + w, y + h],
    tile: tileOf(stand),
    effect: { ...effect, stand: [stand[0], stand[1]] },
  };
}

function sharedSpots() {
  return {
    computer: spot('我的电脑', 130, 56, 25, 13, PLAYER.interaction, { kind: 'computer' }),
    seat: spot('我的工位', 122, 78, 40, 36, PLAYER.interaction, { kind: 'seat' }),
    shelf: spot('书架', 597, 3, 40, 71, STAND.shelf, { kind: 'shelf' }),
    mod: spot('版主', 114, 44, 16, 16, PLAYER.interaction, { kind: 'talk', person: 'mod' }),
    feixiang: spot('费翔', 488, 66, 25, 44, STAND.TR, { kind: 'visit' }),
    water: spot('饮水机', 7, 44, 30, 60, STAND.water, { kind: 'water' }),
    board: spot('日活', 553, 8, 37, 36, STAND.board, { kind: 'visit' }),
    door: spot('门口', DOOR.x, DOOR.y, DOOR.w, DOOR.h, DOOR.spawn, { kind: 'door', face: DOOR.facing }),
  };
}

function dayPeople() {
  return {
    pm: spot('催上线的创始人', 174, 90, 19, 44, STAND.pusher, { kind: 'talk', person: 'pm' }),
    boss: spot('管事的创始人', 584, 116, 20, 44, STAND.manager, { kind: 'talk', person: 'boss' }),
    cto: spot('第三位创始人', 304, 66, 25, 44, STAND.TM, { kind: 'visit' }),
    beige: spot('米色新人', 129, 235, 26, 44, STAND.BL, { kind: 'visit' }),
    newbie: spot('新人 4', 488, 235, 25, 44, STAND.BR, { kind: 'visit' }),
  };
}

function mode(extra) {
  return { ...sharedSpots(), ...extra };
}

const seated = [
  { id: 'cto', pose: 'seat_back_body', foot: SEATS.TM },
  { id: 'feixiang', pose: 'seat_back_body', foot: SEATS.TR },
  { id: 'beige', pose: 'seat_back_body', foot: SEATS.BL },
  { id: 'newbie', pose: 'seat_back_body', foot: SEATS.BR },
];

export const CAST = Object.freeze({
  day: Object.freeze([
    ...seated,
    Object.freeze({ id: 'pusher', pose: 'stand_front', foot: STAND.pusher }),
    Object.freeze({ id: 'manager', pose: 'stand_front', foot: STAND.manager }),
  ]),
  night: Object.freeze([
    Object.freeze({ id: 'feixiang', pose: 'seat_back_body', foot: SEATS.TR }),
  ]),
  boss: Object.freeze([
    ...seated,
    Object.freeze({ id: 'pusher', pose: 'stand_front', foot: STAND.pusherBoss }),
    Object.freeze({ id: 'manager', pose: 'stand_front', foot: STAND.managerBoss }),
  ]),
});

export const WALK = Object.freeze({
  tile: TILE,
  rows: rows(),
  start: tileOf(PLAYER.interaction),
  modes: Object.freeze({
    day: Object.freeze(mode(dayPeople())),
    night: Object.freeze(mode({})),
    boss: Object.freeze(mode({
      ...dayPeople(),
      pm: spot('催上线的创始人', 91, 107, 19, 43, STAND.pusherBoss, { kind: 'talk', person: 'pm' }),
      boss: spot('管事的创始人', 175, 106, 18, 44, STAND.managerBoss, { kind: 'talk', person: 'boss' }),
    })),
  }),
});

export function integerScale(availableWidth, worldWidth = WORLD.width) {
  const width = Number(availableWidth);
  if (!Number.isFinite(width) || width < worldWidth) return 1;
  return Math.floor(width / worldWidth);
}
