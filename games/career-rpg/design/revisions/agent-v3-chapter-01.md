# 南京：第一次上线

对象：`nanjing-first-release`，“一路写来”的首个可玩样章。人生时间线仍从合肥开始，本章只做南京。数据版为 [chapter-01.json](./chapter-01.json)，美术规格见 [chapter-01-art.md](./chapter-01-art.md)。状态：设计草案，尚未实现。2～3 分钟是按各状态预算推算的**预期**，不是实测。概念板 `art/nanjing-art-direction-v1.png` 既未获作者认可，也不是生产素材。

## 一、目标与节奏

玩家扮演当年的作者：论坛有人反馈无法登录；我第一次面对真实的线上 C 端用户，呆住；CTO 带大家排查；整整两小时后恢复；CTO、老板、同事安慰我；再补测试与注释，写进游戏里的工作手册。

事件顺序固定为：论坛反馈 → 呆住 → CTO 带大家排查 → 两小时 → 宽慰 → 补测试与注释 → 手册。没有考试、失败与分数，也没有要猜的技术谜题：排查段只让玩家去不同地方重读已有内容并记下来，恢复靠叙事转场交代。

| 状态 | 标题 | 预算 | 检查点 | 离开条件 |
| --- | --- | --- | --- | --- |
| office | 办公室 | 25s | scene | `open_forum_post`→report |
| report | 读到反馈 | 15s | none | `read_feedback`→incident |
| incident | 呆住 | 25s | none | `cto_rallies_team`→investigation |
| investigation | 一起排查 | 45s | per_event_then_on_leave | `resume_narrative`→restored |
| restored | 两小时后 | 25s | scene | `comfort_read`→learning |
| learning | 补测试与注释 | 35s | per_event_then_on_leave | `write_manual_entry`→complete |
| complete | 手册新增一页 | 10s | scene | — |

合计 180 秒，落在 120～180 秒的预期内；各状态预算含阅读与操作，需真人试玩校正。

## 二、事实、演出与缺失

| 内容 | 依据 |
| --- | --- |
| 用户在论坛反馈无法登录；作者第一反应是呆住；登录框故障整整两小时；CTO 带大家排查；事后 CTO、老板、同事安慰；补测试、注释说明为什么有坑 | 作者提供的事实，`fact_paraphrase` 转述，不作逐字记录 |
| “没关系，大家都经历过” | 作者提供的安慰大意，旁白 `fact_paraphrase` 转述；CTO、同事的台词是 `staging` 演出草稿 |
| 办公室布局、站位与朝向、论坛面板、笔记本、排查记录页、工作手册、按钮 | `staging`，游戏演出，不是确认的历史；手册是否在真实工作中存在未知 |

不写的边界见 JSON 的 `blockedHistoricalDetails`：事故根因、具体报错、代码和完整修复过程；排查中每个人具体做了什么（谁看日志、谁检查部署、谁负责哪部分服务）；具体技术分工、换浏览器、改密码、群消息是否持续、先吃饭、哪条路径漏测是不是根因；老板原话、同事姓名外貌与逐字安慰措辞（旁白按作者回忆转述，CTO、同事的台词是演出草稿）；事故与随后深夜学习是否存在直接因果；准确年份与日期；工作手册是否在真实工作中存在（本章手册为游戏机制）。本章因此不演换浏览器、改密码、查群聊、先吃饭、技术分工，也不把“某条路径漏测”当根因；登录示意不演“按钮点了没反应”，CTO 电脑上的排查记录不含根因。对白里没有真实报错、日志、用户名或日期，也没有制作注释；那些说明只写在本文和 JSON 的 `note` 字段。

## 三、地图与坐标

24×16 格，地砖 16×16 px，原点左上 (0,0)。出生点 [3,14]。**地图矩形内没有墙格**：墙与窗是背景层，上墙画在矩形上方一格高的区域（画布 y=-16～-1），窗在画布 x=80～143，左墙画在 x<0；背景层不铺进 24×16 地图、不写进 `blockedTiles`，地图边界本身阻挡移动。下表中每格要么是地板、地毯，要么是家具占格。

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

