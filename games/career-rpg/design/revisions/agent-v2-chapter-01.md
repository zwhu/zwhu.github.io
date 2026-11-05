# 南京：第一次上线

对象：`nanjing-first-release`，“一路写来”的首个可玩样章。人生时间线仍从合肥开始，本章只做南京。数据版为 [chapter-01.json](./chapter-01.json)，美术规格见 [chapter-01-art.md](./chapter-01-art.md)。状态：设计草案，尚未实现。2～3 分钟是按各状态预算推算的**预期**，不是实测。概念板 `art/nanjing-art-direction-v1.png` 既未获作者认可，也不是生产素材。

## 一、目标、节奏与事实顺序

玩家扮演当年的作者，经历一节三分钟左右的小章：打开论坛，看到用户说无法登录；我第一次面对真实的线上 C 端用户，**呆住**；CTO 带大家一起排查；两小时后恢复；CTO、老板、同事安慰我；我们补测试、补注释；最后把这一页写进游戏里的工作手册。章节想说的是：上线要负责任，也需要被团队接住。没有考试、失败与分数，也没有需要猜的技术谜题。事故根因不在已知事实里，排查段只做玩家能确认的动作，恢复靠叙事转场交代，不把任何点击说成修好了真实故障。

事件的先后顺序固定为：论坛反馈 → 呆住 → CTO 带大家排查 → 两小时 → 宽慰 → 补测试与注释 → 手册。中途不插入跑腿找 CTO 的步骤，也不插入剧情瞬移。

| 状态 | 标题 | 预算 | 检查点 | 离开条件（数据里的转移） |
| --- | --- | --- | --- | --- |
| office | 办公室 | 25s | 否 | `open_forum_post`→report |
| report | 回工位 | 15s | 否 | `read_feedback`→incident |
| incident | 呆住 | 25s | 否 | `cto_rallies_team`→investigation |
| investigation | 一起排查 | 40s | 是 | `resume_narrative`→restored |
| restored | 两小时后 | 20s | 是 | `comfort_read`→learning |
| learning | 补测试与注释 | 35s | 是 | `write_manual_entry`→complete |
| complete | 手册新增一页 | 10s | 是 | — |

合计 170 秒，落在 120～180 秒的 2～3 分钟预期内。各状态预算含阅读与操作时间差，需真人试玩校正。

## 二、事实、演出与缺失

| 内容 | 依据 |
| --- | --- |
| 用户在论坛反馈无法登录；作者第一反应是呆住；登录框故障整整两小时；CTO 带大家排查；事后 CTO、老板、同事安慰；补测试、注释说明为什么有坑 | 作者提供的事实，`fact_paraphrase` 转述，不作逐字记录 |
| “没关系，大家都经历过” | 作者提供的安慰大意，旁白以 `fact_paraphrase` 转述；CTO、同事逐字台词是 `staging` 演出草稿 |
| 办公室布局、人物站位与朝向、论坛面板、笔记本、工作手册、各项按钮 | `staging`，游戏演出与界面，不是确认的历史；手册是否在真实工作中存在未知 |

不写的边界记录在 JSON 的 `blockedHistoricalDetails` 里：
- 事故根因、具体报错、代码和完整修复过程
- 排查中每个人具体做了什么（谁看日志、谁检查部署、谁负责哪部分服务）
- 具体技术分工、换浏览器、改密码、群消息是否持续、先吃饭、哪条路径漏测是不是根因
- 老板原话、同事姓名外貌与逐字安慰措辞（旁白按作者回忆转述，CTO、同事的台词是演出草稿）
- 事故与随后深夜学习是否存在直接因果
- 准确年份与日期
- 工作手册是否在真实工作中存在（本章手册为游戏机制）

因此，本章不安排换浏览器、改密码、查群聊、先吃饭、技术分工或“某条路径漏测所以出了事”的情节；故障示意也不表现“按钮点了没反应”这类未被事实确认的现象，只表示页面交不出结果。对白中没有真实报错、日志、用户名和日期。

## 三、地图与坐标

24×16 格，地砖 16×16 px，原点左上 (0,0)，x 向右、y 向下，单位是整格。出生点 [3,14]，在门口。**办公室的内墙与窗画在地图矩形之外**：上墙在第 -1 行，窗在上墙的 x=5～8；左墙在第 -1 列。0～23 列、0～15 行的每一格都是可走地板、地毯或家具占格，画中的墙永远不会和角色所在格重叠，地图矩形边界本身阻挡移动。

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

