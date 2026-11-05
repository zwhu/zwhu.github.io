# 南京：第一次上线：第一章设计

对象：`nanjing-first-release`，“一路写来”首个可玩样章。人生时间线仍从合肥开始，本章只做南京。数据版为 [chapter-01.json](./chapter-01.json)，美术规格见 [chapter-01-art.md](./chapter-01-art.md)。状态：设计草案。游戏未实现，未在浏览器中试玩，时长 2～3 分钟是设计估计，不是实测。概念板 `art/nanjing-art-direction-v1.png` 尚未获作者认可，也不是生产素材。

## 一、目标与情绪

玩家扮演当年的作者，从“用户说登录不了”走到第一次有人接住自己：看到真实反馈、呆住、在 CTO 带领下做自己能确认的事、两小时后被宽慰、最后把补测试与坑点注释写进手册。章节要传达的是**上线要负责，也由团队一起扛**。不设考试、失败、数值和惩罚，也没有需要猜的技术谜题：根因不在已知事实里，调查段只确认事实范围内的行为，恢复通过叙事转场交代。

| 状态 | 标题 | 预算 | 检查点 | 退出条件（数据里的转移） |
| --- | --- | --- | --- | --- |
| office | 办公室 | 25s | 否 | `open_forum_post`→report |
| report | 告诉 CTO | 20s | 否 | `talk_to_cto`→incident |
| incident | 呆住 | 20s | 否 | `see_login_failure`→investigation |
| investigation | 一起排查 | 40s | 是 | `resume_narrative`→restored |
| restored | 两小时后 | 20s | 是 | `finish_comfort_scene`→learning |
| learning | 补测试与注释 | 35s | 是 | `write_manual_entry`→complete |
| complete | 手册新增一页 | 10s | 是 | — |

预算合计约 170 秒（含极少阅读停顿），落在 120～180 秒的 2～3 分钟预期内；这是按状态估算，需真人试玩校正。

## 二、事实、演出与缺失

| 对白里出现的内容 | 依据 |
| --- | --- |
| 用户论坛反馈无法登录；登录框故障约两小时；CTO 带大家排查；CTO、老板、同事安慰；“没关系，大家都经历过”；事后补测试与注释说明为什么有坑 | 作者提供的事实，`fact_paraphrase` 转述，“没关系，大家都经历过”是回忆原文，其余安慰词按大意转述 |
| 办公室布局、人物站位、找 CTO／召集同事的动作、“确认我去看了”等按钮、工作手册与记录页 | 演出或游戏机制，`staging`，不是确认的历史 |

不写进本章的内容见 JSON 的 `blockedHistoricalDetails`：
- 事故根因、具体报错、代码和完整修复过程
- 排查中每个人具体做了什么（谁看日志、谁检查部署、谁负责哪部分服务）
- 是否换了浏览器、改过密码、群聊消息是否持续
- 老板原话、同事姓名外貌与具体安慰措辞（“没关系，大家都经历过”按作者回忆转述，不保证逐字）
- 事故与随后深夜学习是否存在直接因果
- 准确年份与日期
- 工作手册是否在真实工作中存在（本章手册为游戏机制）

换浏览器、改密码、群消息是否还在、先吃饭、哪条路径漏测、每个人在排查里分工做什么，都没有依据，整段不写。恢复不靠点某个按钮，T07 只结束调查、开始时间转场；真实问题怎么修好的，本章不解释。工作手册只是把经验留在游戏里的方式，不是“作者当时写了手册”的记录。对白用演出草稿，没有真实报错、日志、用户名和日期。

## 三、地图与坐标

24×16 格，16px 地砖，原点左上 (0,0)，x 向右、y 向下。出生点 [3,12]（门口）。第 0 行是墙与窗，只作背景；地图矩形边界就是可走范围，不额外画第 1 行墙碰撞。下图每行 24 格，`#` 为不可走家具占格，`+` 为交互点，`@` 为出生点，`T` 为 CTO 的站位（演员不挡路），`.` 为可走地板或地毯。