A 我的工位电脑 [9,3] · B CTO 工位电脑 [15,3] · C 补测便签 [13,3] · D 坑点注释 [11,3] · E/e 书架 [19,3][20,3] · F 手册书架 [21,3] · G 窗边绿植 [3,12] · H 保温杯 [6,12] · + 交互点 · @ 出生点 [3,14] · T CTO 站位 [16,2] · `.` 地板 · `,` 地毯。这 24×16 格里没有墙：墙与窗画在地图矩形上方一格高的背景区域（画布 y=-16～-1），左墙画在 x<0，不铺进任何可走格，也不参与碰撞。

| 对象 ID | 资产 ID | 用途 | 本体格 | 交互点 | 交互朝向 | footprint | 必选 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| forum_pc | `obj-forum-pc` | 我的工位电脑 | [9,3] | [9,4] | 朝下 | [9,3] | 是 |
| trap_note | `obj-trap-note` | 坑点注释 | [11,3] | [11,4] | 朝下 | [11,3] | 是 |
| test_notes | `obj-test-notes` | 补测便签 | [13,3] | [13,4] | 朝下 | [13,3] | 是 |
| cto_pc | `obj-cto-pc` | CTO 工位电脑 | [15,3] | [15,4] | 朝下 | [15,3] | 是 |
| manual_shelf | `obj-manual-shelf` | 手册书架 | [21,3] | [21,4] | 朝下 | [21,3] | 是 |
| bookshelf | `obj-bookshelf` | 书架 | [19,3] | [19,4] | 朝下 | [19,3] [20,3] | 否（可选） |
| warm_guy_plant | `obj-plant` | 窗边绿植 | [3,12] | [3,13] | 朝下 | [3,12] | 否（可选） |
| coffee_mug | `obj-mug` | CTO 的保温杯 | [6,12] | [6,13] | 朝下 | [6,12] | 否（可选） |

`blockedTiles` 共 9 格，全部来自上面的 footprint，每格只属于一个对象，没有额外装饰障碍；每个交互点离本体 1 格、不在 footprint 内，从出生点都能走到。CTO 整章站在 [16,2]，不移动、不占碰撞格，也不在交互点旁。

### 交互规则

对象有三个位置：**本体格** tile（家具所在格，玩家站不上去）、**交互点** interactionTile（玩家要站的格）、**视觉包围**（贴图像素，可比一格宽、向上高出格子）。触发需要同时满足：

1. 玩家所在格正是该对象的 interactionTile；
2. 玩家朝向是本体所在方向（表中的“交互朝向”；`interactionDirs` 在 JSON 里，由交互点与本体推算）；
3. 满足前两条才出现交互提示；朝向不对时第一次按键只转身，不触发。

例如 forum_pc：本体 [9,3] 在交互点 [9,4] 正上方，站 [9,4] 朝上——面前 [9,3] 是家具本体，这就是标准站位。站在 [9,2] 朝下、或站在书架另一格 [20,4]，都不算站在交互点上。触屏点提示遵守同一条规则：人不在交互点上只提示“走近一点”，不自动寻路、不隔空触发。

## 四、按状态的分镜、操作与结束条件

### office：办公室（约 25 秒，检查点 scene）

- 目标：从门口走到自己的工位电脑，打开论坛，看清用户不能登录的反馈。
- 玩家操作：走到 forum_pc 交互点 [9,4]，朝上，按 E／空格（手机点 A 按钮或点提示），读帖后点“确认，去处理”。路上可顺手看书架、绿植、保温杯。
- 结束与反馈：在 forum_pc 点“确认，去处理”，触发 open_forum_post。论坛面板出现，高亮“无法登录”；确认后进入 report。
- 重复：论坛已读后再交互只显示 office-reopen，不写新标记。若存档状态是 office，可用“接着处理”从已读反馈处继续（换到 report，不重复写 report_read）。
- 检查点：章节开始时写 {office, []} 快照，玩家在出生点 [3,14]。存档若停在 office，入口为出生点；带 report_read 时“接着处理”换到 report，不会用新标记配旧状态。
- 进入所需标记：无

### report：读到反馈（约 15 秒，检查点 none）

