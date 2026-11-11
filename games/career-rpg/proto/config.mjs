// 文档写明的初始值。没写死的奖惩也放在这里，方便试玩后只改这一处。
export const CONFIG = Object.freeze({
  weeks: 4,
  daysPerWeek: 5,
  dailyAp: 3,
  exhaustedAp: 1,
  staminaMax: 10,
  staminaStart: 10,
  overnightAp: 1,
  overnightStaminaCost: 3,
  overnightName: '打 Dota',
  restStamina: 2,
  favorStart: 40,
  favorMin: 0,
  favorMax: 100,
  weekLineBase: 30,
  weekLineStep: 10,
  spawnMin: 1,
  spawnMax: 2,
  deadlineMin: 2,
  deadlineMax: 4,
  difficultyMin: 1,
  difficultyMax: 3,
  difficultyTable: Object.freeze([1, 2, 2, 3, 3]),
  favorPerDifficulty: 3,
  favorLate: 4,
  eventDeadline: 1,
  eventDifficulty: 3,
  eventFavorComplete: 8,
  eventFavorFail: 18,
  eventFavorFailWithGit: 8,
  eventChance: 0.22,
  fullstackChance: 0.28,
  linuxServerCost: 1,
  jqueryPageDiscount: 1,
  fullstackDifficulty: 3,
  fullstackFavorMultiplier: 2,
  skills: Object.freeze({
    linux: Object.freeze({ id: 'linux', name: 'Linux', cost: 2, minWeek: 1, nightOnly: false, effect: '服务器类事件单只要 1 点' }),
    git: Object.freeze({ id: 'git', name: 'Git', cost: 3, minWeek: 1, nightOnly: false, effect: '事件单逾期不再一次性扣满' }),
    jquery: Object.freeze({ id: 'jquery', name: 'jQuery', book: '锋利的 jQuery', cost: 3, minWeek: 2, nightOnly: false, effect: '页面类需求单少用 1 点' }),
    java: Object.freeze({ id: 'java', name: 'Java + 数据库', cost: 4, minWeek: 1, nightOnly: true, effect: '解锁全栈单，好感翻倍，难度 3' }),
  }),
});

export const SKILL_IDS = Object.freeze(['linux', 'git', 'jquery', 'java']);

export const PAGE_TITLES = Object.freeze([
  '首页改一版',
  '活动页倒计时',
  '后台列表翻页',
  '登录框校验',
  'banner 换季',
  '表单加字段',
  '下拉框错位',
  '详情页分享',
]);

export const FULLSTACK_TITLES = Object.freeze([
  '报名接口入库',
  '订单表对上页面',
  '后台检索加索引',
]);

export const DAY_NAMES = Object.freeze(['', '周一', '周二', '周三', '周四', '周五']);

export const VICTORY_TEXT = '日夜颠倒地学新东西，拼命把活干好，争取能留下来。';