```text
    012345678901234567890123
 0 ########################
 1 ........................
 2 .......C...D.......EeF..
 3 .......+...+.......+.+..
 4 ........................
 5 .........A.....B........
 6 .........+.....+........
 7 ........................
 8 ........................
 9 ........................
10 ............+.+.T.......
11 ............G.H.........
12 ...@....................
13 ........................
14 ........................
15 ........................
```

A 我的工位电脑 [9,5] · B CTO 工位电脑 [15,5] · C 补测便签 [7,2] · D 坑点注释 [11,2] · E/e 书架 [19,2][20,2] · F 手册书架 [21,2] · G 窗边绿植 [12,11] · H 保温杯 [14,11] · + 交互点 · @ 出生点 [3,12] · T CTO 站位 · # 第 0 行墙与窗

| 对象 ID | 资产 ID | 用途 | 本体格 | 交互点 | 地面占格 footprint | 必选 |
| --- | --- | --- | --- | --- | --- | --- |
| forum_pc | `obj-forum-pc` | 我的工位电脑 | [9,5] | [9,6] | [9,5] | 是 |
| test_notes | `obj-test-notes` | 补测便签 | [7,2] | [7,3] | [7,2] | 是 |
| trap_note | `obj-trap-note` | 坑点注释 | [11,2] | [11,3] | [11,2] | 是 |
| cto_pc | `obj-cto-pc` | CTO 工位电脑 | [15,5] | [15,6] | [15,5] | 是 |
| bookshelf | `obj-bookshelf` | 书架 | [19,2] | [19,3] | [19,2] [20,2] | 否（可选观察） |
| manual_shelf | `obj-manual-shelf` | 手册书架 | [21,2] | [21,3] | [21,2] | 是 |
| warm_guy_plant | `obj-plant` | 窗边绿植 | [12,11] | [12,10] | [12,11] | 否（可选观察） |
| coffee_mug | `obj-mug` | CTO 的保温杯 | [14,11] | [14,10] | [14,11] | 否（可选观察） |

`blockedTiles` 共 9 格，全部由上面的 footprint 给出，没有单独画的装饰障碍；每个交互点与本体曼哈顿距离为 1，不在任何 footprint 内，且从出生点四向可达。可走的主通道 y=7～9 与 y=12～15 保持空。角色位置不作为碰撞：玩家可以从 CTO 身边走过；CTO 不走寻路，换状态时直接换展示位置（office→[16,10]，report→[16,10]，incident→[16,6]，investigation→[16,6]，restored→[16,6]，learning→[16,10]，complete→[16,10]）。玩家出生在门口，不因剧情瞬移。

## 四、按状态的分镜、玩家操作与结束条件

### office：办公室（约 25 秒，不单独存档）

- 目标：从门口走到自己的工位电脑，打开论坛，看清用户不能登录的反馈。
- 玩家操作：走到 forum_pc 南侧 [9,6]，按 E／空格（手机点 A 按钮），读帖后点“确认，去处理”。路上可顺手看书架、绿植、保温杯。
- 结束条件：在 forum_pc 点“确认，去处理”，触发 open_forum_post。
- 场景反馈：论坛面板出现，高亮“无法登录”；确认后进入 report。任务条改为“把反馈告诉 CTO”。
- 重复／刷新：论坛已读后再交互显示 office-reopen，不改变状态。
- 进入所需标记：无（初始状态）

### report：告诉 CTO（约 20 秒，不单独存档）

- 目标：把论坛反馈告诉 CTO，主动跟他一起处理。
- 玩家操作：读旁白与我的反应，点“去找 CTO”解锁移动，走到 cto_pc 南侧 [15,6] 交互读完对话。
- 结束条件：cto_pc 对话读完，触发 talk_to_cto。
- 场景反馈：CTO 说“先别一个人扛”。状态进入 incident：我的工位电脑仍在正常登录页，CTO 换成站位 [16,6]，等玩家过来。
- 重复／刷新：report 的对话只在进入 report 后播放一次；刷新会回到最近检查点，已读论坛时再交互只显示 office-reopen，不会重复写 report_read。
- 进入所需标记：`report_read`

### incident：呆住（约 20 秒，不单独存档）