- 目标：看着屏幕上刚读过的反馈，意识到这是我第一次面对真实的线上 C 端用户。
- 玩家操作：进入 report 时玩家仍在 [9,4] 的交互点上，旁白与内心独白依次出现，移动锁定；读完点“继续”。
- 结束与反馈：旁白读完点“继续”（事件 read_feedback）后进入 incident，没有跑腿找 CTO 的步骤。任务条改为“先稳住”。我的位置不因剧情改变。
- 重复：这段反应每次回到 report 都播放；同一点击不会连带触发下一条事件。没有 report 快照。
- 检查点：不写快照，只保留 T01 写下的 {report, [report_read]} 快照；从中途退出后读档回到 report 入口，反应重播、report_read 不重复写。
- 进入所需标记：`report_read`

### incident：呆住（约 25 秒，检查点 none）

- 目标：让“呆住”先发生：我先看着登录框，做不出反应；随后 CTO 带大家一起排查。
- 玩家操作：进入 incident 时玩家仍在 [9,4]。约 1.5 秒里移动锁定、镜头停在登录示意上，我保持站立，这一幕表现“呆住”（按跳过键立即显示 incident-freeze）。随后 CTO 开口；走到 cto_pc 交互点 [15,4] 交互读对话，点“一起过去”。
- 结束与反馈：cto_pc 对话读完并点“一起过去”（事件 cto_rallies_team），进入 investigation。登录示意注在制作说明里标为“非技术复现”，只表现页面交不出结果，不显示真实报错或日志；CTO 在自己工位换朝下图示，不出现走路动画。之后可自由走动。
- 重复：演示与对话在 incident 只播一次；跳过键只压缩表达，事件照常写入。没有 incident 快照。
- 检查点：不写快照，只保留 T02 写下的 {incident, [report_read, incident_started]} 快照；从中途退出后读档回到 incident 开场，呆住演示与对话重播，标记不重复写。
- 进入所需标记：`report_read`、`incident_started`

### investigation：一起排查（约 45 秒，检查点 per_event_then_on_leave）

- 目标：在 CTO 带领大家排查时，做三件我能确认的事：重读论坛反馈、读 CTO 电脑上的排查记录、记下这次影响到谁。不猜根因。
- 玩家操作：a. 到 forum_pc [9,4] 交互，重读论坛反馈，点“记下来”（T04，feedback_reviewed）；b. 到 cto_pc [15,4] 交互，读 CTO 电脑上的排查记录，点“记下来”（T06，recheck_visited）；c. 再在 cto_pc [15,4] 交互，读笔记本上的“这次影响到谁”，点“记下来”（T05，impact_confirmed）。三项顺序任意、可来回。
- 结束与反馈：三项标记齐全后，在 cto_pc 交互并按“这轮排查先到这里”（事件 resume_narrative），进入 restored。任务条显示“排查 0/3→3/3”；继续按钮只在 3/3 出现。转场把时间推进整整两小时，玩家不需要真实等待。所有点击只表示“我去看了并记下来”，不代表修好了线上问题。
- 重复：已确认的项再点只显示 *-copy 台词，不重复写标记。最先在 cto_pc 交互且尚未看过排查记录时，只显示 investigation-cto-pc-first，先看记录才能记下影响范围。
- 检查点：不在进入时写快照，避免把“刚进入”当成“已离开”。每次首次确认（T04／T05／T06）都写一个{investigation, 当前标记, 当前格} 快照；离开（T07）写入 restored 快照。中途刷新回到最近一次确认。
- 进入所需标记：`report_read`、`incident_started`、`incident_seen`

### restored：两小时后（约 25 秒，检查点 scene）

