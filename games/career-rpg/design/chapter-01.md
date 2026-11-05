# 南京：第一次上线

对象：`nanjing-first-release`，“一路写来”的首个可玩样章。人生时间线仍从合肥开始，本章只做南京。数据版见 [chapter-01.json](./chapter-01.json)，美术规格见 [chapter-01-art.md](./chapter-01-art.md)。状态：设计草案，尚未实现；2～3 分钟是按状态预算推算的**预期**，不是实测。概念板 `art/nanjing-art-direction-v1.png` 未获作者认可，也不是生产素材。

## 一、目标与节奏

玩家扮演当年的作者：论坛有人反馈无法登录；我第一次面对真实的线上 C 端用户，呆住；CTO 带大家排查；整整两小时后恢复；CTO、老板、同事安慰我；再补测试和注释，写进游戏里的工作手册。

顺序固定为：论坛反馈 → 呆住 → CTO 排查 → 约两小时恢复 → 安抚 → 补测试与注释 → 手册 → 从合肥走到南京的旅程地图。主题是第一次做 C 端，以及从这次失败里记下的东西。没有考试或分数，也没有要猜的技术谜题：排查段只让玩家去不同物件重读已有内容并确认。

| 状态 | 标题 | 预算 | 检查点 | 入口格 | 离开条件 |
| --- | --- | --- | --- | --- | --- |
| office | 办公室 | 25s | true（`atomic-per-event`） | [3,14] | `open_forum_post`→report |
| report | 读到反馈 | 15s | true（`atomic-per-event`） | [9,4] | `read_feedback`→incident |
| incident | 呆住 | 25s | true（`atomic-per-event`） | [9,4] | `cto_rallies_team`→investigation |
| investigation | 一起排查 | 45s | true（`atomic-per-event`） | [15,4] | `confirm_feedback_reviewed`→investigation；`confirm_recheck_visited`→investigation；`confirm_impact_scope`→investigation；`resume_narrative`→restored |
| restored | 两小时后 | 25s | true（`atomic-per-event`） | [15,4] | `comfort_read`→learning |
| learning | 补测试与注释 | 35s | true（`atomic-per-event`） | [15,4] | `review_test_plan`→learning；`review_trap_comment`→learning；`write_manual_entry`→journey |
| journey | 从合肥走到南京 | 计入本章 | true（`atomic-per-event`） | [21,4] | `open_journey`→journey；`notice_react`→journey；`finish_journey`→complete |
| complete | 本章完成 | 10s | true（`atomic-per-event`） | [21,4] | — |

合计仍按 180 秒计，旅程地图不另加预算。各状态入口都是稳定检查点，读档只恢复最近一次被接受事件写下的同一个快照（第七节）。

## 技能、旅程与标题

五个技能只做收集和展示，不加数值。名字只写在 `chapter-01.json` 的 `skills`。完成对应事件后，物件外围出现像素闪光，再按 E 拾取。拾取锁住操作，弹出「获得技能：{名字}」，同时有像素闪光和一段现场合成的 WebAudio 叮声；点 OK 才继续。手册（M）里还没拿到的显示「???」。存档带上 `skills`。「从办公室重玩」回到全部未获得。进入 `complete` 时，还没拾取的技能改为已获得。合肥章节数据没有 `skills`，这套机制不把合肥的四个技能写进 main。

| 节点 | 技能名 | 事件 |
| --- | --- | --- |
| 工位日常（打开自己的电脑） | fibjs／nodejs 做全栈 | `open_forum_post` |
| 补测试 / CI | CI/CD 做集成测试 | `review_test_plan` |
| 事故与恢复 | 对上线要有敬畏之心（灰度、观测、回滚） | `comfort_read` |
| 手册收束 | 学会从失败中学习经验 | `write_manual_entry` |
| 章末过场，钩子指向 Alibaba／杭州 | React／Webpack | `notice_react` |

旅程地图用运行图 `web/art/transition-map/`：底图 `map-384x216.png`，人物 `player-marker-24.png`（12×24，脚底锚点 6,23），状态层为勾、高亮环和锁。坐标在同目录 `transition-map.json`。人物沿路线从合肥走到南京，3200ms，ease-in-out，停在南京，不走进杭州的雾。合肥打勾，南京套高亮环，杭州只有雾、问号和锁，不加品牌。底图里的地名另叠一层像素字。合肥完成页可以再看同一段到南京为止的路程，不改合肥存档，也不发放南京技能。

口号 `欢迎你游戏我的职业前半生` 只写在 `web/slogan.mjs`。游戏标题、开场、转场（含这张旅程地图）都读这个常量。