- 目标：亲眼看登录框交不出结果，承认自己当下不知道怎么办。
- 玩家操作：看 1.5 秒演示（可按跳过键，改为一段说明句）；随后走到 cto_pc [15,6] 对话读完。
- 结束条件：cto_pc 对话读完，触发 see_login_failure。
- 场景反馈：登录框按钮点了不动，画面只给静止与短闪，不显示报错与日志；CTO 招呼大家，对话后进入 investigation，可自由走动。
- 重复／刷新：演示与对话在 incident 只播一次；跳过键只压缩表达。
- 进入所需标记：`report_read`、`cto_informed`

### investigation：一起排查（约 40 秒，稳定检查点）

- 目标：在 CTO 带领下做自己能确认的事：看反馈、确认影响、复查登录页。不猜根因。
- 玩家操作：到 cto_pc [15,6] 对话，三项确认任选顺序，每项都要按“确认我去看了”，每项各点一次（配对白见下表）；三项齐全后按“这轮排查先到这里”。
- 结束条件：三项标记齐全后按“这轮排查先到这里”，触发 resume_narrative。
- 场景反馈：笔记本上勾选依次亮起，任务条显示“排查 0/3→3/3”；继续按钮只在 3/3 出现。转场里时间推进两小时，玩家不需要真实等待。
- 重复／刷新：已确认的项再点不再计入，也不重复加标记（investigation-short）；三项之间无先后顺序。
- 进入所需标记：`report_read`、`cto_informed`、`incident_seen`

### restored：两小时后（约 20 秒，稳定检查点）

- 目标：接受“过了一阵、大家把问题处理了”的转场，读团队宽慰。
- 玩家操作：转场中不移动；按跳过键或点“继续”逐句出示旁白与宽慰，最后点“收起”。
- 结束条件：转场最后一句点“收起”，触发 finish_comfort_scene。
- 场景反馈：画面以离散色阶降暗显示“两小时后”；宽慰逐句出现（事实转述，台词为演出草稿），收尾框显示“把这一页留给 CTO 和同事”，然后进入 learning。
- 重复／刷新：已读过宽慰（comfort_read）时刷新，直接回到 learning 起点，不重播整段转场；暂停菜单的“重看本段”只回放文字，不改任何标记。
- 进入所需标记：`report_read`、`cto_informed`、`incident_seen`、`feedback_reviewed`、`impact_confirmed`、`recheck_visited`、`outage_over`

### learning：补测试与注释（约 35 秒，稳定检查点）

- 目标：亲眼看补测试计划与坑点注释，再把经验写进手册。
- 玩家操作：test_notes [7,3] 交互并点“确认看过测试计划”；trap_note [11,3] 交互并点“确认看过注释”（两者顺序任意、可来回）；两项齐全后到 manual_shelf [21,3] 交互并点“把这页写进手册”。
- 结束条件：test_reviewed 与 comment_reviewed 都写入后，在 manual_shelf 点“把这页写进手册”，触发 write_manual_entry。
- 场景反馈：任务条“看过 0/2→2/2”；手册打开新页（learning-manual-1），状态进入 complete。
- 重复／刷新：review_test_plan／review_trap_comment 各只写入一次标记，再交互只重复 learning-test-copy ／learning-comment-copy；两项未齐时在 manual_shelf 交互只显示 learning-pending，不转移。
- 进入所需标记：`report_read`、`cto_informed`、`incident_seen`、`feedback_reviewed`、`impact_confirmed`、`recheck_visited`、`outage_over`、`comfort_read`

### complete：手册新增一页（约 10 秒，稳定检查点）

- 目标：翻看本章手册页，结束或重玩。
- 玩家操作：读手册页；之后仍可走动和观察。选“结束本章”（收起手册，显示章节完成摘要）或“从办公室重玩”（弹层再确认一次）。
- 结束条件：章节结束，本身已是终态。重玩是另一个入口，不是状态转移。
- 场景反馈：显示“第一章完成”、本章事实与演出说明、回博客链接与重玩入口。
- 重复／刷新：重新载入存档直接停在 complete；重玩会先确认，只清除本游戏命名空间下的本章存档。
- 进入所需标记：`report_read`、`cto_informed`、`incident_seen`、`feedback_reviewed`、`impact_confirmed`、`recheck_visited`、`outage_over`、`comfort_read`、`test_reviewed`、`comment_reviewed`、`manual_entry_written`

