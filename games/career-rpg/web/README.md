# 南京办公室 · 桌面开发入口

当前方案见[technical-plan.md](../technical-plan.md)。保留现有Three.js二维贴图实现和本地浏览器预览，人物/表情采用image_gen，程序负责环境素材和压缩运行版。H5发布、移动端、触控、弱网及博客上线暂不实施，原生桌面包未选型。下文Web历史验收和手机计划按其原阶段理解；loop、TraeX后台任务和走路卡顿排查保持暂停，缺失人物素材准备是另行授权的单次工作。

> 2026-11-05：南京键盘缺口已小修，桌面Chrome定点16项自验通过，待监督者独立复验。原快捷键与头部气泡保留；走路卡顿性能排查继续暂停，最新坐姿／气泡完整视觉和真机等仍待验。唯一工作目录为 `/Users/bytedance/work/AI/zwhu.github.io`。

从仓库根目录启动：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8765/games/career-rpg/web/`。点击场景后，用方向键或 WASD 移动；靠近两台电脑，按 E 或 Enter 阅读对话。同一工位有多个对象时，按 Q 切换；M 打开手册，Tab / Shift+Tab 在选项间切换，Enter / Space 确认，Esc 关闭可关闭的气泡。Esc 或右上按钮暂停，窗口失焦时暂停并清空按键；点击继续恢复。

桌面 Web 原型已获作者验收。当前在同一间办公室扩展南京完整样章：论坛反馈、第一次呆住、CTO带领排查、两小时后恢复、团队宽慰、补测试与注释、手册归档。角色支持四向行走，CTO和两位同伴在场工作并可交互。场景和外观为设定，剧情据作者回忆改写，不虚构事故根因。

## 文件与维护

- `scene-config.mjs`：背景、碰撞、actor/NPC、对象、任务事件、情绪、座位、剧情入口和发言者映射。后续场景替换配置和素材，复用相同机制。当前五桌背景384×216，手工碰撞据该图对齐，不照搬旧设计地图。
- `world.mjs`：脚底碰撞、移动和附近对象；`actors.mjs`：四向/打字帧、逐格alpha包围、气泡投影与边界避让。
- `main.mjs`：Three.js 正交渲染、素材加载、固定步长更新和 DOM 输入状态。角色按 alpha >128 读取包围盒，再设置纹理 UV；不修改原始图片。站姿角色逻辑高42～44像素，坐姿按实图校准为40像素，位置指脚底。普通剧情气泡锚定发言者头部，旁白锚主角；暂停/存档异常/重玩确认才使用模态框。
- `style.css` / `index.html`：中文对话和暂停菜单。用系统字体独立呈现，不烘焙入画面。
- `art/`：Codex 生成的 Web 原型素材。此处并非严格网格生产图集。
- `vendor/`：本地 Three.js 0.180.0，仅保留 `three.module.min.js`、其依赖 `three.core.min.js` 和 MIT `LICENSE`。对应[官方 r180 发布源码](https://github.com/mrdoob/three.js/tree/r180/build)；浏览器不请求 CDN。由主 Agent 下载，固定版本随原型维护，不自动更新。

检查：`python3 scripts/verify.py`，已包含移动与剧情/存档的离线规则测试。只复验规则时可以执行 `node --test games/career-rpg/web/tests/world.test.mjs games/career-rpg/web/tests/story.test.mjs`。

## 剧情与存档

`story.mjs` 是无DOM/Three依赖的纯规则模块，复用 `../design/chapter-01.json` 的转移和15种合法快照。每个接受的确认事件将 `{schema,chapter,state,flags}` 作为一个JSON值写入 `career-rpg:nanjing:v1`；关闭、只读回看和重复确认不写进度。刷新恢复同一合法配置和对应场景入口，不保存Three对象或瞬时按键。

损坏/未知版本的存档不会被静默覆盖：可以明确重新开始，或保留它、只在本次继续。存储写入失败可重试或继续但明确提示未保存。重玩只替换本章键，不清空localStorage。

本Web房间沿用已验收布局，与早期24×16设计图的物件位置不同。运行映射为：论坛→上左电脑（82,127），排查记录/测试/注释→上中电脑（185,127），CTO带领/排查结束→CTO角色（同一工位可按Q切换），手册→右书架（344,86）。旧地图结构检查不能代替本运行时交互验收。

排查必须重读左侧反馈、看中间电脑的排查记录并确认影响范围；影响范围以排查记录为前置。测试和注释可任意顺序，但两项都确认后才能写手册。完整章时长目标2～3分钟，浏览器脚本不会模拟真实阅读时长；无两小时等待。

桌面浏览器验收脚本为 `node games/career-rpg/web/tests/browser.mjs`，使用本机 Chrome，以1280×900桌面视口执行移动、桌子碰撞、对话与暂停检查，并将截图和结果保存到 `review/`。脚本需要 HTTP 服务以及本机 Chrome 启动权限；失焦检查针对 blur 事件处理，不冒充真机或其他端验收。

素材或依赖缺失会显示可读错误，不用空白画面冒充成功。需要 HTTP 服务，不能用 `file://` 打开。未接入 `docs/`，未向博客发布。

移动端、触控、真机性能和其他端验收在 Web 跑通后执行，本轮不声称通过。

## 共用角色与任务表现

`actors`支持站姿四向、行走帧、`posture: seatedTyping`、坐姿座位与独立交互点；NPC发言时暂停打字，位置不跳出工位。主角查看电脑期间采用坐姿演出，逻辑脚底留在可达交互点，关闭气泡后恢复站姿。

黄色感叹号按尚未接受的语义事件生成；仅打开或靠近不消失，接受事件后移除对应标记，恢复和重玩重新计算。紧张/开心由剧情状态驱动，使用真实头像图显示在气泡与主角头边。NPC头像从自己的素材取头部，不误用主角头像。

图集接口：player-walk-v1为3×4（down/up/left/right，每行idle/stepA/stepB）；npc-team-v1为3×1（CTO/绿衣/米色）；player-emotions-v1为3×1（normal/tense/happy）；typing-team-v1为4×2（player/CTO/绿衣/米色，A/B两行）。运行时只读取每格alpha包围，不改源图。

所有核心玩法以仅键盘可完成为标准，键盘专项命令：`node games/career-rpg/web/tests/browser.mjs --keyboard-only`。此模式用原生Tab/ShiftTab及Enter/Space执行选择，不调用按钮click；`--features-only`检查四向行走、NPC、气泡、坐姿、表情和任务标记。实际结论见review对应JSON，未执行的项不视为通过。


键盘缺口定点检查：`node games/career-rpg/web/tests/browser.mjs --keyboard-acceptance --evidence=final`。该模式自建只绑定127.0.0.1的目标子项目服务，隔离Chrome，不重跑整章/性能；证据写入 `web/review/keyboard-acceptance/`。选项方向导航按实际行列，Enter/Space确认，Esc返回；必选剧情/存档可Esc暂停再继续回原选项。既有Tab/ShiftTab、E/Q/M保留。运行时需本机Chrome启动权限；其他设备与作者验收不能据此宣称通过。


连续新开局补证：`node games/career-rpg/web/tests/browser.mjs --keyboard-journey`。该模式只执行一次新profile到complete，不reload、不种检查点、不跑第二学习顺序或故障测试；由当前工作区隔离服务提供页面。逐步状态/可信按键、保存审计和沿途五图写入 `web/review/keyboard-journey/`。这与分段keyboard-acceptance独立，不代表真人/真机、性能或整个场景通过。