| ID | 玩家能看到什么 | 怎么算做完 |
| --- | --- | --- |
| NJ-SKILL-01 | 拾取「fibjs／nodejs 做全栈」，手册出现这个名字；没拾取时章末也会补上 | 实机截图：闪光、获得弹窗、手册；名字与上表一致 |
| NJ-SKILL-02 | 拾取「CI/CD 做集成测试」，手册与章末补发同样核对 | 同上 |
| NJ-SKILL-03 | 拾取「对上线要有敬畏之心（灰度、观测、回滚）」 | 同上 |
| NJ-SKILL-04 | 拾取「学会从失败中学习经验」 | 同上 |
| NJ-SKILL-05 | 在旅程地图上拾取「React／Webpack」 | 同上 |
| NJ-STORY-01 | 论坛反馈、呆住、CTO 排查、约两小时恢复、安抚、补测试与注释、手册能走完 | 实机走完；文案不把「有人扛」写成这一章的教训 |
| NJ-BRIDGE-01 | 旅程地图从合肥走到南京 | 起点、中途、到达南京各一张实机截图 |
| SLOGAN-01 | 标题、开场、转场都是同一句口号 | 三处各一张实机截图；测试断言文案与 `slogan.mjs` 一致 |

## 二、事实、演出与缺失

| 内容 | 依据 |
| --- | --- |
| 用户在论坛反馈无法登录；作者第一反应呆住；登录框故障整整两小时；CTO 带大家排查；事后 CTO、老板、同事安慰；补测试、注释说明为什么有坑 | 作者提供的事实，`fact_paraphrase` 转述，非逐字记录 |
| “没关系，大家都经历过” | 作者提供的安慰大意；旁白 `fact_paraphrase`，CTO 与同事台词是 `staging` 演出草稿 |
| 办公室布局、站位、论坛面板、笔记本、排查记录页、工作手册、按钮 | `staging`，游戏演出，不是确认历史 |

不写的边界见 JSON 的 `blockedHistoricalDetails`：事故根因、具体报错、代码和完整修复过程；排查中每个人具体做了什么、具体技术分工；换浏览器、改密码、群消息是否持续、先吃饭、哪条路径漏测是根因等历史细节；老板原话、同事姓名外貌与逐字安慰措辞（旁白按作者回忆转述，CTO、同事台词是演出草稿）；事故与随后深夜学习是否存在直接因果；准确年份与日期；工作手册是否在真实工作中存在（本章手册为游戏机制）；作者是否认可美术方向（概念板未获认可，也不是生产素材）。登录示意不演“按钮点了没反应”，排查记录不含根因；对白里没有真实报错、日志、用户名或日期，也没有制作注释，那些说明只写在 JSON 的 `note` 字段与本文。

## 三、地图与坐标

24×16 格，地砖 16×16 px，原点左上 (0,0)，出生点 [3,14]。地图矩形内没有墙格：墙与窗是背景层，上墙画在矩形上方的画布像素行 -16～-1，窗在画布 x=80～143，左墙画在 x<0，不铺进地图、不写进 `blockedTiles`；地图边界本身阻挡移动。

```text
 0 ........................
 1 ........................
 2 ................T.......
 3 .........A.D.C.B...EeF..
 4 ........,+,+.+,+,..+.+..
 5 ........................
 6 ........................
 7 ........................
 8 ........................
 9 ........................
10 ........................
11 ........................
12 ...G..H.................
13 ...+..+.................
14 ...@....................
15 ........................
```

A 我的工位电脑 [9,3] · B CTO 工位电脑 [15,3] · C 补测便签 [13,3] · D 坑点注释 [11,3] · E/e 书架 [19,3][20,3] · F 手册书架 [21,3] · G 窗边绿植 [3,12] · H 保温杯 [6,12] · + 交互点 · @ 出生点 · T CTO 站位 [16,2] · `.` 地板 · `,` 地毯。这 24×16 格里没有墙：墙与窗画在地图矩形上方的画布像素行 -16～-1，左墙画在画布 x<0，不铺进任何可走格，也不参与碰撞。

| 对象 ID | 资产 ID | 用途 | 本体格 | 交互点 | 交互朝向 | footprint | 必选 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| forum_pc | `obj-forum-pc` | 我的工位电脑 | [9,3] | [9,4] | 朝上 | [9,3] | 是 |
| trap_note | `obj-trap-note` | 坑点注释 | [11,3] | [11,4] | 朝上 | [11,3] | 是 |
| test_notes | `obj-test-notes` | 补测便签 | [13,3] | [13,4] | 朝上 | [13,3] | 是 |
| cto_pc | `obj-cto-pc` | CTO 工位电脑 | [15,3] | [15,4] | 朝上 | [15,3] | 是 |
| manual_shelf | `obj-manual-shelf` | 手册书架 | [21,3] | [21,4] | 朝上 | [21,3] | 是 |
| bookshelf | `obj-bookshelf` | 书架 | [19,3] | [19,4] | 朝上 | [19,3] [20,3] | 否（可选） |
| window_plant | `obj-plant` | 窗边绿植 | [3,12] | [3,13] | 朝上 | [3,12] | 否（可选） |
| coffee_mug | `obj-mug` | 保温杯 | [6,12] | [6,13] | 朝上 | [6,12] | 否（可选） |

