// 行动点、体力、熬夜和合肥同一套，数字从合肥配置读，不在这里另写一份。
import { CONFIG as HEFEI, DAY_NAMES } from '../config.mjs';

export { DAY_NAMES };

export const TICKETS = Object.freeze([
  Object.freeze({ kind: 'front', title: '发帖' }),
  Object.freeze({ kind: 'front', title: '回帖' }),
  Object.freeze({ kind: 'front', title: '楼层分页' }),
  Object.freeze({ kind: 'front', title: '帖子搜索' }),
  Object.freeze({ kind: 'front', title: '签到' }),
  Object.freeze({ kind: 'front', title: '个人主页' }),
  Object.freeze({ kind: 'back', title: '版主后台' }),
  Object.freeze({ kind: 'back', title: '防灌水' }),
  Object.freeze({ kind: 'back', title: '敏感词过滤' }),
  Object.freeze({ kind: 'back', title: '消息通知' }),
  Object.freeze({ kind: 'data', title: '热帖排行' }),
  Object.freeze({ kind: 'data', title: '备份数据库' }),
]);

export const INCIDENTS = Object.freeze([
  Object.freeze({ id: 'reply500', title: '回帖 500', omen: '回帖好慢' }),
  Object.freeze({ id: 'garbled', title: '帖子乱码', omen: '帖子出现乱码' }),
  Object.freeze({ id: 'spam', title: '灌水机器人刷屏', omen: '版里全是灌水' }),
]);

// stage 是这一步在第几段才算走对。-1 永远是弯路。skip 是看对老用户的帖子时少走的步数。
export const BOSS_OPTIONS = Object.freeze([
  Object.freeze({ id: 'monitor', label: '看监控', stage: -1 }),
  Object.freeze({ id: 'posts', label: '看老用户的帖子', stage: 0, skip: 1 }),
  Object.freeze({ id: 'logs', label: '查日志', stage: 1 }),
  Object.freeze({ id: 'recent', label: '看最近上线', stage: -1 }),
  Object.freeze({ id: 'db', label: '查数据库连接', stage: -1 }),
  Object.freeze({ id: 'config', label: '改配置', stage: 2 }),
  Object.freeze({ id: 'rollback', label: '回滚', stage: -1, stopBleed: true }),
]);

export const SKILL_IDS = Object.freeze(['fibjs', 'ci', 'release', 'react']);

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
  // 下面是规则文档写死的数。
  reputationStart: 50,
  reputationMin: 0,
  reputationMax: 100,
  reputationLine: 30,
  reputationDropBelow: 20,
  baseChance: 30,
  testedChance: 15,
  pmChanceAdd: 15,
  bossRepPerAp: 5,
  talksToFail: 2,
  // 下面是文档没写死、用来对齐三种打法的数。
  dauBase: 8,
  dauStep: 4,
  dauTargets: Object.freeze([30, 64, 110, 160]),
  dauDropRate: 0.2,
  incidentRep: 3,
  incidentDaily: 3,
  lateRep: 4,
  goodReputation: 34,
  bossNightRep: 6,
  pmExtraRatio: 0.5,
  spawnMin: 1,
  spawnMax: 1,
  deadlineMin: 4,
  deadlineMax: 6,
  difficultyTable: Object.freeze([1, 1, 2, 2, 3]),
  skillDiscount: 1,
  chanceCap: 90,
  tickets: TICKETS,
  incidents: INCIDENTS,
  bossOptions: BOSS_OPTIONS,
  skills: Object.freeze({
    fibjs: Object.freeze({ id: 'fibjs', name: 'fibjs / Node.js', cost: 2, minWeek: 1, effect: '前后台单子少 1 点' }),
    ci: Object.freeze({ id: 'ci', name: '集成测试', cost: 2, minWeek: 1, effect: '补过测试的单子，上线事故概率再减半' }),
    release: Object.freeze({ id: 'release', name: '敬畏上线', cost: 3, minWeek: 1, effect: '解锁灰度、回滚、观测。Boss 错误选项少一半' }),
    react: Object.freeze({ id: 'react', name: 'React / Webpack', cost: 3, minWeek: 4, effect: '结局多一句，去阿里' }),
  }),
});

export const ENDINGS = Object.freeze({
  learned: Object.freeze({ title: '扛住了，也学会了怎么扛', text: '首页恢复了，复盘也写了。' }),
  alive: Object.freeze({ title: '论坛还活着，你也还在', text: '四周撑过来了。' }),
});

export const PEOPLE = Object.freeze([
  Object.freeze({ id: 'pm', name: '催上线的创始人' }),
  Object.freeze({ id: 'mod', name: '版主' }),
  Object.freeze({ id: 'boss', name: '管事的创始人' }),
]);

export const PM_TAILS = Object.freeze([
  '运营在群里催了。',
  '别压到周五。',
  '用户等着发。',
  '先上车再补。',
  '今天的量靠它。',
  '市场问我要时间。',
  '首页空着不像话。',
  '你做完我就发公告。',
  '再拖，日活不动。',
  '小步上，别憋大招。',
  '版主也在问。',
  '活动位空着。',
  '我已经答应运营了。',
  '晚一天少一天量。',
  '这张不大，先上。',
  '出问题我帮你挡一下。',
  '别再拖了。',
  '用户路径就差这一下。',
  '今天能看的就这张。',
  '上了才有数。',
]);

export const MOD_TAILS = Object.freeze([
  '帖子还在涨。',
  '有人在问版主。',
  '首页刷新比平时慢。',
  '新用户卡在登录页。',
  '回帖列表要翻很久。',
  '搜索点进去是空的。',
  '签到按钮转了一下。',
  '个人主页有人说打不开。',
  '灌水帖清不完。',
  '敏感词漏了一条。',
  '通知红点不消。',
  '热帖排序一跳一跳。',
  '备份的事他们也在问。',
  '楼层对不上。',
  '有人说刚发的帖不见了。',
  '版里在传首页不稳。',
  '老帖还能开，新帖慢。',
  '手机上更卡。',
  '我先把帖子顶上了。',
  '你要是查，从登录看起。',
]);

export const BOSS_TAILS = Object.freeze([
  '论坛稳着就行。',
  '别让首页挂了。',
  '日活这周看着办。',
  '口碑掉了我会问。',
  '你自己盯着线上。',
  '出了事故先说人话。',
  '我不管你怎么修。',
  '周五我对表。',
  '用户骂的我看得到。',
  '别等到我来问。',
  '功能做完要上线。',
  '上线之前想清楚。',
  '这周的线在那儿。',
  '我只看日活和口碑。',
  '团队就你们几个。',
  '首页是门面。',
  '慢一点可以，挂了不行。',
  '复盘要留。',
  '下个版本别再这样。',
  '你心里要有数。',
]);

export const KIND_LABEL = Object.freeze({
  front: '前台',
  back: '后台',
  data: '数据',
});
