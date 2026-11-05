# Web 原型交接

## 当前反馈优先级

步态已完成4槽/秒与固定方向尺寸/脚底，Chrome定点验证通过，证据review/walk-cadence-check.json及walk-sample截图序列；键盘焦点专项仍待验。当前先完成任务!浮动醒目化与费翔🐘名称，再建立首移动cold/warm耗时基线。已读取diagnosing-bugs，未预先确定原因，不启动新场景。

## 2026-11-05 共享角色与交互升级：实现中

当前优先修复：用户反馈“小腿抖动”。纯键盘已走完章节/手册/两种学习顺序/暂停，仍未完成异常失焦后的焦点寻址专项，故全键盘继续标待验。暂不继续键盘或新场景工作。步态根因：7Hz直接A/B切换、每帧alpha包围独立拉伸，以及高刷新率渲染帧间没有物理tick时moving被重置。计划固定方向参考尺寸与脚底，采用idle/A/idle/B四槽每秒（2步/秒），跨tick保持移动，松键立即站立；不改图片、不改移动速度。下一步针对性逻辑与Chrome移动截图序列。

当前恢复点：全部美术已接入五工位背景，新增表现9项实际桌面检查通过（review/shared-features-checks.json）；完整章14项回归和根verify13组也通过。已保存工作场景、四向走动、CTO气泡、主角坐姿、紧张/开心专项截图。坐姿首次34像素手偏低，已按键盘位置调整为40，脚底不变；需重取表现截图复核。当前无审批等待，无新场景工作。

用户追加“所有核心操作仅键盘完成”：记录为待实际专项验收，不能用原移动测试替代。需覆盖Q切邻近对象、Tab/ShiftTab选项焦点、Enter/Space确认、Esc关闭以及手册/暂停/重玩/异常存档选择；正在把浏览器验收增加纯键盘运行模式。未走通前不标通过。

用户要求气泡、四向走路、CTO/伙伴、更多工位、未接任务黄色感叹号、紧张/开心表情，并追加坐电脑前打字。新增scene-config.mjs维护场景actors/objects/任务事件/情绪/入口，actors.mjs维护图集帧、两帧打字和气泡边界避让；main复用配置，不将新场景逐项硬编码。

已接：3×4四向走路接口、3×1NPC、3×1情绪头像、4×2坐姿打字接口；逐格alpha包围提取，不编辑源图。剧情显示改为人物脑门附近DOM气泡，旁白锚主角；存档/重玩与暂停保留常规modal。黄色!只按尚未接受事件显示；同一存档恢复和重玩重算。主角电脑对话坐姿仅演出，逻辑脚底留在可达交互点，关闭回站姿；NPC可配置坐姿，发言时停打字不跳位。

共享规则4项新测试通过，尚待全部新素材、准确背景碰撞/座位坐标及真实桌面回归。此时不得宣称视觉验收通过。下一步按主Agent提供的新办公室坐标对齐配置，再跑完整章及新增交互检查。

## 2026-11-05 南京完整样章：实现及桌面验收完成

最终审阅修订：主Agent发现恢复正文混入设计演出指令“画面压暗。”。已在story.mjs玩家文案接口移除该前缀，保留“整整两小时后，问题恢复了。”；设计阶段记录不改。核对其余对白未见同类镜头/转场/DOM指令。受影响剧情规则6项通过，`--restored-only`浏览器定点复验通过并重取review/chapter-restored.png，文本证据review/restored-copy-check.json。未重跑无变化的完整流程或全仓检查。

作者已验收桌面Web原型，作为后续基线。保留房间、美术和移动；新增story.mjs复用design/chapter-01.json转移与15种合法快照，不照搬旧地图。

步骤1已完成：7状态纯剧情、原子存档、无效存档保留与本次不保存、三对象运行映射。步骤2已接入：论坛/CTO电脑/书架交互、独立测试与注释项、只读回看、手册、完成与重玩。逻辑8项通过，覆盖两种学习顺序、重复前置、15配置恢复和损坏/禁用存储。