`blockedTiles` 共 9 格，全部来自上面的 footprint，每格只属于一个对象，没有额外装饰障碍；每个交互点离本体 1 格、不在 footprint 内，从出生点都能走到。CTO 整章站在 [16,2]，不占碰撞格，也不在任何交互点上。

像素落点只用一个公式：格 (x,y) 上的落点 = 格左上 + (8,15) = 世界逻辑像素 (16*x+8, 16*y+15)；精灵内脚底索引 [8,23]。家具：家具按 footprint 最下方一格的格索引 (x,y) 套同一个公式，落点 (16*x+8, 16*y+15)；贴图内锚点 (宽÷2−1, 高−1)，贴图与锚点以落点为对齐点。

### 交互规则

- 对象有三个位置：本体格 tile、交互点 interactionTile、视觉包围（贴图像素）。触发要求：玩家所在格正是 interactionTile，朝向为表中“交互朝向”（JSON `interactionDirs`），再按 E／空格或点提示／A 按钮。朝向不对时第一次按键只转身。
- 例如 forum_pc：本体 [9,3] 在交互点 [9,4] 正上方，站 [9,4] 朝上就是标准站位；站 [9,2] 朝下、或站 [20,4] 看两格宽书架，都不触发。
- 同一行有多个交互点时只高亮离玩家最近的一个，触发仍按上面的规则；触屏不自动寻路、不隔空触发。

## 四、按状态的分镜、操作与结束条件

### office：办公室（约 25 秒，checkpoint = true）

- 目标：从门口走到自己的工位，打开论坛，看清用户说无法登录的反馈。
- 玩家操作：走到 forum_pc 的交互点 [9,4]，朝上，按 E／空格（手机点 A 按钮或点提示），读帖后点“确认，去处理”。路上可以顺手看书架、绿植和保温杯。
- 结束条件：在 forum_pc 点“确认，去处理”（T01，写 report_read），进入 report。
- 场景反馈：论坛面板出现，高亮“无法登录”；确认后屏幕上是这句话，进入 report。
- 重复与陷阱：进入 office 只有 chapter_start 一个快照，flags 为空；同一次浏览里反复关闭再打开论坛只重播 office-reopen，不写标记。
- 存档与恢复：chapter_start 写 {office, []}，入口 [3,14]。office 只有这一个合法快照；带任何标记的 office 快照都按 invalid 处理。恢复后重播 `office-n1`；每句要玩家确认，不自动推进。
- 进入所需标记：无

### report：读到反馈（约 15 秒，checkpoint = true）

- 目标：停在屏幕前，意识到这是我第一次面对真实的线上 C 端用户。
- 玩家操作：进入时玩家仍在 [9,4]，移动锁定，旁白与内心独白依次出现；读完点“继续”。
- 结束条件：点“继续”（T02，写 incident_started），进入 incident。
- 场景反馈：任务提示改为“先稳住”；这一句不自动进入下一状态。
- 重复与陷阱：同一点击只推进一步，不会连带事件；反应会在恢复时重播，但 read_feedback 只在点“继续”时被接受一次，之后不再出现确认项。
- 存档与恢复：T01 `open_forum_post` 写 {state:report, flags:[report_read]}（effects 含 `report_read`），入口 [9,4]。恢复后重播 `report-reaction`；每句要玩家确认，不自动推进。
- 进入所需标记：`report_read`

### incident：呆住（约 25 秒，checkpoint = true）

- 目标：先让“呆住”发生，再由 CTO 带大家排查。
- 玩家操作：进入时玩家在 [9,4]，约 1.5 秒移动锁定、镜头停在登录示意上，我保持站立（跳过键立即显示 incident-freeze）。随后 CTO 开口；走到 cto_pc 交互点 [15,4]，朝上，交互读对话并点“一起过去”。
- 结束条件：cto_pc 对话读完并点“一起过去”（T03，写 incident_seen），进入 investigation。
- 场景反馈：登录示意只表现页面交不出结果，不显示真实报错、日志或“按钮没反应”；CTO 朝向左下，之后可自由走动。
- 重复与陷阱：呆住与 CTO 招呼是进入后的重播演出，可跳过，不写标记；走到 cto_pc 读到的对话以“一起过去”结尾，cto_rallies_team 只接受一次。
- 存档与恢复：T02 `read_feedback` 写 {state:incident, flags:[report_read, incident_started]}（effects 含 `incident_started`），入口 [9,4]。恢复后重播 `incident-freeze`/`incident-cto-1`/`incident-rally`；每句要玩家确认，不自动推进。
- 进入所需标记：`report_read`、`incident_started`

### investigation：一起排查（约 45 秒，checkpoint = true）