A 我的工位电脑 [9,3] · B CTO 工位电脑 [15,3] · C 补测便签 [13,3] · D 坑点注释 [11,3] · E/e 书架 [19,3][20,3] · F 手册书架 [21,3] · G 窗边绿植 [3,12] · H 保温杯 [6,12] · + 交互点 · @ 出生点 [3,14] · T CTO 站位 [16,2] · `.` 地板 · `,` 地毯。地图矩形之外不画墙：上墙与窗在第 -1 行（窗 x=5～8），左墙在第 -1 列。

| 对象 ID | 资产 ID | 用途 | 本体格 | 交互点 | 地面占格 footprint | 必选 |
| --- | --- | --- | --- | --- | --- | --- |
| forum_pc | `obj-forum-pc` | 我的工位电脑 | [9,3] | [9,4] | [9,3] | 是 |
| trap_note | `obj-trap-note` | 坑点注释 | [11,3] | [11,4] | [11,3] | 是 |
| test_notes | `obj-test-notes` | 补测便签 | [13,3] | [13,4] | [13,3] | 是 |
| cto_pc | `obj-cto-pc` | CTO 工位电脑 | [15,3] | [15,4] | [15,3] | 是 |
| manual_shelf | `obj-manual-shelf` | 手册书架 | [21,3] | [21,4] | [21,3] | 是 |
| bookshelf | `obj-bookshelf` | 书架 | [19,3] | [19,4] | [19,3] [20,3] | 否（可选观察） |
| warm_guy_plant | `obj-plant` | 窗边绿植 | [3,12] | [3,13] | [3,12] | 否（可选观察） |
| coffee_mug | `obj-mug` | CTO 的保温杯 | [6,12] | [6,13] | [6,12] | 否（可选观察） |

`blockedTiles` 共 9 格，全部来自上面的 footprint，每个格子只属于一个对象，没有额外的装饰障碍。每个交互点离本体 1 格，不在任何 footprint 内；从出生点沿空走道可走到全部 8 个交互点。CTO 整章站在 [16,2]，不移动、不占碰撞格，不在交互点旁。

## 四、按状态的分镜、操作与结束条件

### office：办公室（约 25 秒，不单独存档）

- 目标：从门口走到自己的工位电脑，打开论坛，看清用户不能登录的反馈。
- 玩家操作：走到 forum_pc 南侧 [9,4]，按 E／空格（手机点 A 按钮），读帖后点“确认，去处理”。路上可顺手看书架、绿植、保温杯。
- 结束与反馈：在 forum_pc 点“确认，去处理”，触发 open_forum_post。论坛面板出现，高亮“无法登录”；确认后进入 report。
- 重复与刷新：论坛已读后再交互显示 office-reopen，不改变状态，不重复写 report_read。
- 进入所需标记：无（初始状态）

### report：回工位（约 15 秒，不单独存档）

- 目标：回到自己的电脑前，意识到线上真的出了问题：这是我第一次面对真实的线上 C 端用户。
- 玩家操作：进入 report 即在我的工位前播放一段我的反应（旁白与内心独白，移动锁定），读完点“继续”解锁移动。
- 结束与反馈：反应读完点“继续”（事件 read_feedback）后进入 incident，没有需要跑腿找 CTO 的步骤。任务条改为“先稳住”。我的位置不因剧情改变。
- 重复与刷新：这段反应每次回到 report 都播放；同一点击不会连带触发下一条事件。刷新回到 office 检查点，论坛已读时再交互只显示 office-reopen，不重复写 report_read。
- 进入所需标记：`report_read`

### incident：呆住（约 25 秒，不单独存档）

- 目标：让“呆住”先发生：我先看着登录页，做不出反应。
- 玩家操作：进入 incident 时玩家仍在 [9,4]，停在我工位电脑前。约 1.5 秒里移动锁定、镜头停在登录示意上，我保持站立，这一幕表现“呆住”（按跳过键立即显示 incident-freeze）。随后 CTO 开口，镜头回到玩家身边；走到 cto_pc [15,4] 交互并读完对话。
- 结束与反馈：cto_pc 对话读完并点“一起过去”（事件 cto_rallies_team），进入 investigation。登录示意明示“示意，非技术复现”，只表现页面交不出结果，不显示真实报错或日志；CTO 在自己工位起身招呼大家，换朝下图示，不出现走路动画。之后可自由走动。
- 重复与刷新：演示与对话在 incident 只播一次；跳过键只压缩表达，事件照常写入。
- 进入所需标记：`report_read`、`incident_started`

### investigation：一起排查（约 40 秒，稳定检查点）