### 条件转移与标记

`requires` 只能引用已有事件写下的标记；每个标记只由一个事件写入，事件重放不重复加标记。

| ID | 事件 | from → to | 触发对象与动作 | 玩家确认 | requires | effects |
| --- | --- | --- | --- | --- | --- | --- |
| T01 | `open_forum_post` | office → report | forum_pc / activate | 确认，去处理 | — | report_read |
| T02 | `talk_to_cto` | report → incident | cto_pc / activate | 去找 CTO | report_read | cto_informed |
| T03 | `see_login_failure` | incident → investigation | cto_pc / activate | 继续 | report_read, cto_informed | incident_seen |
| T04 | `confirm_feedback_reviewed` | investigation → investigation | cto_pc / activate | 确认我去看了：一起看用户反馈 | report_read, cto_informed, incident_seen | feedback_reviewed |
| T05 | `confirm_impact_scope` | investigation → investigation | cto_pc / activate | 确认我去看了：确认影响 | report_read, cto_informed, incident_seen | impact_confirmed |
| T06 | `confirm_recheck_visited` | investigation → investigation | cto_pc / activate | 确认我去看了：一起复查登录页 | report_read, cto_informed, incident_seen | recheck_visited |
| T07 | `resume_narrative` | investigation → restored | cto_pc / activate | 这轮排查先到这里 | report_read, cto_informed, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited | outage_over |
| T08 | `finish_comfort_scene` | restored → learning | dialog / activate | 收起 | report_read, cto_informed, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited, outage_over | comfort_read |
| T09 | `review_test_plan` | learning → learning | test_notes / read | 确认看过测试计划 | report_read, cto_informed, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited, outage_over, comfort_read | test_reviewed |
| T10 | `review_trap_comment` | learning → learning | trap_note / read | 确认看过注释 | report_read, cto_informed, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited, outage_over, comfort_read | comment_reviewed |
| T11 | `write_manual_entry` | learning → complete | manual_shelf / activate | 把这页写进手册 | report_read, cto_informed, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited, outage_over, comfort_read, test_reviewed, comment_reviewed | manual_entry_written |

为什么这样能走通：T04～T06 是 investigation 内的三个自循环，任选顺序，各自只写一项确认；T07 同时要求三项。learning 中 T09、T10 各写一次 `test_reviewed`、`comment_reviewed`，T11 进入 complete 要求两者都在，已写过的标记再点不会重复，所以任何能到达的标记组合都能结束。调查段必须由玩家在 cto_pc 处实际操作一次确认，不会进入 investigation 就自动恢复；最后一项确认按“这轮排查先到这里”后才进入 restored。

## 五、对白草稿

说话人：`narrator` 旁白，`player` 我，`cto`、`colleague` 同事；老板不出场，只在旁白中转述。basis：`fact_paraphrase` 事实转述，`staging` 演出草稿或回忆大意（措辞不作历史原话）。

**office**

- `office-n1` narrator［staging］：南京的办公室，下午。屋里安静，只有键盘声。
- `office-first-pc-1` player［staging］：（打开论坛，看看怎么回事。）
- `office-n3` narrator［fact_paraphrase］：帖子很短：有用户说，登录页打不开自己的账号。这是这个项目第一次面对真实的线上用户。
- `office-n4` player［staging］：（先别慌，把这事告诉 CTO。）
- `office-reopen` narrator［staging］：论坛帖已经看过了。剩下的，得和 CTO 一起想办法。
- `observe-bookshelf-office` narrator［staging］：书架上摆着翻旧的 JavaScript 书。有本借出去又被人放回来的，书脊都弯了。（游戏里的观察，不代表当时的书架。）
- `observe-plant-office` narrator［staging］：窗边的绿植长得挺精神，谁空下来就顺手浇一点水。（游戏里的观察，不代表当时的样子。）
- `observe-mug-office` narrator［staging］：CTO 桌上的保温杯，贴着张旧贴纸，边角都翘起来了。（游戏里的观察，不代表当时的摆设。）

**report**