- 目标：在 CTO 带大家排查时，做三件我能确认的事：重读论坛反馈、读 CTO 电脑上的排查记录、确认这次影响到谁。不猜根因。
- 玩家操作：a. forum_pc [9,4]：重读反馈，点“记下来”（T04，feedback_reviewed）；b. cto_pc [15,4]：读屏幕上的排查记录，点“记下来”（T06，recheck_visited）；c. cto_pc [15,4]：关上记录后读笔记本“这次影响到谁”，点“记下来”（T05，impact_confirmed）。论坛反馈和排查记录可先后任意；影响范围要在排查记录之后。三步都可来回。
- 结束条件：三项标记齐全后，在 cto_pc 点“这轮排查先到这里”（T07，写 outage_over），进入 restored。
- 场景反馈：任务条“排查 0/3→3/3”；三项齐全后 cto_pc 才出现“这轮排查先到这里”。点击只表示“我去看了并记下来”，不代表修好了线上问题。
- 重复与陷阱：T05 要求 recheck_visited 先于它，否则显示 investigation-cto-pc-first；已确认项再交互只显示该项只读页（*-copy），不显示“记下来”，不加标记、不写快照。cto_pc 的当前确认项跳过已完成的 T06，所以 T06 记完后立刻出现 T05，三项齐全后出现 T07；只读页不挡后面的未完成确认。
- 存档与恢复：T03 `cto_rallies_team` 写 {state:investigation, flags:[report_read, incident_started, incident_seen]}（effects 含 `incident_seen`），入口 [15,4]。进入后 `confirm_feedback_reviewed`（feedback_reviewed）／`confirm_recheck_visited`（recheck_visited）／`confirm_impact_scope`（impact_confirmed） 每被接受一次再写一次 {state:investigation, flags:当前并集}；恢复后重播 `investigation-n1`/`investigation-cto-prompt`。
- 进入所需标记：`report_read`、`incident_started`、`incident_seen`

### restored：两小时后（约 25 秒，checkpoint = true）

- 目标：接受“整整两小时后、问题恢复”的转场，读 CTO、老板、同事的宽慰。
- 玩家操作：转场中不移动，点“继续”或跳过键逐句出示旁白与宽慰；最后在对话框上点“收起”。
- 结束条件：点“收起”（T08，写 comfort_read），进入 learning。
- 场景反馈：画面以离散蓝灰两档压暗，显示“整整两小时后”；恢复用叙事交代，不把任何点击当成修复了线上问题。
- 重复与陷阱：回到 restored 会从头重播宽慰；每句单独确认，点“收起”只触发 comfort_read 一件事。
- 存档与恢复：T07 `resume_narrative` 写 {state:restored, flags:[report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over]}（effects 含 `outage_over`），入口 [15,4]。恢复后重播 `restored-n1`/`restored-cto-1`/`restored-colleague-1`/`restored-n3`/`restored-player-1`/`restored-closing`；每句要玩家确认，不自动推进。
- 进入所需标记：`report_read`、`incident_started`、`incident_seen`、`feedback_reviewed`、`recheck_visited`、`impact_confirmed`、`outage_over`

### learning：补测试与注释（约 35 秒，checkpoint = true）

- 目标：亲眼看补测试和坑点注释，再把经验写进工作手册。
- 玩家操作：test_notes [13,4] 交互并点“确认看过测试”（T09）；trap_note [11,4] 交互并点“确认看过注释”（T10）；顺序任意、可来回。两项齐全后到 manual_shelf [21,4] 交互并点“把这页写进手册”（T11）。
- 结束条件：test_reviewed 与 comment_reviewed 都写入后，在 manual_shelf 点“把这页写进手册”（T11，requires 同时包含两者），进入 complete。
- 场景反馈：任务条“看过 0/2→2/2”；手册打开新页（learning-manual-1），状态进入 complete。
- 重复与陷阱：T09／T10 只在首次确认时写标记；再交互只显示该项只读页（learning-test-copy／learning-comment-copy），不加标记、不写快照，也不挡住另一项的确认。
- 存档与恢复：T08 `comfort_read` 写 {state:learning, flags:[report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over, comfort_read]}（effects 含 `comfort_read`），入口 [15,4]。进入后 `review_test_plan`（test_reviewed）／`review_trap_comment`（comment_reviewed） 每被接受一次再写一次 {state:learning, flags:当前并集}；恢复后重播 `learning-n1`/`learning-cto-1`。
- 进入所需标记：`report_read`、`incident_started`、`incident_seen`、`feedback_reviewed`、`recheck_visited`、`impact_confirmed`、`outage_over`、`comfort_read`

### complete：手册新增一页（约 10 秒，checkpoint = true）

