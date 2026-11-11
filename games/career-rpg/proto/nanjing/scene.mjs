// 场景板来自白天 / 夜里 / Boss 三张底图。人物坐在工位上，已经画在底图里。
// 精灵表补画和底图像素对齐的几格。cto、费翔、米色新人、新人 4 没有背面站姿，缺的用正面代替。

let meta = null;
let plates = null;
let sheet = null;

const MISSING_BACK = ['cto', 'feixiang', 'beige', 'newbie'];

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
  const [day, night, boss, sprites, table] = await Promise.all([
    loadImage('./art/day.png'),
    loadImage('./art/night.png'),
    loadImage('./art/boss.png'),
    loadImage('./art/sprites.png'),
    fetch('./art/sprites.meta.json').then(response => {
      if (!response.ok) throw new Error('sprites.meta.json');
      return response.json();
    }),
  ]);
  plates = { day, night, boss };
  sheet = sprites;
  meta = table;
  for (const id of MISSING_BACK) {
    if (poseName(id, 'stand_back') !== 'stand_front') throw new Error(`背面缺失未替换 ${id}`);
  }
}

export function sceneMode(view) {
  if (view.phase === 'play' && view.boss.active) return 'boss';
  if (view.ap === 0) return 'night';
  return 'day';
}

// 脚底对齐底图：坐姿比 layout.json 低 2px，催上线的创始人站姿左 1px。这是导出图上的落点。
const STAMPS = {
  day: [
    { id: 'player', pose: 'seat_back_on_chair', x: 54, y: 62 },
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
  const mod = { person: 'mod', x: 48, y: 36, w: 26, h: 28 };
  if (mode === 'boss') {
    return [
      { person: 'pm', x: 12, y: 96, w: 42, h: 58 },
      { person: 'boss', x: 84, y: 86, w: 42, h: 60 },
      mod,
    ];
  }
  if (mode === 'night') return [mod];
  return [
    { person: 'pm', x: 98, y: 78, w: 42, h: 58 },
    { person: 'boss', x: 314, y: 104, w: 42, h: 56 },
    mod,
  ];
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
}