- 目标：接受“整整两小时后、问题恢复”的叙事转场，读 CTO、老板、同事的宽慰。
- 玩家操作：转场中不移动；点“继续”或按跳过键逐句出示旁白与宽慰。读完最后一句，在对话框上点“收起”，只关闭宽慰。
- 结束与反馈：点“收起”（事件 comfort_read），进入 learning。画面用离散色阶降暗显示“两小时后”，然后用 2～3 句交代问题恢复；对白标明事实转述与演出。
- 重复：回到 restored 会重播宽慰；每句单独确认，点“收起”一次只做一件事。带 comfort_read 的存档不在 restored，而是停在 learning 快照。
- 检查点：进入 restored（T07）时写 {restored, 全部排查标记+outage_over} 快照，玩家由演出摆在 [15,4]。此后另起事件 comfort_read 才离开，宽慰因此可以单独重播。
- 进入所需标记：`report_read`、`incident_started`、`incident_seen`、`feedback_reviewed`、`impact_confirmed`、`recheck_visited`、`outage_over`

### learning：补测试与注释（约 35 秒，检查点 per_event_then_on_leave）

- 目标：亲眼看补测试和坑点注释，再把经验写进工作手册。
- 玩家操作：test_notes [13,4] 交互并点“确认看过测试计划”（T09）；trap_note [11,4] 交互并点“确认看过注释”（T10）；两者顺序任意、可来回。两项齐全后到 manual_shelf [21,4] 交互并点“把这页写进手册”（T11）。
- 结束与反馈：test_reviewed 与 comment_reviewed 都写入后，在 manual_shelf 点“把这页写进手册”（事件 write_manual_entry，requires 同时包含两个标记），进入 complete。任务条“看过 0/2→2/2”；手册打开新页（learning-manual-1），状态进入 complete。
- 重复：review_test_plan／review_trap_comment 只在第一次交互写标记，再次交互只显示 learning-test-copy／learning-comment-copy，不加标记、不倒退。
- 检查点：进入 learning（comfort_read）时写快照；T09／T10 每首次写入一个标记再写一次新快照。任一标记组合都合法，读档后剩余的确认照常可做。
- 进入所需标记：`report_read`、`incident_started`、`incident_seen`、`feedback_reviewed`、`impact_confirmed`、`recheck_visited`、`outage_over`、`comfort_read`

### complete：手册新增一页（约 10 秒，检查点 scene）

- 目标：翻看本章手册页，结束或重玩。
- 玩家操作：读手册页；之后仍可走动和观察。选“结束本章”（收起手册，显示章节完成摘要）或“从办公室重玩”（弹层再确认一次）。
- 结束与反馈：章节结束，本身已是终态。重玩是另一个入口，不是状态转移。显示“第一章完成”、本章事实与演出说明、回博客链接与重玩入口。
- 重复：重新载入存档直接停在 complete；重玩会先确认，只清除本游戏命名空间下的本章存档。
- 检查点：T11 写入 {complete, 全部标记} 快照，玩家由演出摆在 [21,4]；读档停在 complete。
- 进入所需标记：`report_read`、`incident_started`、`incident_seen`、`feedback_reviewed`、`impact_confirmed`、`recheck_visited`、`outage_over`、`comfort_read`、`test_reviewed`、`comment_reviewed`、`manual_entry_written`

### 事件表

每个交互按 `options` 顺序取第一个 requires 全部满足的选项；效果**并入**标记集合，不删除已有标记。只有带 effects 的选项（“确认”）才推进状态，关闭／只读选项不改状态也不写标记；没有可执行选项时按钮不显示。`shownWhen` 只是显示条件。调查段三项确认来自不同页面：论坛反馈在 forum_pc，排查记录与影响范围在 cto_pc 的两个不同读屏页。