- 目标：翻看本章手册页，结束或重玩。
- 玩家操作：读手册页，选“结束本章”（收起手册，显示完成摘要）或“从办公室重玩”（再确认一次）。探视手册以外的物件不再触发事件，complete 的合法快照只有这一个。
- 结束条件：终态。重玩是另一个入口，不经过状态转移，也不写任何事件。
- 场景反馈：显示“第一章完成”、本章事实与演出说明、回博客链接与重玩入口。
- 重复与陷阱：刷新或重进都读回 complete 的同一个快照，停在完成页，不再接受任何事件；重玩只清除本游戏命名空间下的本章存档。
- 存档与恢复：T11 `write_manual_entry` 写 {state:complete, flags:[report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over, comfort_read, test_reviewed, comment_reviewed, manual_entry_written]}（effects 含 `manual_entry_written`），入口 [21,4]。恢复后重播 `complete-n1`，停在完成页。
- 进入所需标记：`report_read`、`incident_started`、`incident_seen`、`feedback_reviewed`、`recheck_visited`、`impact_confirmed`、`outage_over`、`comfort_read`、`test_reviewed`、`comment_reviewed`、`manual_entry_written`

任何被接受的确认项都按第七节写完整快照，所以“刷新回到哪里”只取决于最近这次确认。

### 事件表

`options` 最多一个确认项和一个只读页。确认项显示／接受条件 = requires 全部满足，且本次 effects 至少有一个尚未在标记里；effects 已全在标记里时只显示该项只读页。接受确认项 = state 变为 `to`、effects 并入标记、写一次完整快照。只读页不改状态、不加标记，也不写任何快照。

| ID | 事件 | from → to | 目标 | 确认 label／requires → effects | 只读页 |
| --- | --- | --- | --- | --- | --- |
| T01 | `open_forum_post` | office → report | forum_pc | 确认，去处理／— → report_read | `office-reopen` |
| T02 | `read_feedback` | report → incident | dialog | 继续／report_read → incident_started | 对话本身（T02、T08） |
| T03 | `cto_rallies_team` | incident → investigation | cto_pc | 一起过去／report_read, incident_started → incident_seen | `incident-rally` |
| T04 | `confirm_feedback_reviewed` | investigation → investigation | forum_pc | 记下来／report_read, incident_started, incident_seen → feedback_reviewed | `investigation-feedback-copy` |
| T06 | `confirm_recheck_visited` | investigation → investigation | cto_pc | 记下来／report_read, incident_started, incident_seen → recheck_visited | `investigation-recheck-copy` |
| T05 | `confirm_impact_scope` | investigation → investigation | cto_pc | 记下来／report_read, incident_started, incident_seen, recheck_visited → impact_confirmed | `investigation-cto-pc-first` |
| T07 | `resume_narrative` | investigation → restored | cto_pc | 这轮排查先到这里／report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed → outage_over | `investigation-pending` |
| T08 | `comfort_read` | restored → learning | dialog | 收起／report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over → comfort_read | 对话本身（T02、T08） |
| T09 | `review_test_plan` | learning → learning | test_notes | 确认看过测试／report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over → test_reviewed | `learning-test-copy` |
| T10 | `review_trap_comment` | learning → learning | trap_note | 确认看过注释／report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over → comment_reviewed | `learning-comment-copy` |
| T11 | `write_manual_entry` | learning → complete | manual_shelf | 把这页写进手册／report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over, test_reviewed, comment_reviewed → manual_entry_written | `learning-pending` |

走通原因：T01→T02→T03 保证呆住先于 CTO 介入；T04（forum_pc）、T06（cto_pc 排查记录）、T05（cto_pc 影响范围，要求 T06 先写 recheck_visited）各写一个标记，T07 要三项齐全才进 restored，进入 investigation 不会自动恢复；T09、T10 各写一个标记，T11 同时要求两者，并在进入 complete 时继承 T08 写下的 comfort_read；T08 只在点“收起”时触发。

## 五、关键对白

完整对白与 `note` 以 JSON 的 `dialogues` 为准，这里只列关键句。`fact_paraphrase` 是事实转述，`staging` 是演出，都不是历史原话。

**office**

- `office-n3` narrator［fact_paraphrase］：论坛里，有用户说无法登录。这是我第一次面对真实的线上 C 端用户。

**report**

- `report-reaction` narrator［fact_paraphrase］：屏幕上的反馈还在。这是我第一次面对真实的线上 C 端用户。

**incident**

- `incident-freeze` narrator［fact_paraphrase］：我盯着登录框，一动没动。
- `incident-cto-1` cto［staging］：都过来，一起看看。别急，先弄清楚发生了什么。
- `incident-rally` narrator［fact_paraphrase］：CTO 带着大家一起排查。

**investigation**

- `investigation-confirm-1` narrator［staging］：反馈上写的还是“无法登录”。我把这句记下来。
- `investigation-confirm-2` narrator［fact_paraphrase］：笔记本上写着：这次影响到的是真实用户。
- `investigation-confirm-3` narrator［staging］：屏幕上是这段时间排查用的记录。我把这页抄进笔记本，没有急着下结论。
- `investigation-handoff` cto［staging］：先到这里，大家都还在看。你去旁边缓一缓。