- `report-n1` narrator［fact_paraphrase］：我去找 CTO，把论坛里的反馈说给他听。
- `report-cto-1` cto［fact_paraphrase］：先别一个人扛。这事我带大家一起看看。
- `report-cto-2` cto［staging］：你先往工位那边走，我马上过去。
- `report-n2` narrator［staging］：CTO 放下杯子，跟我一起往工位那边走。
- `observe-bookshelf-report` narrator［staging］：书架上摆着翻旧的 JavaScript 书。有本借出去又被人放回来的，书脊都弯了。（游戏里的观察，不代表当时的书架。）
- `observe-plant-report` narrator［staging］：窗边的绿植长得挺精神，谁空下来就顺手浇一点水。（游戏里的观察，不代表当时的样子。）
- `observe-mug-report` narrator［staging］：CTO 桌上的保温杯，贴着张旧贴纸，边角都翘起来了。（游戏里的观察，不代表当时的摆设。）

**incident**

- `incident-n1` narrator［fact_paraphrase］：登录框打不开，按钮点了也没反应。
- `incident-player-1` player［staging］：（……）
- `incident-n2` narrator［staging］：我在椅子边上站了一会儿，脑子里空空的。
- `incident-cto-1` cto［staging］：都过来，一起看看。别急，先弄清楚发生了什么。
- `incident-n3` narrator［staging］：CTO 招呼几位同事过来。

**investigation**

- `investigation-n1` narrator［fact_paraphrase］：CTO 带着大家在排查。根因当时我们也没立刻弄明白。
- `investigation-n2` narrator［staging］：桌上有本笔记本。先把能确认的事理清楚。
- `investigation-cto-prompt` cto［staging］：你那边也一起看看，我们本来就一起干这件事。
- `investigation-confirm-1` player［staging］（仅当 cto_informed、feedback_reviewed、incident_seen、report_read 成立时）：（用户反馈看过了，情况记下来。）
- `investigation-confirm-2` player［staging］（仅当 cto_informed、impact_confirmed、incident_seen、report_read 成立时）：（影响也确认了，不止一个人。）
- `investigation-confirm-3` player［staging］（仅当 cto_informed、incident_seen、recheck_visited、report_read 成立时）：（登录页我又去看了一遍，还是老样子。）
- `investigation-not-yet` narrator［staging］：笔记本上还没打满勾，先把自己能确认的确认完。
- `investigation-cto-3` cto［staging］：先到这里。你去旁边缓缓，这边还有大家。
- `observe-bookshelf-investigation` narrator［staging］：书架上摆着翻旧的 JavaScript 书。有本借出去又被人放回来的，书脊都弯了。（游戏里的观察，不代表当时的书架。）
- `observe-plant-investigation` narrator［staging］：窗边的绿植长得挺精神，谁空下来就顺手浇一点水。（游戏里的观察，不代表当时的样子。）
- `observe-mug-investigation` narrator［staging］：CTO 桌上的保温杯，贴着张旧贴纸，边角都翘起来了。（游戏里的观察，不代表当时的摆设。）
- `investigation-short` cto［staging］（仅当 cto_informed、incident_seen、report_read 成立时）：这件事我们一直一起盯着，别一个人钻进去。

**restored**

- `restored-n1` narrator［fact_paraphrase］：又忙了一阵，登录故障前后大概两个小时。
- `restored-cto-1` cto［staging］：好了，没事了，别太自责。
- `restored-colleague-1` colleague［staging］：没关系，大家都经历过。
- `restored-n3` narrator［fact_paraphrase］：CTO、老板、同事都来宽慰过我，大意是这样；当时原话我记不清了。
- `restored-player-1` player［staging］：（我点点头。）
- `restored-n4` narrator［staging］：我把这次的事记了一页，留给 CTO 和同事，请他们有空看看。

**learning**

