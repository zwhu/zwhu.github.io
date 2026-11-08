# 2026-11-08 首批试玩修复结果

## 追加：重玩入口与重复回应修复

作者追加「重玩」按钮和面试对话重复反馈。已增加右上角重玩入口与 R 快捷键；取消保持原位置/对话，确认重新开始当前章节。选择「我不要工资，让我来试试就行」后直接进入老板答复，移除重复主角台词页；旧 UI 存档恢复时也进入老板答复，不提前确认录用事件。

运行代码 `0b336f8`；正式回归 16 场景、173 检查通过，包含四条完整路径、三章重玩、技能页返回和旧 UI 迁移；全仓 14 组及 46 个游戏离线测试通过。最新图文报告在仓库外 `/Users/bytedance/work/AI/game-reports/career-rpg/2026-11-08-direct-reply/delivery.md`，逐步截图见同目录 `report.md`。本节是最新结果，下方保留首批交付版本记录。

## 首批交付（运行版本 cbfba12）


带原图的交付文档与可筛选分支图库在仓库外：`/Users/bytedance/work/AI/game-reports/career-rpg/2026-11-08-final/delivery.md`、`/Users/bytedance/work/AI/game-reports/career-rpg/2026-11-08-final/delivery.html`。下方截图文件名均相对于该报告目录。
首批 14 条反馈已逐项修改，BUG-001～BUG-007 的修复及本地复验已完成。PR：[zwhu.github.io #48](https://github.com/zwhu/zwhu.github.io/pull/48)，分支 `test/career-rpg-playtest-regression`。运行代码版本 `cbfba12`，源码 hash 见各 `result.json`；后续提交仅补测试工具与交付文档。

本地试玩：[合肥办公室](http://127.0.0.1:53130/games/career-rpg/web/?chapter=hefei)。服务直接读取工作区当前代码；线上 Pages 仍从 main 发布。

## 14 条反馈逐项核对

表内结果均为本地复验通过；字号、按钮观感与经历表达供作者确认。`jQeury` 原话保留，实现统一写作 `jQuery`。

| 反馈 | 问题 | 原因 | 已修改 | 踩坑 / 预防 | 截图 |
| --- | --- | --- | --- | --- | --- |
| F01 | 开场关不掉 | 焦点依赖和 docked CSS 覆盖 hidden | 活跃界面处理 Enter，隐藏样式明确优先级 | BUG-002 / RULE-09、13 | `flow-linux-jquery-java-db-opening-close.png` |
| F02 | 开场补文案 | 原文只有录用者没来的前半句 | 补上「我鼓起勇气，毛遂自荐。」 | BUG-005 / RULE-12 | `opening-and-resume-copy.png` |
| F03 | 方向键选择、Enter 确认 | 键盘分支依赖按钮 DOM 焦点 | 对话接管输入，不误移角色，按住一次不跨页 | BUG-002 / RULE-09、13 | `flow-linux-jquery-java-db-boss-choice.png` |
| F04 | 对话字体过大 | 字号跟随画面宽度无限放大 | 正文 14～18px，名牌 15～20px，按钮 13～16px | BUG-003 / RULE-11 | `flow-linux-jquery-java-db-demand-entry.png` |
| F05 | 取消稍作停留，自动保存 | 暂停是模态流程，旧存档缺少游玩上下文 | localStorage 同键保存章节、位置、朝向、对话/选择、技能和转场；失焦自动接续 | BUG-004 / RULE-10、13 | `restore-dialogue-after.png` |
| F06 | 书柜多出电脑 | 卡片 icon 同时被画到世界 | 书架保留背景和学习闪点，卡片仅在交互时显示 | BUG-001 / RULE-01、04 | `flow-linux-jquery-java-db-day-world.png` |
| F07 | 改需求入口与两种选择 | 入口与接任务拆开确认 | 「开始今天的需求」＋「确定 / 继续探索办公室」 | BUG-006 / RULE-12 | `flow-linux-jquery-java-db-demand-entry.png` |
| F08 | 不需要第二次接任务 | 独立事件前置多一层确认 | 入口确定承接原事件；取消不改进度，无空框 | BUG-006 / RULE-12、13 | `flow-linux-jquery-java-db-demand-result.png` |
| F09 | 不要 Linux/Git 说明页 | 学习说明、确认、收集拆成多层 | 从自己的电脑直接获得 Linux 技能 | BUG-006 / RULE-12 | `flow-linux-jquery-java-db-linux-no-extra.png` |
| F10 | OK 无法操作，按钮统一 | 隐藏样式和输入入口不同 | 获得页统一「确定」及选中边框，Enter 收起 | BUG-002、003 / RULE-09、11 | `award-visual/flow-linux-jquery-java-db-linux-award-open.png` |
| F11 | 改为获得技能书 | 原提示使用经历说明 | 提示改为：获得技能书「锋利的 jQuery」；校正技术名拼写 | BUG-007 / RULE-12 | `flow-linux-jquery-java-db-jquery-book.png` |
| F12 | 其他技能页相同问题 | 共用对话路径的相同缺陷 | 四项技能页均使用同一确认与键盘行为 | BUG-002、003 / RULE-09、11 | `award-visual/flow-linux-jquery-java-db-db-award-open.png` |
| F13 | 使用自己的工位电脑 | 电脑卡片重复画成世界屏幕 | 保留工位热区，移除额外屏幕，保留卡片与闪点 | BUG-001 / RULE-01、04 | `flow-linux-jquery-java-db-day-world.png` |
| F14 | 夜间同样的电脑叠图 | 夜间 Java/数据库 icon 半透明叠加 | 两项学习在同一工位，不再叠屏；四种顺序可完成 | BUG-001 / RULE-01、04 | `flow-linux-jquery-java-db-night-world.png` |

## 检查与每条分支的截图

全仓 `python3 scripts/verify.py` 通过 14 组检查，游戏离线测试 46/46；发布副本 70 个文件与源文件一致。浏览器从隔离的全新 profile 开始，以真实键盘走主流程，不预置存档或脚本点击。焦点专项单独使用真实指针，失焦专项真实切换标签页。

| 附件 | 结果 | 范围 |
| --- | --- | --- |
| 合肥正式矩阵（`report.md`） | 11 个场景、128 个检查通过 | 每一步附状态、输入与截图 |
| 南京与杭州完整路径（`shared-final/report.md`） | 2 个场景、37 个检查通过 | 每一步附状态、输入与截图 |
| 合肥技能确认前后补充（`award-visual/report.md`） | 1 个场景、33 个检查通过 | 每一步附状态、输入与截图 |

合肥矩阵覆盖两位同事、面试前书架、老板对话、按住 Enter、需求取消/确认、Linux→jQuery 与 jQuery→Linux、Java→数据库与数据库→Java组成的四条完整路径、加薪、手册、刷新、取消重玩和确认重玩。南京走论坛→CTO→排查→学习→手册→旅程→章末；杭州走报到→学习→五张需求单→白板→五项技能→章末。

## 实际画面与交互核对

已审阅四种合肥路径的画面、需求菜单、开场、章末/手册与技能获得页，核对隐藏后没有残留对话；书架和工位没有额外道具叠图，学习闪点仍可见。杭州需求单、白板点亮和获得页，南京论坛/手册也已核对。

桌面 1280px、窄屏 375px 已预览。375px 另验证对话方向键不移动角色、真实指针关闭开场、移动、M 手册和 Enter 返回；这是桌面浏览器窄屏模拟。




## 后续遵循

问题现象、改前原因、修复和证据保存在仓库 `games/career-rpg/pitfalls.md`，预防动作在 `development-rules.md`，命令和分支矩阵在 `regression-guide.md`。后续改共用输入、存档和绘制时，重走受影响路径；检查 actual computed style、按键隔离、刷新后的新页面及世界绘制，不能只看 DOM 属性或配置。

批量截图与本报告放在仓库外；PR 只附 1280px、375px 两张要求的截图。作者复验反馈补回原编号，游戏 PR 等作者明确说「合」后合并。此前走路卡顿仍暂停排查，性能、录屏脚本和手机真机未在本批验收。