**restored**

- `restored-n1` narrator［fact_paraphrase］：画面压暗。整整两小时后，问题恢复了。
- `restored-colleague-1` colleague［staging］：没关系，大家都经历过。
- `restored-n3` narrator［fact_paraphrase］：CTO、老板、同事都过来安慰我，告诉我没关系，大家都经历过。

**learning**

- `learning-n1` narrator［fact_paraphrase］：后来，我们补了测试，也补了注释，说明这里为什么会踩坑。
- `learning-manual-1` narrator［staging］：工作手册翻到新的一页：“第一次上线，是真实用户先告诉我出了问题。补测试，写清楚坑；出了事，大家会一起扛。”

**complete**

- `complete-n1` narrator［staging］：本章到此结束。

## 六、可选探索与界面

3 个可选观察物件不写标记、不阻塞主线，office 与 complete 里都能看：`bookshelf`（书架，交互点 [19,4]）「书架上摆着几本翻旧的书，其中一本夹着一张便签。」；`window_plant`（窗边绿植，交互点 [3,13]）「窗边有一盆绿植，叶子擦得很干净。」；`coffee_mug`（保温杯，交互点 [6,13]）「桌上放着一个保温杯，杯盖没拧紧。」。主线提示是朱砂色小箭头加“去看看”，可选观察是石灰色圆点加“看看”，都不进任务条。

键盘：WASD／方向键移动（斜走不加速），E 或空格交互与推进对话，Esc 暂停，Tab 选择、Enter 确认；只有焦点在游戏区域时才接管方向键。触屏：虚拟方向键加 A 按钮，热区至少 44 CSS px，点提示或 A 按钮同样只在满足交互规则时触发，按钮避开对话面板。对话、论坛、笔记本、手册都用 DOM 与系统字体，可读屏，状态不只靠颜色；声音默认关闭，由开始页或暂停菜单开启。

## 七、暂停、跳过、刷新、存档与重玩

- 暂停与跳过：对话、论坛、笔记本与转场期间锁定移动并清空按键；切后台或失焦立即暂停，恢复时不补跑累积时间。刷新后按 savePolicy.restore 读回同一个快照。跳过只压缩当前句、当前对话或当前转场的表达，不改变事件结果；以确认项结尾的对话（T01／T02／T03／T07／T08）被跳过时只把文字直接展开，确认项仍需玩家点一次，确认后照常写快照。
- **存档政策** `atomic-per-event`：键 `career-rpg:nanjing:v1`，快照字段 schema, chapter, state, flags。检查点：all_states（office、report、incident、investigation、restored、learning、complete）。
- chapter_start：写 {state:office, flags:[]}，玩家在 [3,14]。玩家开始本章（或重玩）时，在写入任何事件之前先写一次。
- 确认项条件：确认项显示／接受条件 = requires 全部满足，并且本次 effects 至少有一个尚未在 flags 里。effects 已全在 flags 里时，该项只展示只读页：不接受、不写快照。物件当前确认项只从满足该条件的项里取，已完成的项不占位，后面的未完成确认与只读页照常出现。
- 被接受的事件：被接受的确认项才写：先 state = 转移的 to，再 flags = 旧 flags ∪ 选项 effects（并集，不删任何标记），最后把 {schema, chapter, state, flags} 作为同一个 JSON 值一次写入；一次事件只写一次，snapshot.state 就是写完后的当前状态。
- 未接受或重复：未接受的事件不改 state、不改 flags、不写入任何快照：只读页与关闭；requires 不满足；effects 已全部在 flags 里（已在 investigation 或 learning 写过同一标记后的再次确认，只显示该项只读页）；交互点或朝向不对。
- 读档：读档只读这一个快照，按 snapshot.state 与 snapshot.flags 原样恢复（exact snapshot）；state 与 flags 必须构成该状态的一个合法快照才算有效，不另存旧检查点状态，也不迁移旧格式。
- 重播：恢复后按 entryPlacement 把玩家摆到该状态入口格，并重播该状态的页面内短演出（见 replayLines：论坛开场、反应、呆住与 CTO 招呼、排查开场、宽慰）；重播里每句仍要玩家确认，不自动推进状态、不自动写快照。对象页只在玩家走到交互点时由玩家交互打开，恢复后不自动弹出。
- 非法快照：state 不在七个状态内、flags 不是该状态的合法组合、schema 或 chapter 不符、JSON 损坏、或存储写入失败：不迁移也不修补，按损坏存档处理，提供“重新开始”（写 chapter_start 快照）或“本次继续，不保存”（本会话可玩，重新载入即回到损坏提示）。第一版没有既有用户存档，不写任何迁移代码。

写快照的事件（一次事件一次完整写入，`state` 即写入后的当前状态）：