| ID | 事件 | from → to | 交互目标 | 选项（label／choice／requires → effects） |
| --- | --- | --- | --- | --- |
| T01 | `open_forum_post` | office → report | forum_pc | 确认，去处理／`confirm`／— → report_read；接着处理（已读反馈）／`resume_report`／report_read → report_read；关闭／`close`／report_read → — |
| T02 | `read_feedback` | report → incident | dialog | 继续／`confirm`／report_read → incident_started；关闭／`close`／report_read → — |
| T03 | `cto_rallies_team` | incident → investigation | cto_pc | 一起过去／`confirm`／report_read, incident_started → incident_seen |
| T04 | `confirm_feedback_reviewed` | investigation → investigation | forum_pc | 记下来／`confirm`／report_read, incident_started, incident_seen → feedback_reviewed；关闭／`close`／report_read, incident_started, incident_seen, feedback_reviewed → — |
| T06 | `confirm_recheck_visited` | investigation → investigation | cto_pc | 记下来／`confirm`／report_read, incident_started, incident_seen → recheck_visited；关闭／`close`／report_read, incident_started, incident_seen, recheck_visited → — |
| T05 | `confirm_impact_scope` | investigation → investigation | cto_pc | 记下来／`confirm`／report_read, incident_started, incident_seen, recheck_visited → impact_confirmed；先看排查记录／`close`／report_read, incident_started, incident_seen → —；关闭／`close`／report_read, incident_started, incident_seen, recheck_visited, impact_confirmed → — |
| T07 | `resume_narrative` | investigation → restored | cto_pc | 这轮排查先到这里／`confirm`／report_read, incident_started, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited → outage_over；关闭／`close`／report_read, incident_started, incident_seen → — |
| T08 | `comfort_read` | restored → learning | dialog | 收起／`confirm`／report_read, incident_started, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited, outage_over → comfort_read；关闭／`close`／report_read, incident_started, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited, outage_over → — |
| T09 | `review_test_plan` | learning → learning | test_notes | 确认看过测试计划／`confirm`／report_read, incident_started, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited, outage_over, comfort_read → test_reviewed |
| T10 | `review_trap_comment` | learning → learning | trap_note | 确认看过注释／`confirm`／report_read, incident_started, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited, outage_over, comfort_read → comment_reviewed |
| T11 | `write_manual_entry` | learning → complete | manual_shelf | 把这页写进手册／`confirm`／report_read, incident_started, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited, outage_over, comfort_read, test_reviewed, comment_reviewed → manual_entry_written |

为什么能走通：T01 论坛→T02 读反应→T03 呆住后 CTO 招呼大家（呆住先于 CTO 介入）；T04（forum_pc 重读反馈）、T06（cto_pc 读排查记录）、T05（cto_pc 读影响范围，要求先看过记录）各写一个标记，T07 要三项齐全才进 restored，进入 investigation 不会自动恢复；T09、T10 各写一次 `test_reviewed`、`comment_reviewed`，T11 同时要求两者；T08 只在点“收起”时触发。重复触发只出现 *-copy 台词，标记不变。

## 五、关键对白

完整对白与显示条件以 JSON 的 `dialogues` 为准，这里只列关键句。`fact_paraphrase` 是事实转述，`staging` 是演出，都不是历史原话。


**office**

- `office-n3` narrator［fact_paraphrase］：论坛里，有用户说无法登录。这是我第一次面对真实的线上 C 端用户。

**report**

- `report-reaction` narrator［fact_paraphrase］：屏幕上的反馈还在。这是我第一次面对真实的线上 C 端用户。

**incident**

- `incident-freeze` narrator［staging］：我盯着登录框，一动没动。
- `incident-cto-1` cto［staging］：都过来，一起看看。别急，先弄清楚发生了什么。
- `incident-rally` narrator［staging］：CTO 带着大家一起排查。

**investigation**

- `investigation-n1` narrator［staging］：我能确认的事不多，先一件件记下来：再读一遍反馈，看看 CTO 电脑上的记录，记下这次影响到谁。
- `investigation-confirm-1` narrator［fact_paraphrase］：用户说的是无法登录。我把这句话记在笔记本上。
- `investigation-confirm-2` player［staging］：（笔记本上写着：这次影响到的是真实用户。）
- `investigation-confirm-3` narrator［staging］：CTO 电脑上记着大家这段时间看过的线索。我把这页抄进自己的笔记本，没有急着下结论。
- `investigation-handoff` cto［staging］：先到这里。你去旁边缓一缓，这边还有大家。

**restored**

- `restored-n1` narrator［fact_paraphrase］：画面转暗。整整两小时后，问题恢复了。
- `restored-cto-1` cto［staging］：好了，没事了，别太自责。
- `restored-colleague-1` colleague［staging］：没关系，大家都经历过。
- `restored-n3` narrator［fact_paraphrase］：CTO、老板、同事都安慰我，告诉我没关系，大家都经历过。

**learning**