- 目标：在 CTO 带领大家排查时，做我能确认的事：看反馈、确认影响、复查登录页。不猜根因。
- 玩家操作：走到 cto_pc [15,4] 交互，笔记本上有三项确认，任选顺序，各自点一次“确认我去看了：……”；每确认一项要点“记下来”对话框才会关闭。三项齐全后回到 cto_pc 交互，才出现“这轮排查先到这里”。
- 结束与反馈：三项标记齐全后，与 cto_pc 交互并按“这轮排查先到这里”（事件 resume_narrative），进入 restored。笔记本勾选依次亮起，任务条显示“排查 0/3→3/3”；继续按钮只在 3/3 出现。转场把时间推进整整两小时，玩家不需要真实等待。
- 重复与刷新：已确认的项再点不再计入，也不重复写标记（investigation-short）；三项之间无先后顺序。
- 进入所需标记：`report_read`、`incident_started`、`incident_seen`

### restored：两小时后（约 20 秒，稳定检查点）

- 目标：接受“两小时后、问题恢复”的叙事转场，读 CTO、老板、同事的宽慰。
- 玩家操作：转场中不移动；点“继续”或按跳过键逐句出示旁白与宽慰。点“收起”才算读完宽慰，这个点击只做这一件事。
- 结束与反馈：点“收起”（事件 comfort_read），进入 learning。画面用离散色阶降暗显示“两小时后”，然后用 2～3 句交代问题恢复；对白标明事实转述与演出。
- 重复与刷新：每次回到 restored 都会重新显示宽慰；每句都要单独确认，点“收起”一次只做一件事。带着 comfort_read 重载存档时直接回到 learning 起点，不重播转场。
- 进入所需标记：`report_read`、`incident_started`、`incident_seen`、`feedback_reviewed`、`impact_confirmed`、`recheck_visited`、`outage_over`

### learning：补测试与注释（约 35 秒，稳定检查点）

- 目标：亲眼看补测试和坑点注释，再把经验写进工作手册。
- 玩家操作：test_notes [13,4] 交互并点“确认看过测试计划”；trap_note [11,4] 交互并点“确认看过注释”（两者顺序任意、可来回）；两项齐全后到 manual_shelf [21,4] 交互并点“把这页写进手册”。未齐时手册书架只显示 learning-pending。
- 结束与反馈：test_reviewed 与 comment_reviewed 都写入后，在 manual_shelf 点“把这页写进手册”（事件 write_manual_entry，requires 同时包含两个标记），进入 complete。任务条“看过 0/2→2/2”；手册打开新页（learning-manual-1），状态进入 complete。
- 重复与刷新：review_test_plan／review_trap_comment 只有第一次交互写入标记，再次交互只显示 learning-test-copy／learning-comment-copy，不加标记、不倒退。
- 进入所需标记：`report_read`、`incident_started`、`incident_seen`、`feedback_reviewed`、`impact_confirmed`、`recheck_visited`、`outage_over`、`comfort_read`

### complete：手册新增一页（约 10 秒，稳定检查点）

- 目标：翻看本章手册页，结束或重玩。
- 玩家操作：读手册页；之后仍可走动和观察。选“结束本章”（收起手册，显示章节完成摘要）或“从办公室重玩”（弹层再确认一次）。
- 结束与反馈：章节结束，本身已是终态。重玩是另一个入口，不是状态转移。显示“第一章完成”、本章事实与演出说明、回博客链接与重玩入口。
- 重复与刷新：重新载入存档直接停在 complete；重玩会先确认，只清除本游戏命名空间下的本章存档。
- 进入所需标记：`report_read`、`incident_started`、`incident_seen`、`feedback_reviewed`、`impact_confirmed`、`recheck_visited`、`outage_over`、`comfort_read`、`test_reviewed`、`comment_reviewed`、`manual_entry_written`

### 事件表

`requires` 只引用此前事件写下的标记；每个标记只由一个事件写入。事件的效果一律**并入**标记集合（并集），重触发不会删除已有标记；T09、T10 再次触发时 `effectMode` 为 `keep`，运行时只显示 `learning-test-copy`／`learning-comment-copy`，不改状态。`shownWhen` 是**显示条件**：对白只在所需标记齐全时出现，但不写标记。