| 事件 | from → to | 快照 state | 快照 flags | 入口格 |
| --- | --- | --- | --- | --- |
| chapter_start | — → office | office | [] | [3,14] |
| T01 `open_forum_post` | office → report | report | [report_read] | [9,4] |
| T02 `read_feedback` | report → incident | incident | 保证标记 [report_read, incident_started] | [9,4] |
| T03 `cto_rallies_team` | incident → investigation | investigation | 保证标记 [report_read, incident_started, incident_seen] | [15,4] |
| T04 `confirm_feedback_reviewed` | investigation → investigation | investigation | 当前并集 + [feedback_reviewed] | [15,4] |
| T06 `confirm_recheck_visited` | investigation → investigation | investigation | 当前并集 + [recheck_visited] | [15,4] |
| T05 `confirm_impact_scope` | investigation → investigation | investigation | 当前并集 + [impact_confirmed] | [15,4] |
| T07 `resume_narrative` | investigation → restored | restored | 保证标记 [report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over] | [15,4] |
| T08 `comfort_read` | restored → learning | learning | 保证标记 [report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over, comfort_read] | [15,4] |
| T09 `review_test_plan` | learning → learning | learning | 当前并集 + [test_reviewed] | [15,4] |
| T10 `review_trap_comment` | learning → learning | learning | 当前并集 + [comment_reviewed] | [15,4] |
| T11 `write_manual_entry` | learning → complete | complete | 保证标记 [report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over, comfort_read, test_reviewed, comment_reviewed, manual_entry_written] | [21,4] |

刷新或重进读回同一快照：

- chapter_start：磁盘 {state:office, flags:[]}，入口 [3,14]；玩家在出生点 [3,14]，论坛未读；走到 [9,4] 才可做 open_forum_post。
- report：磁盘 {state:report, flags:[report_read]}，入口 [9,4]；读回 report，重播 office-n3、report-reaction，点“继续”做 read_feedback。
- incident：磁盘 {state:incident, flags:[report_read, incident_started]}，入口 [9,4]；读回 incident，重播呆住与 CTO 招呼，走到 [15,4] 做 cto_rallies_team。
- investigation（无）：磁盘 {state:investigation, flags:[report_read, incident_started, incident_seen]}，入口 [15,4]；重播排查开场；三项都还没记，分别去 forum_pc 做 confirm_feedback_reviewed、去 cto_pc 先做 confirm_recheck_visited 再做 confirm_impact_scope。
- investigation（feedback_reviewed）：磁盘 {state:investigation, flags:[report_read, incident_started, incident_seen, feedback_reviewed]}，入口 [15,4]；重播排查开场；已记的 feedback_reviewed 只在对应物件上显示只读页；recheck_visited（CTO 工位电脑）、impact_confirmed（CTO 工位电脑） 照常可做。
- investigation（recheck_visited）：磁盘 {state:investigation, flags:[report_read, incident_started, incident_seen, recheck_visited]}，入口 [15,4]；重播排查开场；已记的 recheck_visited 只在对应物件上显示只读页；feedback_reviewed（我的工位电脑）、impact_confirmed（CTO 工位电脑） 照常可做。
- investigation（feedback_reviewed+recheck_visited）：磁盘 {state:investigation, flags:[report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited]}，入口 [15,4]；重播排查开场；已记的 feedback_reviewed、recheck_visited 只在对应物件上显示只读页；impact_confirmed（CTO 工位电脑） 照常可做。
- investigation（recheck_visited+impact_confirmed）：磁盘 {state:investigation, flags:[report_read, incident_started, incident_seen, recheck_visited, impact_confirmed]}，入口 [15,4]；重播排查开场；已记的 recheck_visited、impact_confirmed 只在对应物件上显示只读页；feedback_reviewed（我的工位电脑） 照常可做。
- investigation（feedback_reviewed+recheck_visited+impact_confirmed）：磁盘 {state:investigation, flags:[report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed]}，入口 [15,4]；重播排查开场；三项齐全，cto_pc 出现“这轮排查先到这里”，做 resume_narrative。
- restored：磁盘 {state:restored, flags:[report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over]}，入口 [15,4]；读回 restored，重播宽慰，点“收起”做 comfort_read。
- learning（无）：磁盘 {state:learning, flags:[report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over, comfort_read]}，入口 [15,4]；重播 learning 开场；两项都还没看，去 test_notes 做 review_test_plan、去 trap_note 做 review_trap_comment，manual_shelf 只显示“还没看完”。
- learning（comment_reviewed）：磁盘 {state:learning, flags:[report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over, comfort_read, comment_reviewed]}，入口 [15,4]；重播 learning 开场；已记的 comment_reviewed 只在对应物件上显示只读页；test_reviewed（补测便签） 照常可做，manual_shelf 只显示“还没看完”。
- learning（test_reviewed）：磁盘 {state:learning, flags:[report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over, comfort_read, test_reviewed]}，入口 [15,4]；重播 learning 开场；已记的 test_reviewed 只在对应物件上显示只读页；comment_reviewed（坑点注释） 照常可做，manual_shelf 只显示“还没看完”。
- learning（test_reviewed+comment_reviewed）：磁盘 {state:learning, flags:[report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over, comfort_read, test_reviewed, comment_reviewed]}，入口 [15,4]；重播 learning 开场；两项齐全，manual_shelf 出现“把这页写进手册”，做 write_manual_entry。
- complete：磁盘 {state:complete, flags:[report_read, incident_started, incident_seen, feedback_reviewed, recheck_visited, impact_confirmed, outage_over, comfort_read, test_reviewed, comment_reviewed, manual_entry_written]}，入口 [21,4]；读回 complete，停在完成页，可结束或重玩。

