// 可走区域。格子逻辑在 walk.mjs，坐标改这里。
// 640×360 房间里的家具、座位、热区和障碍，日夜同一套。
// 玩家自己的椅子留在障碍里：站位点在椅前，不踩进椅面。
export const WALK_GRID = {
  scene: { width: 640, height: 360 },
  cell: 4,
  bounds: { left: 4, right: 636, top: 78, bottom: 340 },
  // 早上坐在自己的工位。走路从椅前的交互点出发。
  start: { x: 111, y: 242, facing: 'up' },
  seat: { x: 99, y: 184, w: 25, h: 29 },
  seats: {
    B1: { x: 111, y: 226, interaction: [111, 242] },
    B2: { x: 183, y: 226, interaction: [183, 242] },
    B3: { x: 255, y: 226, interaction: [255, 242] },
  },
  // 饮水机不在底图里。左上 (334,52)，锚点 (346,85)，人物脚底超过 ySort 时画在它前面。
  cooler: { x: 334, y: 52, w: 24, h: 36, anchorX: 346, anchorY: 85, ySort: 85 },
  sprite: { w: 28, h: 44, footX: 14, footY: 43 },
  obstacles: [
    { id: 'bookshelf_manual', x: 18, y: 0, w: 36, h: 82 },
    { id: 'wall_plant', x: 251, y: 0, w: 23, h: 83 },
    { id: 'water_cooler', x: 334, y: 0, w: 24, h: 88 },
    { id: 'fridge', x: 360, y: 0, w: 26, h: 87 },
    { id: 'microwave_cabinet', x: 385, y: 0, w: 41, h: 88 },
    { id: 'plant', x: 431, y: 0, w: 23, h: 83 },
    { id: 'long_table', x: 74, y: 156, w: 216, h: 68 },
    { id: 'chair_T1', x: 100, y: 144, w: 22, h: 12 },
    { id: 'chair_T2', x: 172, y: 144, w: 22, h: 12 },
    { id: 'chair_T3', x: 240, y: 144, w: 22, h: 12 },
    { id: 'chair_B1', x: 99, y: 207, w: 23, h: 27 },
    { id: 'chair_B2', x: 171, y: 207, w: 23, h: 27 },
    { id: 'chair_B3', x: 240, y: 207, w: 23, h: 27 },
    { id: 'sofa', x: 525, y: 142, w: 64, h: 39 },
    { id: 'tea_table', x: 503, y: 201, w: 78, h: 44 },
    { id: 'visitor_chair_L', x: 516, y: 238, w: 21, h: 25 },
    { id: 'visitor_chair_R', x: 546, y: 238, w: 21, h: 25 },
    { id: 'floor_plant_L', x: 16, y: 319, w: 16, h: 12 },
    { id: 'floor_plant_R', x: 616, y: 319, w: 16, h: 12 },
  ],
  targets: {
    boss: {
      x: 520, y: 190, facing: 'right', pose: 'stand',
      hit: [526, 147, 558, 193],
      action: { type: 'talk', person: 'boss' },
      when: 'day',
    },
    lunch: {
      x: 326, y: 228, facing: 'left', pose: 'stand',
      hit: [286, 186, 318, 228],
      action: { type: 'talk', person: 'lunch' },
      when: 'day',
    },
    neighbor: {
      x: 183, y: 242, facing: 'up', pose: 'stand',
      hit: [171, 184, 196, 226],
      action: { type: 'talk', person: 'neighbor' },
      when: 'day',
    },
    computer: {
      x: 111, y: 242, facing: 'up', pose: 'seated',
      hit: [100, 177, 124, 193],
      action: { type: 'computer' },
      when: 'any',
    },
    shelf: {
      x: 36, y: 90, facing: 'up', pose: 'stand',
      hit: [18, 18, 54, 82],
      action: { type: 'shelf' },
      when: 'day',
    },
    water: {
      x: 346, y: 96, facing: 'up', pose: 'stand',
      hit: [334, 52, 358, 88],
      action: { type: 'water' },
      when: 'any',
    },
    door: {
      x: 334, y: 336, facing: 'up', pose: 'stand',
      hit: [316, 324, 352, 342],
      action: { type: 'door' },
      when: 'any',
    },
    party: {
      x: 164, y: 250, facing: 'left', pose: 'stand',
      hit: [134, 208, 151, 250],
      action: { type: 'talk', person: 'party' },
      when: 'night',
    },
  },
  // 当天能看见的人。脚底盒子不能压到这些框，这些格子也走不过去。
  people: {
    day: [
      { id: 'neighbor', x: 170, y: 184, w: 22, h: 29 },
      { id: 'lunch', x: 292, y: 186, w: 20, h: 42 },
      { id: 'boss', x: 534, y: 149, w: 17, h: 44 },
    ],
    night: [
      { id: 'neighbor', x: 170, y: 184, w: 22, h: 29 },
      { id: 'lunch', x: 242, y: 184, w: 26, h: 29 },
      { id: 'boss', x: 535, y: 139, w: 21, h: 40 },
      { id: 'party', x: 134, y: 208, w: 17, h: 42 },
    ],
  },
  nightMute: [
    [536, 139, 555, 179],
    [242, 184, 268, 225],
    [170, 184, 195, 225],
    [18, 18, 54, 82],
  ],
};