| ID | 事件 | from → to | 交互目标 | 按钮 | requires | effects |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | `open_forum_post` | office → report | forum_pc | 确认，去处理 | — | report_read |
| T02 | `read_feedback` | report → incident | dialog | 继续 | report_read | incident_started |
| T03 | `cto_rallies_team` | incident → investigation | cto_pc | 一起过去 | report_read, incident_started | incident_seen |
| T04 | `confirm_feedback_reviewed` | investigation → investigation | cto_pc | 确认我去看了：一起看用户反馈 | report_read, incident_started, incident_seen | feedback_reviewed |
| T05 | `confirm_impact_scope` | investigation → investigation | cto_pc | 确认我去看了：确认影响 | report_read, incident_started, incident_seen | impact_confirmed |
| T06 | `confirm_recheck_visited` | investigation → investigation | cto_pc | 确认我去看了：一起复查登录页 | report_read, incident_started, incident_seen | recheck_visited |
| T07 | `resume_narrative` | investigation → restored | cto_pc | 这轮排查先到这里 | report_read, incident_started, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited | outage_over |
| T08 | `comfort_read` | restored → learning | dialog | 收起 | report_read, incident_started, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited, outage_over | comfort_read |
| T09 | `review_test_plan` | learning → learning | test_notes | 确认看过测试计划 | report_read, incident_started, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited, outage_over, comfort_read | test_reviewed |
| T10 | `review_trap_comment` | learning → learning | trap_note | 确认看过注释 | report_read, incident_started, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited, outage_over, comfort_read | comment_reviewed |
| T11 | `write_manual_entry` | learning → complete | manual_shelf | 把这页写进手册 | report_read, incident_started, incident_seen, feedback_reviewed, impact_confirmed, recheck_visited, outage_over, comfort_read, test_reviewed, comment_reviewed | manual_entry_written |

为什么能走通：T01 论坛→T02 回工位读完反应→T03 呆住后 CTO 招呼大家，呆住先于 CTO 介入；T04～T06 三项确认顺序任意，各写一个标记，T07 同时要求三项，进入 investigation 不会自动恢复；T09、T10 各写一次 `test_reviewed`、`comment_reviewed`，T11 同时要求两者，所以任何可达组合都能结束；T08 只在玩家点“收起”时触发。

## 五、关键对白

完整对白与显示条件以 JSON 的 `dialogues` 为准，这里只列关键句。`fact_paraphrase` 是事实转述，`staging` 是演出，都不是历史原话。


**office**

- `office-n3` narrator［fact_paraphrase］：帖子里，有用户说无法登录。这是我第一次面对真实的线上 C 端用户。

**report**

- `report-reaction` narrator［fact_paraphrase］：我回到自己的电脑前，论坛里的反馈还在眼前。这是我第一次面对真实的线上 C 端用户。

**incident**

- `incident-freeze` narrator［staging］：我盯着屏幕，一动没动。
- `incident-cto-1` cto［staging］：都过来，一起看看。别急，先弄清楚发生了什么。
- `incident-rally` narrator［staging］：CTO 带着大家一起排查。

**investigation**

- `investigation-handoff` cto［staging］：先到这里。你去旁边缓一缓，这边还有大家。

**restored**

- `restored-n1` narrator［fact_paraphrase］：画面转暗。两小时后，问题恢复了。
- `restored-cto-1` cto［staging］：好了，没事了，别太自责。
- `restored-colleague-1` colleague［staging］：没关系，大家都经历过。
- `restored-n3` narrator［fact_paraphrase］：CTO、老板、同事都安慰我，告诉我没关系，大家都经历过。

**learning**

- `learning-n1` narrator［fact_paraphrase］：后来，我们补了测试，也补了注释，说明这里为什么会踩坑。
- `learning-manual-1` narrator［staging］：手册翻到新的一页：“第一次上线，是真实用户先告诉我出了问题。补测试，写清楚坑；出了事，大家会一起扛。”

**complete**

- `complete-n1` narrator［staging］：本章到此结束。

可选观察的旁白按“对象×状态”各有一条（如 `observe-mug-learning`），内容相同，`staging`，不推进剧情。

## 六、可选探索

三个可选观察物件不写标记、不阻塞主线，任何可走动状态都能看：

- `bookshelf`：书架上摆着几本翻旧的书，其中一本夹着一张便签。（游戏里的布置，不是当年的书架。）
- `warm_guy_plant`：窗边有一盆绿植，叶子擦得很干净。（游戏里的布置。）
- `coffee_mug`：桌上放着一个保温杯，杯盖没拧紧。（游戏里的摆设。）

桌椅与交互点相邻，方向不同时可能选中旁边的物件：交互只认玩家面前一格内的交互点，一格里有多个时取离玩家最近的；站在交互点以外的格子上只能看到提示、不能触发。

主线提示是朱砂小箭头加“去看看”，可选观察是石灰圆点加“看看”，都不写进任务条。

## 七、键盘、触屏与界面