- 重玩只清除本章命名空间，按 chapter_start 写 office 空标记，complete 处二次确认。

## 八、素材、声音与制作步骤

资源 ID 与 JSON `assets` 一一对应，尺寸、占格与锚点见[美术规格](./chapter-01-art.md)：角色 `player-walk`、`npc-cto`；家具 `obj-forum-pc`、`obj-trap-note`、`obj-test-notes`、`obj-cto-pc`、`obj-manual-shelf`、`obj-bookshelf`、`obj-plant`、`obj-mug`；地砖 `tile-floor-wood`、`tile-rug`、`tile-wall`、`tile-window`、`tile-outage-dim`；界面 `ui-dialog-box`、`ui-forum-panel`、`ui-notebook`、`ui-evidence-card`、`ui-manual-page`、`ui-hud-task`、`ui-choice-button`、`ui-mobile-controls`、`ui-pause-menu`、`ui-complete-card`。

声音只记录时长与是否循环，不设像素尺寸：`audio-ui-click` 60 ms、`audio-ui-move` 40 ms、`audio-notebook-tick` 120 ms、`audio-manual-page` 300 ms、`audio-open-forum` 220 ms、`audio-step` 150 ms、`audio-transition-dim` 400 ms、`audio-ambient-office` 1500 ms（循环）。制作步骤：

1. 用 16px 地砖、16×24 行走帧和 CTO 站位搭静态办公室，核对走道、交互点朝向与地图外的墙窗。
2. 实现纯剧情模块：选项、标记并集、原子快照与 exact 恢复；以本章 JSON 为数据源，先写覆盖七个检查点恢复的状态机测试。
3. 接入简单引擎：固定步长、碰撞只认 blockedTiles、交互规则（格与朝向）、对话锁定；演员不碰撞。
4. 完成 DOM 面板与键盘、触屏输入，声音默认关闭。
5. 制作行走图与家具，按锚点组装，补两小时转场的离散压暗。
6. 按验收方案跑 PLAY、STORY 与叙事核对，录完整样章与异常恢复片段。

## 九、风险

- 同一行几个交互点可能同时出提示；按“只高亮最近一个”处理，实机仍需确认。
- 排查段没有真实根因可演，容易显得空转；“去不同地方读一读、记下来”是否足够，要试玩判断。
- 呆住演示只有约 1.5 秒，过短看不出停顿、过长拖慢节奏；实机调到“能感到停顿”。
- 家具贴图比一格宽，遮挡按脚底行排序；两格宽的书架与 40px 宽的桌子要单独检查。
- 手机小屏上论坛、手册和方向键争空间，字号与布局需在 375 px 宽度实测后再定。
- 宽慰段落容易写成说教，试玩时请作者确认是否符合本人感受。
- 快照写失败（存储满、隐私模式）只能提示“本次继续，不保存”，实现时不得悄悄只写标记或只写状态。
- 调查段同一状态有 6 种合法快照、learning 有 4 种，complete 的快照还带着 learning 之前的全部标记；实现时要逐条对照 `legalSnapshots` 与各状态 `enterFlags`，不能只校验状态名。
- 论坛面板与对话是进入状态后的重播演出；对象页（论坛、CTO 电脑、便签、注释、手册）只由玩家在交互点打开，恢复后不应自动弹出，否则会挤掉“读反馈→呆住”的停顿。

## 十、Agent 先验与作者后验

本轮 Agent 只做设计：JSON 与两份正文由同一份数据生成；生成器内置只读模拟，按 `atomic-per-event` 从 chapter_start 出发，每个被接受的事件后把快照序列化再读回，再继续到 complete。这些不验证游戏是否可玩、画面、性能，也不代表史实被作者认可。

后续必须实测：浏览器走动与碰撞、交互规则与朝向、完整剧情、暂停与存档恢复、手机真机触控、素材加载与性能；未做之前一律标为“未验证”。

作者后验：事实顺序与语气是否符合本人记忆；是否接受“排查只读取转录、恢复靠转场”；探索与阅读节奏是否舒服；美术方向是否喜欢。未回复不视为认可。

