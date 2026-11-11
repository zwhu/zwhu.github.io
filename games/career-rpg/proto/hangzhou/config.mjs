// 行动点、体力、熬夜、Dota 的数字从合肥配置引用。杭州自己的交付分、技术债、模块和技能也集中在这里。
import { CONFIG as HEFEI } from '../config.mjs';

export const LINES = Object.freeze([
  Object.freeze({ id: 'taobao', name: '淘宝' }),
  Object.freeze({ id: 'tmall', name: '天猫' }),
  Object.freeze({ id: 'xianyu', name: '闲鱼' }),
  Object.freeze({ id: 'fliggy', name: '飞猪' }),
  Object.freeze({ id: 'hema', name: '盒马' }),
]);

// 抽模块时选的五种字段。example 是单子上写给人看的那一列。
// similar 是 Webpack 学成后，这个模块额外覆盖的相近字段。
export const FIELDS = Object.freeze([
  Object.freeze({ id: 'sku', name: 'SKU', example: '多规格 SKU', similar: 'link' }),
  Object.freeze({ id: 'link', name: '联动', example: '门店选择', similar: 'upload' }),
  Object.freeze({ id: 'upload', name: '上传', example: '图片上传', similar: 'sku' }),
  Object.freeze({ id: 'date', name: '日期', example: '日期区间', similar: 'check' }),
  Object.freeze({ id: 'check', name: '校验', example: '品牌授权', similar: 'date' }),
]);

export const FIELD_IDS = Object.freeze(FIELDS.map(field => field.id));

export const SIMILAR = Object.freeze(Object.fromEntries(FIELDS.map(field => [field.id, field.similar])));

// 第 4 周周一固定的五张大单，和规则里的例子一一对应。
export const BOSS_TICKETS = Object.freeze([
  Object.freeze({ line: 'taobao', field: 'sku', difficulty: 4 }),
  Object.freeze({ line: 'fliggy', field: 'date', difficulty: 4 }),
  Object.freeze({ line: 'xianyu', field: 'upload', difficulty: 4 }),
  Object.freeze({ line: 'hema', field: 'link', difficulty: 4 }),
  Object.freeze({ line: 'tmall', field: 'check', difficulty: 4 }),
]);

export const CONFIG = Object.freeze({
  weeks: HEFEI.weeks,
  daysPerWeek: HEFEI.daysPerWeek,
  dailyAp: HEFEI.dailyAp,
  exhaustedAp: HEFEI.exhaustedAp,
  staminaMax: HEFEI.staminaMax,
  staminaStart: HEFEI.staminaStart,
  overnightAp: HEFEI.overnightAp,
  overnightStaminaCost: HEFEI.overnightStaminaCost,
  overnightName: HEFEI.overnightName,
  dotaWinStamina: HEFEI.dotaWinStamina,
  restStamina: HEFEI.restStamina,
  // 周线、延期扣分和第二张单的概率不在规则正文里，按 h0–h239 三种打法调过。
  deliveryStart: 18,
  deliveryMin: 0,
  deliveryMax: 100,
  weekLineBase: 20,
  weekLineStep: 2,
  spawnTwoChance: 0.25,
  deadlineMin: 2,
  deadlineMax: 4,
  difficultyTable: Object.freeze([2, 2, 3, 3, 4]),
  onTimeReward: 9,
  latePenalty: 9,
  debtPerHard: 8,
  debtMax: 100,
  debtStep: 25,
  moduleAp: 1,
  extractCost: 3,
  extractDiscount: 2,
  complaintLimit: 2,
  babelClear: 10,
  bossWeek: 4,
  bossDay: 1,
  skills: Object.freeze({
    biz: Object.freeze({
      id: 'biz',
      name: '读懂商品发布这摊业务',
      cost: 2,
      minWeek: 1,
      nightOnly: false,
      effect: '需求单显示下一周会来的字段类型',
    }),
    patterns: Object.freeze({
      id: 'patterns',
      name: '精读 23 种设计模式',
      cost: 3,
      minWeek: 1,
      nightOnly: false,
      effect: '抽模块从 3 点变 2 点',
    }),
    webpack: Object.freeze({
      id: 'webpack',
      name: '吃透 Webpack 插件机制',
      cost: 3,
      minWeek: 1,
      nightOnly: false,
      effect: '一个模块可以覆盖两种相近的字段类型',
    }),
    babel: Object.freeze({
      id: 'babel',
      name: '吃透 Babel 插件机制',
      cost: 2,
      minWeek: 1,
      nightOnly: false,
      effect: '每周一自动清掉 10 点技术债',
    }),
    architecture: Object.freeze({
      id: 'architecture',
      name: '一套表单架构，撑起五条业务线',
      cost: 0,
      minWeek: 4,
      nightOnly: false,
      granted: true,
      effect: '只能在 Boss 关通关后获得',
    }),
  }),
});

export const SKILL_IDS = Object.freeze(['biz', 'patterns', 'webpack', 'babel', 'architecture']);
export const STUDY_IDS = Object.freeze(['biz', 'patterns', 'webpack', 'babel']);

export const DAY_NAMES = Object.freeze(['', '周一', '周二', '周三', '周四', '周五']);

export const ENDINGS = Object.freeze({
  architecture: Object.freeze({
    title: '一套架构，撑起五条业务线',
    text: '五张大单都按期交付。淘宝、天猫、闲鱼、飞猪、盒马接在同一套表单模块上。',
  }),
  debt: Object.freeze({
    title: '需求做完了，债也欠下了',
    text: '四周撑过来了。有的单子延期了，技术债还在。',
  }),
});

export function fieldById(id) {
  return FIELDS.find(field => field.id === id);
}

export function lineById(id) {
  return LINES.find(line => line.id === id);
}