- 键盘：WASD／方向键移动，斜走不加速；E 或空格交互、推进对话；Esc 暂停；Tab 在选项间移动，Enter 确认。只有焦点在游戏区域时才接管方向键。
- 触屏：虚拟方向键加一个 A 按钮，每个热区至少 44 CSS px；点对象提示也能交互；按钮避开对话面板。
- 对话、论坛、笔记本、手册都用 DOM 与系统字体，可被读屏读取，状态不只靠颜色区分；打开面板后焦点进入面板，关闭后回到游戏区域。
- 声音默认关闭，由开始页或暂停菜单主动开启。

## 八、暂停、跳过、刷新与重玩

- 对话、论坛和转场期间锁定移动并清空按键；切后台或失焦即暂停，回来不补跑时间。
- 跳过只压缩当前表达：跳过呆住演示、立即显示当前句。事件、标记与转移照常写入，不会连带到下一段。
- 刷新与重进回到最近的稳定检查点：investigation、restored、learning、complete 的起点。已完成标记保留；短对话可以重播，但不重复写标记。
- 存档命名空间 `career-rpg:nanjing:v1`，只存章节、状态、标记与检查点，不序列化 Three.js 对象。损坏、旧版本或存储不可用时提供“重新开始／本次继续，不保存”，不白屏，不碰其他站点数据。
- 重玩只清除本章命名空间，回到 office，并在 complete 处二次确认。

## 九、素材与声音

资源 ID 与 JSON `assets` 一一对应，尺寸、占格与锚点见[美术规格](./chapter-01-art.md)。角色 `player-walk`、`npc-cto`；家具 `obj-forum-pc`、`obj-cto-pc`、`obj-test-notes`、`obj-trap-note`、`obj-bookshelf`、`obj-manual-shelf`、`obj-plant`、`obj-mug`；地砖 `tile-floor-wood`、`tile-rug`、`tile-wall`、`tile-window`、`tile-outage-dim`；界面 `ui-dialog-box`、`ui-forum-panel`、`ui-notebook`、`ui-manual-page`、`ui-hud-task`、`ui-choice-button`、`ui-mobile-controls`、`ui-pause-menu`。

声音只记录时长（`durationMs`）与是否循环，不设像素尺寸：确认 60 ms、光标 40 ms、勾选 120 ms、翻手册 300 ms、打开论坛 220 ms、一步 150 ms、转场低音 400 ms、环境底噪 1500 ms（循环）。

## 十、制作步骤

1. 用 16px 地砖、16×24 站立帧和 CTO 站位搭静态办公室，核对走道、交互点与地图外的墙窗。
2. 实现纯剧情模块：状态、事件、标记（幂等）、检查点存档；以本章 JSON 为数据源，先写状态机测试。
3. 接入简单引擎：固定步长、碰撞只认 blockedTiles、交互检测、对话锁定；演员不碰撞。
4. 完成 DOM 面板与键盘、触屏输入，声音默认关闭。
5. 制作行走图与家具，按锚点组装图集，补两小时转场的离散压暗。
6. 按验收方案跑 PLAY、STORY 与叙事核对，录完整样章与异常恢复片段。

## 十一、风险

- 桌椅与交互点排在同一行，靠近时可能遮盖提示；需要按锚点排序检查遮挡和小屏裁切。
- 排查段没有真实根因可演，容易显得空转；目前靠三项“确认我去看了”维持参与感，是否足够要试玩判断。
- 呆住演示只有 1.5 秒，过短会看不出停顿，过长又会拖慢节奏；实机调到“能感到停顿”即可。

- 手机小屏上论坛、手册和方向键争空间，字号与布局需在 375 px 宽度实测后再定。
- 宽慰段落容易被写成说教，试玩时请作者确认是否符合本人感受。

## 十二、Agent 先验与作者后验

本轮 Agent 只做了设计侧工作：三份文件由同一份数据生成，JSON 与正文中的坐标、事件、对白、资源 ID 共用同一来源；地图 ASCII 由同一份地图数据渲染；运行了结构检查与设计测试（结果以本轮执行输出为准）。这些检查不验证游戏是否可玩、画面、性能或史实是否逐条被作者认可。

后续必须实测：浏览器中走动与碰撞、完整剧情、暂停与存档恢复、手机真机触控、素材加载与性能；未做之前一律标为“未验证”。

作者后验：事实顺序与语气是否符合本人记忆；是否接受“排查只确认、恢复靠转场”的处理；探索与阅读节奏是否舒服；美术方向是否喜欢。作者反馈以本人说法为准，未回复不视为认可。

