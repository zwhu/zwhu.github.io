// 文档里的数是初始值，试玩后可以只改这里。
// 好感上限 100→200。文件数据库奖励 30→50（中间曾到 100）。第 4 周过线 60→130。
// 被记住要文件数据库做完，并且好感到 200。第 1–3 周线仍是 30、40、50。吃面回 3。
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
  dotaWinStamina: 2,
  restStamina: 2,
  noodleStamina: 3,
  favorStart: 40,
  favorMin: 0,
  favorMax: 200,
  weekLineBase: 30,
  weekLineStep: 10,
  weekLineFinal: 130,
  goodFavor: 200,
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
  pageChance: 0.3,
  linuxServerCost: 1,
  skillDiscount: 1,
  fileDbCost: 8,
  fileDbReward: 50,
  fileDbJavaBonus: 1,
  fileDbWeek: 2,
  fileDbTitle: '写一个文件数据库',
  skills: Object.freeze({
    linux: Object.freeze({ id: 'linux', name: 'Linux', cost: 2, minWeek: 1, nightOnly: false, easterEgg: false, effect: '服务器类单子和事件单只要 1 点' }),
    git: Object.freeze({ id: 'git', name: 'Git', cost: 3, minWeek: 1, nightOnly: false, easterEgg: false, effect: '事件单逾期不再一次性扣满' }),
    database: Object.freeze({ id: 'database', name: '数据库', cost: 3, minWeek: 1, nightOnly: false, easterEgg: false, effect: '导数据、改表结构少 1 点，解锁文件数据库' }),
    java: Object.freeze({ id: 'java', name: 'Java', cost: 4, minWeek: 1, nightOnly: true, easterEgg: false, effect: '接口单少 1 点，文件数据库每次多算 1 点' }),
    jquery: Object.freeze({ id: 'jquery', name: 'jQuery', book: '锋利的 jQuery', cost: 3, minWeek: 2, nightOnly: false, easterEgg: true, effect: '页面单少用 1 点' }),
  }),
});

export const SKILL_IDS = Object.freeze(['linux', 'git', 'database', 'java']);

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

export const BACKEND_TICKETS = Object.freeze([
  Object.freeze({ kind: 'api', title: '写接口' }),
  Object.freeze({ kind: 'data', title: '导数据' }),
  Object.freeze({ kind: 'schema', title: '改表结构' }),
  Object.freeze({ kind: 'log', title: '排查服务器日志' }),
  Object.freeze({ kind: 'cron', title: '写定时任务' }),
]);

export const EVENT_TICKETS = Object.freeze([
  Object.freeze({ kind: 'disk', title: '服务器磁盘满了' }),
  Object.freeze({ kind: 'rollback', title: '数据导错了要回滚' }),
  Object.freeze({ kind: 'demo', title: '老板临时要演示' }),
]);

export const DAY_NAMES = Object.freeze(['', '周一', '周二', '周三', '周四', '周五']);

export const ENDINGS = Object.freeze({
  remembered: Object.freeze({ title: '留下来，还被老板记住了', text: '文件数据库交上去了。' }),
  barely: Object.freeze({ title: '勉强留下来', text: '人留下了。文件数据库还没写完。' }),
});