- `learning-n1` narrator［fact_paraphrase］：后来，我们补了测试，也补了注释，说明这里为什么会踩坑。
- `learning-manual-1` narrator［staging］：手册翻到新的一页：“第一次上线，是真实用户先告诉我出了问题。补测试，写清楚坑；出了事，大家会一起扛。”

**complete**

- `complete-n1` narrator［staging］：本章到此结束。

可选观察的旁白按“对象×状态”各一条（如 `observe-mug-learning`），`staging`，不推进剧情。

## 六、可选探索与界面

三个可选观察物件不写标记、不阻塞主线，任何可走动状态都能看：`bookshelf`「书架上摆着几本翻旧的书，其中一本夹着一张便签。」；`warm_guy_plant`「窗边有一盆绿植，叶子擦得很干净。」；`coffee_mug`「桌上放着一个保温杯，杯盖没拧紧。」。主线提示是朱砂小箭头加“去看看”，可选观察是石灰圆点加“看看”，都不进任务条。

键盘：WASD／方向键移动（斜走不加速），E 或空格交互和推进对话，Esc 暂停，Tab 选择、Enter 确认；只有焦点在游戏区域时才接管方向键。触屏：虚拟方向键加 A 按钮，热区至少 44 CSS px，点提示或 A 按钮同样只在满足交互规则时触发，按钮避开对话面板。对话、论坛、笔记本、手册都用 DOM 与系统字体，可读屏，状态不只靠颜色区分；打开面板时焦点进入面板，关闭后回到游戏区域。声音默认关闭，由开始页或暂停菜单主动开启。

## 七、暂停、跳过、刷新、存档与重玩

- 对话、论坛和转场期间锁定移动并清空按键；切后台或失焦即暂停，回来不补跑时间。
- 跳过只压缩当前表达：跳过呆住演示、立即显示当前句。事件、标记与转移照常写入，不连带到下一段。
- **原子快照**：每次把 {schema, state, flags} 作为一个 JSON 对象一次写入 `career-rpg:nanjing:v1`，读时整体校验；标记从不单独保存，因此不会出现“新标记配旧检查点状态”。
- 写快照的时机：
  - chapter_start：{state:office, flags:[]}。
  - T01 open_forum_post：{state:report, flags:[report_read]}。
  - T02 read_feedback：{state:incident, flags:[report_read, incident_started]}。
  - T03 cto_rallies_team：{state:investigation, flags:[…, incident_seen]}。
  - T04／T05／T06 首次确认后：{state:investigation, flags:当前并集}。
  - T07 resume_narrative：{state:restored, flags:…+outage_over}。
  - T08 comfort_read：{state:learning, flags:…+comfort_read}。
  - T09／T10 首次写入标记后：{state:learning, flags:当前并集}。
  - T11 write_manual_entry：{state:complete, flags:全部}。
- 恢复：读档按快照整体恢复 state 与 flags，玩家由该状态入口摆放；每个写快照的事件都把该状态的必需标记一并写入，恢复后的状态与标记总是一对合法配置。
- 刷新示例：
  - office 初始存档：chapter_start 写入 {office, []}；刷新读回后玩家在 [3,14]，做 open_forum_post。
  - report 刷新（review-04 反例）：磁盘是 {report, [report_read]}；读回 report，玩家在 [9,4]，再读反应，点“继续”进 incident。若退回 chapter_start 快照，则落在 office 且带 report_read，论坛选项为“接着处理”，换到 report 重新开始反应。两条路径都能前进。
  - incident 刷新：磁盘是 {incident, [report_read, incident_started]}；读回 incident，玩家在 [9,4]，重播呆住演示与 CTO 对话，再与 cto_pc 交互。
  - 调查自循环：三次确认各写一次 {investigation, 当前并集}；读回后玩家在 [15,4]，已确认项只显示 *-copy，剩余确认照常可做；三项齐全后在 cto_pc 选“这轮排查先到这里”进 restored。
  - learning 任一标记组合：T08 写 {learning, 无测试/注释标记}；T09／T10 分别重写快照。四种组合（无、只有测试、只有注释、两者）都合法，手册书架的“把这页写进手册”只在两者都有时出现。
  - complete：T11 写 {complete, 全部标记}；读回直接停在 complete。