步骤3已完成：真实Chrome桌面1280×900/software WebGL完整流程14项通过。包括报告/排查/恢复/完成状态刷新保留、只读重复不保存、两种学习顺序、手册回看、重玩、损坏存档保留且本次可玩、明确重置只改本章键、旧版本提示、暂停和持键blur清除，无未捕获异常。证据：review/chapter-checks.json、chapter-office.png、chapter-restored.png、chapter-complete.png。blur为合成事件处理检查，阅读时长和性能未实测。

步骤4已完成：8项规则测试已登记到根verify，content/verification-guide.md新增检查清单，按源文件流程运行render-site同步docs/content副本（64页面无变化）。全仓verify13组通过，git diff --check通过。HTTP服务51993仍可访问，提权curl确认200。

当前无模型调用或浏览器任务。下一步由主Agent一次审图和史实核对，再给作者试玩完整章。样章沿用静态正面角色，无行走动画；未做移动端/其他端、真实阅读时长、性能或正式发布验收，不将这些写成通过。

## 2026-11-05 最终恢复点

桌面 Web 原型已实际运行并通过本阶段检查。访问 `http://127.0.0.1:8765/games/career-rpg/web/`，HTTP 服务 session51993 保持运行，已明确输出 Serving HTTP on127.0.0.1。重启命令（仓库根目录）：`python3 -u -m http.server 8765 --bind 127.0.0.1`；当前沙箱不允许监听，必须在已批准的本机权限下执行。此前session36173和51938已退出，不能再当成可访问服务。

初始化失败的真正原因是沙箱服务监听返回 PermissionError，浏览器到达 chrome-error://chromewebdata/、ERR_CONNECTION_REFUSED，不是依赖或Three初始化失败。已补启动失败截图/页面文本收集。历史失败证据在review/startup-error.json、desktop-startup-error.png，不代表当前状态。

浏览器中补修Escape显式状态处理，避免依赖dialog原生cancel。最终Chrome桌面1280×900/software WebGL实测通过9项：Three180和透明角色包围、真实键盘移动与近处提示、桌子碰撞、对话停止移动、关闭恢复、暂停恢复、持键触发blur后清键、右侧电脑Enter交互、无未捕获异常。失焦检查用合成blur事件验证处理逻辑，不冒充原生系统切换或其他端验证。

证据：review/desktop-office.png、desktop-dialogue.png、desktop-checks.json。逻辑测试3项通过；全仓verify12项通过；git diff --check通过。主Agent可直接审这两张图及一次实际浏览器试玩，不必重跑另一套自动化。

范围仍为单房间Web原型：静态正面角色、两处电脑回忆对白，无四向行走、完整章节、存档、移动端或性能达标结论。下一步作者在Web试玩并反馈，再扩展原型。不发布到博客。

2026-11-04。范围为桌面 Web 单房间，未发布到博客。

1. 已读取游戏规则、规格、Web 优先验收与站点视觉/验证说明。
2. 素材由主 Agent 提供：office-room.png、player-front.png；逻辑视口384×216，角色透明像素包围盒运行时读取。
3. Three.js 固定0.180.0已由主 Agent 下载就绪。vendor仅保留three.module.min.js、three.core.min.js和MIT LICENSE，README记录官方r180来源；非压缩副本清理，避免原型保留重复依赖。历史：子Agent下载因沙箱DNS失败和审批等待未成功，后由主Agent接管。
4. 已完成 index.html、style.css、main.mjs、world.mjs、README.md、tests/world.test.mjs 和 tests/browser.mjs。逻辑测试3项通过；全仓 verify 12项通过。碰撞、近处交互与对话、暂停/失焦清键均已编码。浏览器验收尚未通过，不能把逻辑检查说成可玩验收。
5. 历史服务session36173已退出，见顶部最新服务session51993。
6. 主Agent运行session35933发现页面无法启动后，委派本Agent定位并完成复验；最终通过记录见顶部，不再等待旧session。

下一步：给作者Web试玩。移动端和其他端后续执行，不作为本轮前置。代码只在web目录，未改根verify清单；逻辑测试需单独运行。

不扩展完整章状态、存档、移动端或其他端。