- `learning-n1` narrator［fact_paraphrase］：事后我们补了测试，也补了注释，说清楚这里为什么会踩坑。
- `learning-n2` narrator［staging］：桌上多了一张便签，代码旁边多了一行注释。都看完，再写下来。
- `learning-cto-1` cto［staging］：你有空也看看这两处，以后心里有数。
- `learning-player-1` player［staging］：（两点我都过一遍，再写下来。）
- `learning-test-first` narrator［staging］：便签上是这次补测的清单，写得简单。
- `learning-test-copy` narrator［staging］（仅当 comfort_read、cto_informed、feedback_reviewed、impact_confirmed、incident_seen、outage_over、recheck_visited、report_read、test_reviewed 成立时）：清单又看了一遍。以后别让要用的路径自己溜走。
- `learning-comment-first` narrator［staging］：注释只有短短几句，说这里为什么会踩坑、以后改的人要留意什么。
- `learning-comment-copy` narrator［staging］（仅当 comfort_read、comment_reviewed、cto_informed、feedback_reviewed、impact_confirmed、incident_seen、outage_over、recheck_visited、report_read 成立时）：注释又看了一遍。这个坑，以后还得自己留心。
- `learning-pending` narrator［staging］（仅当 comfort_read、cto_informed、feedback_reviewed、impact_confirmed、incident_seen、outage_over、recheck_visited、report_read 成立时）：测试和注释还有没看的，先看完。
- `learning-manual-1` narrator［staging］：手册翻到新的一页。上面写着：上线要负责；出了事，大家会一起扛。
- `observe-bookshelf-learning` narrator［staging］：书架上摆着翻旧的 JavaScript 书。有本借出去又被人放回来的，书脊都弯了。（游戏里的观察，不代表当时的书架。）
- `observe-plant-learning` narrator［staging］：窗边的绿植长得挺精神，谁空下来就顺手浇一点水。（游戏里的观察，不代表当时的样子。）
- `observe-mug-learning` narrator［staging］：CTO 桌上的保温杯，贴着张旧贴纸，边角都翘起来了。（游戏里的观察，不代表当时的摆设。）

**complete**

- `complete-n1` narrator［staging］：这页手册，往后会一直带着。
- `complete-n2` narrator［staging］：（南京深夜里读书的章节在后面。本章到此结束。）

## 六、地图观察与可选探索

主线对象用朱砂色小提示，可选观察物用石灰灰（#77746e）轮廓，文字前有“看看”字样，二者样式不同；观察不进任务、不写标记、任何可走动状态都可看。至少两个可选观察物：

- `bookshelf`（可选观察）：书架上翻旧的书，一句环境旁白。本章 8 个对象中 3 个为可选观察。
- `warm_guy_plant`（可选观察）：窗边绿植，谁空下来浇点水。
- `coffee_mug`（可选观察）：CTO 的保温杯，旧贴纸翘边。

可选观察对白 ID 以 `observe-<对象>-<状态>` 命名（如 `observe-mug-investigation`），内容相同；不指向事故原因、不补充未确认的历史。

## 七、键盘、触屏与界面

- 键盘：WASD／方向键移动（斜走归一化，不加速），E 或空格交互／推进对话，Esc 暂停，Tab 在对话框选项间移动，Enter 确认；只有焦点在游戏区域时接管方向键。
- 触屏：虚拟方向键（8 向）与一个 A 按钮，热区 ≥44 CSS px；点击高亮的对象提示也能交互。按钮避开当前交互目标，不遮人物。横竖屏切换不丢状态。
- 对话、论坛、笔记本、手册都用 DOM（HTML/CSS 系统字体），可被读屏读取；状态文字不依赖颜色。
- 焦点：打开面板后焦点进入面板，关闭后回到游戏区域；不困住 Tab。
- 声音默认关闭，由暂停菜单或开始页的“声音”按钮主动开启。

## 八、暂停、跳过、刷新与重玩

- 对话期间锁定移动，打断移动输入；关闭对话后恢复。切后台、失焦即暂停并清空按键，返回时不补跑时间。
- 跳过只压缩当前句／当前段表达（逐句立即显示、跳过 1.5 秒演示），结果事件与标记照常写入，不会连带到下一段。
- 刷新或重进：回到最近检查点（investigation／restored／learning／complete 的起点），已完成标记保留，已看过的短对话可以重播一遍但不重复加标记，不会跳到不存在的阶段。
- 存档格式：`career-rpg:nanjing:v1`，只存 `{chapter, state, flags[], checkpoint, skipsUsed}`，不序列化 Three.js 对象；写入时机为检查点与标记变化。损坏、旧版本或存储不可用时显示“重新开始／本次继续（不保存）”，不白屏，也不读写其他站点的数据。
- 重玩只清除本章命名空间下的数据并回到 office；complete 可直接选“从办公室重玩”，需二次确认。