- **review-04 反例的修复**：office 带 report_read 时，论坛选项为“接着处理”：先播 office-reopen 原文，再进入 report 入口；report_read 来自原快照，不新写标记。键盘 E 在同一配置下也只做这一件事。
- 损坏、旧版本或存储不可用时提供“重新开始／本次继续，不保存”，不白屏，不碰其他站点数据。重玩只清除本章命名空间，回到 office，complete 处二次确认。

## 八、素材、声音与制作步骤

资源 ID 与 JSON `assets` 一一对应，尺寸、占格与锚点见[美术规格](./chapter-01-art.md)：角色 `player-walk`、`npc-cto`；家具 `obj-forum-pc`、`obj-trap-note`、`obj-test-notes`、`obj-cto-pc`、`obj-manual-shelf`、`obj-bookshelf`、`obj-plant`、`obj-mug`；地砖 `tile-floor-wood`、`tile-rug`、`tile-wall`、`tile-window`、`tile-outage-dim`；界面 `ui-dialog-box`、`ui-forum-panel`、`ui-notebook`、`ui-manual-page`、`ui-hud-task`、`ui-choice-button`、`ui-mobile-controls`、`ui-pause-menu`。

声音只记录时长与是否循环，不设像素尺寸：`audio-ui-click` 60 ms、`audio-ui-move` 40 ms、`audio-notebook-tick` 120 ms、`audio-manual-page` 300 ms、`audio-open-forum` 220 ms、`audio-step` 150 ms、`audio-transition-dim` 400 ms、`audio-ambient-office` 1500 ms（循环）。制作步骤：

1. 用 16px 地砖、16×24 站立帧和 CTO 站位搭静态办公室，核对走道、交互点朝向与地图外的墙窗。
2. 实现纯剧情模块：选项按顺序取第一个满足项、标记并集、原子快照；以本章 JSON 为数据源，先写覆盖各检查点恢复的状态机测试。
3. 接入简单引擎：固定步长、碰撞只认 blockedTiles、交互规则（格与朝向）、对话锁定；演员不碰撞。
4. 完成 DOM 面板与键盘、触屏输入，声音默认关闭。
5. 制作行走图与家具，按锚点组装图集，补两小时转场的离散压暗。
6. 按验收方案跑 PLAY、STORY 与叙事核对，录完整样章与异常恢复片段。

## 九、风险

- 同一行的几个交互点可能同时出提示：站到 [9,4] 时 [11,4]／[13,4] 也可能亮；按距离只高亮最近对象，触发仍须满足交互规则。
- 排查段没有真实根因可演，容易显得空转；靠“去不同地方读一读、记下来”维持参与感是否足够，要试玩判断。
- “接着处理”是新增的恢复入口，实现时要确认它与 E 键、A 按钮不会重复触发。
- 呆住演示只有 1.5 秒，过短看不出停顿，过长拖慢节奏；实机调到“能感到停顿”即可。
- 家具贴图比一格宽，遮挡排序用脚底锚点所在行；两格宽的书架与 40px 宽的桌子要分别检查。
- 手机小屏上论坛、手册和方向键争空间，字号与布局需在 375 px 宽度实测后再定。
- 宽慰段落容易被写成说教，试玩时请作者确认是否符合本人感受。

## 十、Agent 先验与作者后验

本轮 Agent 只做设计侧工作：三份文件由同一份数据生成，JSON 与正文中的坐标、事件、对白、资源 ID 共用同一来源；地图 ASCII 由同一份地图数据渲染；生成器内置只读的存档恢复模拟。这些检查不验证游戏是否可玩、画面、性能，或史实是否被作者逐条认可。

后续必须实测：浏览器中走动与碰撞、交互规则与朝向、完整剧情、暂停与存档恢复、手机真机触控、素材加载与性能；未做之前一律标为“未验证”。

作者后验：事实顺序与语气是否符合本人记忆；是否接受“排查只读取转录、恢复靠转场”的处理；探索与阅读节奏是否舒服；美术方向是否喜欢。作者反馈以本人说法为准，未回复不视为认可。