## 九、素材与声音（详见美术规格）

本章资产 ID 与 JSON `assets` 一一对应：角色 `player-walk`、`npc-cto`；物件 `obj-forum-pc`、`obj-test-notes`、`obj-trap-note`、`obj-cto-pc`、`obj-bookshelf`、`obj-manual-shelf`、`obj-plant`、`obj-mug`；地砖 `tile-floor-wood`、`tile-rug`、`tile-wall`、`tile-window`、`tile-outage-dim`；UI `ui-dialog-box`、`ui-forum-panel`、`ui-notebook`、`ui-manual-page`、`ui-hud-task`、`ui-choice-button`、`ui-mobile-controls`、`ui-pause-menu`。

声音只有时长（`durationMs`）与是否循环，没有像素尺寸：

- `audio-ui-click`：60 ms，确认音，木质短点击。
- `audio-ui-move`：40 ms，光标移动音。
- `audio-notebook-tick`：120 ms，勾选音。
- `audio-manual-page`：300 ms，手册翻页声。
- `audio-open-forum`：220 ms，打开论坛面板的轻响。
- `audio-step`：150 ms，一步脚步，木地板与地毯各一版，由实现时选用。
- `audio-transition-dim`：400 ms，两小时转场压暗时的一声低音，不持续。
- `audio-ambient-office`：1500 ms，循环，办公室环境底噪（键盘、椅轮），循环播放。用户开启声音后才播放。

## 十、制作步骤

1. 先用 16px 地砖、16×24 站立帧和 CTO 站位搭静态办公室，确认走道与交互点可辨认，对照 `art/` 概念板方向（概念板不代表生产素材）。
2. 实现纯剧情模块：状态、事件 ID、标记（幂等）、检查点存档；用本 JSON 作数据源，先测状态机。
3. 接入简单引擎：固定步长、碰撞（只认 `blockedTiles`）、交互点检测、对话锁定；演员不碰撞。
4. 完成 DOM 面板（论坛、笔记本、手册、暂停）与键盘、触屏输入；声音默认关闭。
5. 制作四向行走图与全部物件，按锚点拼图集；补齐两小时转场离散压暗。
6. 逐项跑验收方案 PLAY、STORY、叙事核对，录制完整样章与异常恢复片段。

## 十一、风险

- 真实根因缺失：调查段过于抽象会像空转，过具体又像编造。当前靠“确认我去看了”维持玩家参与，需试玩判断是否足够；不把任何按钮描述成修复。
- 站位与交互重叠：CTO 站在 [16,6] 时紧邻 cto_pc 交互点 [15,6]，实现时需保证两者叠放顺序与交互目标不混淆，必要时把 CTO 展示位置挪到 [16,7] 的地毯格（同样不挡路）。
- 触屏小屏字多：论坛、手册面板可能与方向键争空间，需在 375px 宽度实测再定字号。
- 存档与刷新：短对话重播与标记幂等需要实现测试覆盖，否则可能重复加标记或卡在 complete 之前。
- 文案语气：宽慰段落容易被写成说教，试玩时请作者确认是否符合本人感受。

## 十二、Agent 先验与作者后验

Agent 先验（本轮已做）：运行 `python3 games/career-rpg/scripts/check-design.py`，结构检查通过（输出 17 个可达剧情配置、375 个可达地图格；这既不是游戏测试，也不代表美术已被接受）；史实逐条对照事实表；三份文件由同一脚本生成；地图可达与未知根因边界自查。Agent 先验不代表游戏可玩。

Agent 后续必须验证：浏览器中走动与碰撞、完整剧情、暂停与存档恢复、手机适配、素材加载与性能预算；未做之前这些项一律标为“未验证”。

作者后验：美术方向是否喜欢；宽慰段落是否像自己的经历与语气；是否接受“调查只确认、恢复靠转场”的处理；探索节奏是否舒服；是否进入下一阶段。作者反馈以本人说法为准，不把沉默当认可。

