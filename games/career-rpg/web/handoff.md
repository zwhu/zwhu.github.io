# 南京办公室 · Web交接

## 当前恢复点（2026-11-05）

先读[根handoff当前恢复点](../handoff.md)及[技术方案](../technical-plan.md)。用户本轮要求handoff，停止制作，不恢复loop或TraeX；卡顿排查继续暂停。当前桌面开发入口保留，H5/移动/弱网/上线暂不实施。

最新素材状态：7个新角色四向/表情设定已生成，未切帧或接入；12张程序背景v1被用户指出过于简化、没有区分度。仅宿舍、驿站和小区3张重画为[场景v2](../art/procedural-scenes-v2/index.html)，待用户评价，其余9张未重画。不要把图片数量写成场景完成；原南京保持不动。

接手唯一下一步：等用户评价v2；明确继续后，先把一个场景的空间和细节做到满意，再逐张推进。当前不执行旧冷启动候选测试、不改预算来签通过、不接新场景、不commit/push/发布。新素材、方案与样品均在97b5843之后的未提交改动中，勿清理。

以下为历史记录。

## 历史阶段：保留原图路线提案完成，停等评审

用户已选择“保留原图，评审4 MiB/6 MiB与40秒加载提案”，这是评审路线选择，尚未批准门槛变更。[具体提案](./review/resource-budget/original-art-proposal.md)及[独立短摘要](./review/resource-budget/original-art-proposal-summary.json)已落盘，不覆盖既有测量摘要；旧路线偏好待答/推荐仅为当时记录，以本段为准。

15项首玩资源与整章运行集合相同：静态gzip 3,864,937 B、原始5,191,167 B；分发包含MIT许可共16文件、5,192,248 B原始。提议4 MiB用于逐文件静态gzip、6 MiB用于含许可原始分发，不冒充HTTP上限。文本gzip/PNG identity的正文下界36.468552秒，40秒仅余3.531448秒；当前identity夹具正文下界41.529336秒。实际编码、依赖/解码与40秒均未实测，提案写清三轮冷缓存从导航到可信键盘实际移动的终点及等待/失败/重试/返回证据要求。

仅写文档，原PNG/加载路径/生产代码/现行规格未改，15项SHA256与manifest一致；main/HTML/CSS仍为00b8c0/35dee8/d63b62，完整hash见新摘要。本轮不执行启动/帧/CPU、浏览器或规则测试，不复跑根verify。文档资源表、算术、链接与JSON一致性检查通过，`git diff --check`通过。现行512 KiB/2 MiB/8秒不变，BUDGET-LOAD仍failed。最终额度、启动定义和长等待体验需作者明确批准，未制作样品；其他门禁不改。

生命周期[监督者复核](./review/lifecycle/supervisor-review.json)已接受正式20轮可观测记录，仅限该范围；完整JS/native/driver内存仍unverified，不重复测试。旧20轮是监督者限缩测试而中止，不是作者新增暂停要求。**走路卡顿未解决，用户要求暂停**，不重开排查。

worker=`ready_for_review`、stage=`original-art-proposal`，唯一下一步停等监督者/作者评审本提案；`scene_accepted=false`、`next_scene_authorized=false`，旧全旅程goal保持paused。不扩场景、不自动实施候选、不提交推送发布、不改调度；20分钟每次报告授权保留。

## 已完成的生命周期可观测记录


STORY-05独立审阅/定点执行已通过，引用其supervisor-review.json，仅限采样双实例/稳定恢复，不重跑。资源路线仍待原问题答复，素材/预算/等待标准及暂停卡顿均不动。

原生单周期观察链验证后，正式20轮真实键盘重玩+完整Page.reload全部完成，退出0；20次pagehide可信、persisted=false，snapshot/Runtime无异常。没有场景切换API，重玩复用场景，只有完整文档重载重建渲染资源；不模拟pagehide或提前dispose。

每轮基线/重玩/重入：4角色、9mesh、1场景/renderer/camera、几何/材质/纹理各9逻辑对象；连接监听器23、DOM2canvas/3标签/1marker/7按钮、待执行RAF1，计数稳定。pagehide后9几何/9材质/9纹理及1renderer释放事件，RAF0、renderer.info几何/纹理/程序0。5源图对象、13脚本canvas、1ResizeObserver是每文档稳定共享边界，不据此证明堆回收。

原生仍余4个回退纹理/3个framebuffer辅助句柄，文档离开后的driver隐式回收未证明；19连接监听器/ResizeObserver依赖浏览器文档清理。弱观察脱离DOM监听器0～3不判泄漏；完整堆、解码图像/canvas/driver内存、BFCache恢复和未来场景切换未验，LIFECYCLE仍unverified。没有证实生产持续增长，不为了凑通过重构或修改main。

[短摘要](./review/lifecycle/summary.json)、[正式逐轮计数](./review/lifecycle/series-final-counts.json)、[单周期事件链](./review/lifecycle/observer-chain-validation.json)、[所有权审计](./review/lifecycle/static-audit.json)与失败/中止尝试分开。binding返回但卸载CDP回调未达，原生快照由新测试profile独立sessionStorage保存后读取，未写剧情检查点或游戏存档。

命令：`node games/career-rpg/web/tests/browser.mjs --lifecycle --lifecycle-cycles=20 --evidence=series-final`；先验1周期用 `--lifecycle-cycles=1 --evidence=observer-chain`。当前15运行文件hash不变，main/HTML/CSS仍00b8c0/35dee8/d63b62，rootverify不复跑。worker=`ready_for_review`，stage=`lifecycle`，停等独立复核；预算failed，场景和下一场景未放行。卡顿用户暂停，不测FPS/帧/CPU/cold-warm/启动，不改调度/画质、不提交推送发布，20分钟报告授权保留。

## 已完成的STORY-05纯规则记录

资源偏好已由监督者提问但用户未答，不再问；原素材/网格/画质/预算/等待标准不自动改，候选不接入。卡顿未解决且继续用户暂停，本轮没有浏览器/帧/启动测试。

新增一个Node公开API变形检查：连续实例与独立存档恢复实例，对两种学习顺序的相同事件轨迹逐步产生相同序列化状态及手册投影。每种15事件（11接受/4旧事件忽略），各16次save/inspect重建实例，覆盖7个稳定状态；跨学习顺序的最终flag只作集合语义比较。没有复制转移规则生成自证，不修改生产story/world/场景/文字。

[summary.json](./review/story-determinism/summary.json)记录精确版本、范围和结果；[trace.json](./review/story-determinism/trace.json)记录各事件与恢复、终态和现有手册文案。[targeted-test.log](./review/story-determinism/targeted-test.log)定点1项通过；[verify.log](./review/story-determinism/verify.log)根只运行一次，13组及16游戏规则通过。首轮错误“注释”断言已按当前“写清楚坑”公开文案契约纠正，失败记录保留，未用错误结果改生产逻辑。

公开手册没有独立集合API，本测试比较manual_entry_written与text(learning-manual-1)，不验证DOM或把游戏文案当作者历史原话。32次恢复是两条采样续行轨迹，不证明所有排列、存储故障或浏览器恢复。8个相关生产文件hash不变，main/HTML/CSS仍为00b8c0/35dee8/d63b62。

已复用并更新最新独立键盘16、连续23步/108可信键盘、两页ISOLATION及当前完成/坐姿截图证据，不复跑浏览器，不签完整美术/真机/作者/场景。STORY-05仅worker本范围通过，停等独立复验；BUDGET-LOAD仍failed，其余范围未验继续保留。worker=`ready_for_review`，stage=`story-determinism`；`scene_accepted=false`、`next_scene_authorized=false`，不扩场景、不改调度、不提交推送发布，20分钟报告授权保留。

## 已完成的博客隔离与设计方案记录

[两条设计路线](./review/resource-budget/design-options.md)已写，不等待规划许可。保持现有预算/8秒而评审正式生产网格，或保持PNG原像素并明确评审体积与等待标准变化；30.92秒当前正文传输下界说明8秒不能靠改两个数字保住。文档给出保持/改变项、具体额度、风险和各自最小样品；本轮没有实际改图、格式或预算，最终取舍仍须作者确认。无损候选已由监督者独立确认仍超预算，继续不接入。

ISOLATION实际冷缓存Chrome仅打开首页及正式文章两页，并到文末触发其懒加载图片/评论：7+17请求，零游戏/Three/图集/游戏脚本请求，零本地失败及缓存命中。每页清此新profile缓存和本地origin存储，禁用缓存/绕过service worker。3个公网统计/评论脚本主动拦截，记录net::ERR_BLOCKED_BY_CLIENT，不重试。该结论仅覆盖本地两页及其本地资源，不覆盖被阻止执行的第三方脚本联网行为。

[summary.json](./review/blog-isolation/summary.json)、[全请求URL/类型/失败项](./review/blog-isolation/worker-requests.json)与[68份HTML静态引用](./review/blog-isolation/static-references.json)分开记录。静态范围为 `docs/**/*.html` 直接加载引用和根共享JS/CSS字面量，不冒充68页/全浏览器实测。复验：`node games/career-rpg/web/tests/browser.mjs --blog-isolation --evidence=worker`，复用只读真实docs server和独立Chrome profile，未访问游戏或用户登录会话。

生产未改，仅局部测试工具/证据更新；未重跑verify/已通过专项或测运行性能。ISOLATION为本范围worker通过，停等独立复验；BUDGET-LOAD仍failed，其他未验项不改变，`scene_accepted=false`、`next_scene_authorized=false`。worker=`ready_for_review`，stage=`blog-isolation-and-options`。**走路卡顿未解决，用户要求暂停**，候选不实施、不扩场景、不改调度、不提交推送发布，20分钟每次报告授权保留。

## 已完成的无损可行性探测记录

现有预算失败已由监督者独立复算确认。本次只对五张运行PNG各做一次现有cwebp 1.4.0的固定 `-lossless -exact -q 100 -m 4 -metadata all` 临时探测；libpng 1.6.57解码原图，dwebp 1.4.0解码候选。五图RGBA（含透明像素RGB）、alpha和尺寸逐字节相同；当前无ICC/gamma等标签，8位默认色彩解释等价。caBX附属信息未带入WebP，原文件保留；完整元信息和浏览器格式接入未验证。

候选假设首玩2,990,922 B gzip（超2,466,634 B）、整章3,622,591 B原始（超1,525,439 B），两项仍失败。原预算、生产PNG和加载路径均未改，单独删Three不足的结论沿用。不把单模式失败写成所有无损方法不可能，也不采用未验证格式/分阶段加载凑通过。

[lossless-feasibility.json](./review/resource-budget/lossless-feasibility.json)含逐图原始/候选体积、解码RGBA/alpha hash、色彩/chunk检查、假设预算及决策问题；探测现场在 `/private/tmp/traex-career-rpg-supervisor/lossless-probe/run-45tjk8qo/`，生产15文件哈希一致。没有安装、额外参数搜索、verify/浏览器或运行性能测试。

完成后停等监督者安排最小问题：是否允许另行提出南京正式生产网格/资源组织方案评审，预算和已认可外观仍为约束？任何尺寸/像素/颜色变化不自动获授权；未来格式候选的来源记录与浏览器行为另验。worker=`needs_design_decision`；场景及下一场景均未放行。**走路卡顿未解决，用户要求暂停**，质量、真机/作者/真人等门禁及20分钟报告授权保留，不改调度、不提交推送发布。

## 已完成的南京资源预算静态测量记录

[FALLBACK监督者结论](./review/fallback/supervisor-review.json)已独立通过当前版本10个case：127次按键、零指针，1280/375故障画面和JS禁用摘要已审。只通过此专项，不放行整场景、真机或作者体验；本轮不复跑专项或根verify。

只读测量已完成，生产代码/PNG未改。15个运行资源为HTML 1、CSS 1、项目模块5、Three模块2、JSON 1、PNG 5；`three.core.min.js`被import和re-export各引用一次，同一URL只计一次。`await import(Three)`后，背景、剧情与四图集全部在同一个Promise.all等待，当前首玩与整章集合相同，无后续资源加载器。

首玩：3,864,937 B gzip，超524,288 B上限3,340,649 B。整章：5,191,167 B原始，超2,097,152 B上限3,094,015 B。HTML为3,985 B原始/1,930 B gzip，两项体积限额通过。未请求的MIT许可单列1,081 B原始/662 B gzip；最小分发包原始5,192,248 B仍失败，没有放宽标准。

完整资源、URL去重、递归边、动态值来源、原始/gzip字节、SHA256、PNG chunk和未引用美术排除记录在 [manifest.json](./review/resource-budget/manifest.json)；[summary.json](./review/resource-budget/summary.json)记录差距、贡献与建议。复现：`python3 games/career-rpg/scripts/resource-budget.py`；输出 [measurement.log](./review/resource-budget/measurement.log)。每文件gzip level 9/mtime 0独立计算，不是网络流量/启动性能。无需浏览器核对：实际动态值已静态解析，未跑整章或性能，也未复跑已通过专项/根verify。

PNG占gzip94.45%，附属chunk合计114,784 B原始，不能靠删元数据弥补原始差距；颜色信息不默认可删。后续可先评估保留原像素/alpha/色彩的无损打包，再评估保留r180/MIT的Three子集（179,261 B gzip）；单独移除全部Three仍不达标。分阶段加载需要真实可玩/恢复证据，不能降低整章原始总量。未确认能无损达标的方案，本轮未优化、缩图或改画风；严格生产网格/图集仍未验。

27个运行与原始PNG哈希前后相同。main/HTML/CSS仍为监督者已通过版本；BUDGET-LOAD失败，FALLBACK仅本专项独立通过。博客隔离只有首页/一篇文章的静态直接引用证据，冷缓存未验。`scene_accepted=false`、`next_scene_authorized=false`。**走路卡顿未解决，用户要求暂停**；真机/作者/真人等门禁不变。worker=`ready_for_review`，停等监督者，不扩场景、不提交推送发布、不改调度；20分钟每次报告授权保留。

## 已完成的FALLBACK制作方自验记录

静态摘要直接可读；JS禁用或模块不执行仍有说明和原生返回链接。当前开发页的 `../../../docs/index.html` 在只读根HTTP夹具中返回200，已用Shift+Tab/Enter到达博客；旧测试模式仅服务游戏目录，未将其夹具404当成博客缺陷。

图形或必需图片失败提供明确说明、文字阅读、回博客和键盘重试。上下文丢失停止RAF、清输入、移除不可用canvas；图形恢复后仍由用户明确重载，稳定存档保留。重试去掉摘要hash，避免浏览器恢复摘要焦点。剧情、美术、角色、气泡与已有键盘/正文阅读逻辑未重做。

[summary.json](./review/fallback/summary.json)记录10个case、实际行为、按键、截图、各自哈希与复用理由。最终 `--fallback-case=context-lost-1280,context-lost-375,normal-smoke-1280,normal-smoke-375 --evidence=context-fixed` 四项通过；其他故障在相同HTML/CSS和未受最后canvas移除语句影响的路径复用，不混成同版本全量验收。正常烟测含开场正文Shift+Tab/Home/End/PageDown、Tab/Enter关闭、Esc暂停/返回焦点和键盘回博客，零指针、无直接focus/scrollTop/剧情函数。未重跑16项、整章、学习顺序或性能。

早期故障重载的测试同步/标签失焦误判、摘要hash恢复焦点缺口，以及“DOM通过但损坏画布盖住错误文字”的视觉失败均保留。最终1280/375上下文丢失及375摘要截图已实际view_image核对：说明、焦点与最后一句可见。375仍为模拟，不代签真机、整体布局、美术偏好或作者体验。

完整入口：`node games/career-rpg/web/tests/browser.mjs --fallback`；独立启动当前工作区只读games/docs server和新Chrome profile。`python3 scripts/verify.py` 当前13组/15游戏规则通过，日志 [current-verify.log](./review/fallback/current-verify.log)。main/HTML/CSS最终哈希为 `00b8c0c26cddc956a5401e7d3df3fbfdb637f192532f6d0d8881822fe34c93f1` / `35dee878a076e8285299058b6439657d9c26266045d661dec28865172a9a81dd` / `d63b626c58f2bb058b6926bb57af4d11d718f28750f563a47bfffad3f8f12213`。

24个纯模块/数据/美术/vendor基线哈希一致，历史剧情/碰撞/素材证据按范围沿用。FALLBACK仅worker自验完成，停等监督者独立复验；其余当期门禁仍保留，`scene_accepted=false`、`next_scene_authorized=false`。**走路卡顿未解决，用户要求暂停**，不重开性能、不扩场景、不提交推送发布、不改调度；20分钟每次报告授权保留。以下均为历史记录。

## 已通过的阅读与门禁摘要记录

本次只整理监督者现有结果，不重试final或相同审批，不测试/改实现/绘图。`review/dialogue-reading/supervisor-summary.json`的4个case均通过，`supervisor-review.json`记录独立范围、审图和限制；`supervisor-verify.log`根13组通过，git diff --check已由监督者通过。原审批超时/重试记录保留历史，当前不再阻塞收尾。

| 代表路径 | 首→尾scrollTop | 正文高度 | 结果 |
| --- | --- | --- | --- |
| 完成气泡1280 | 0→9 | 160 | 首尾/焦点/文本/返回/无串滚动通过 |
| 完成气泡375模拟 | 0→112 | 56 | 同上；不代表窄屏整体/标题或真机通过 |
| 长系统1280 | 0→151 | 405 | 同上；长文为隔离DOM重复原提示的代表夹具 |
| 长系统375模拟 | 0→526 | 405 | 同上；不冒充新增真实剧情或真机 |

实际键序：默认选项焦点→Shift+Tab正文→Home/PageDown/PageUp/End→Tab选项→方向选择→Enter返回。键盘事件可信、零指针；没有用script focus/scrollTop代替验收。证据与首尾截图均由监督者现有运行提供，本轮没有新测试。

最后生产哈希：

- main.mjs：`255f77acfbcc2aedbe636af92b833e3bfb521a4891acf936581e7495d96d2c47`
- index.html：`b932843f68895a68d1ec2af804fb9ee10019a4ffdd4dcb43a5d8d4ce6e11272a`
- style.css：`229902e2e1c94e42bf7e49a37c204e35beb6e8f2fc4dec8a79c6a19840d4843e`

[summary.json](./review/dialogue-reading/summary.json)更新为监督者阅读专项通过；[nanjing-scene-gate.json](./review/nanjing-scene-gate.json)39项、48行逐项列当前标准。3917历史16项/连续旅程的通过只覆盖其版本，最新UI改变后的全量键盘、恢复/失焦及整体布局仍有未验范围；阅读4项不自动放行它们。

当前可独立处理的技术缺口只列清：最新受影响输入/恢复复验、窄屏整体/头部标题、生产网格/边缘、回博客入口与后备错误路径、资源/启动预算和生命周期；本轮不自行开启。作者/真机/至少3人试玩/时长及发布标准继续保留，不能把当期必验自动移到后期。

走路卡顿仍未解决、用户要求暂停；不解除、不测性能，不拿软件GL或步态通过代替体验。scene_accepted=false、next_scene_authorized=false。原20分钟每次报告授权继续且调度未改；无需重复重批所有常规接续。当前完成收尾停等监督者，worker为ready_for_review/scene-gate-summary。

## 已完成的连续键盘旅程记录

本次单次命令：`node games/career-rpg/web/tests/browser.mjs --keyboard-journey`，首次通过。复用原CDP/key/walk/open和keyboard-scenarios的隔离本地服务；journey分支先于旧整章分支，不能混入16项、故障/第二学习顺序或性能模式，也不读取8765旧服务。

| 项目 | 实际结果 | 证据 |
| --- | --- | --- |
| 新开局到complete | 一次连续路径，23步；三个排查确认和两项学习都由键盘确认 | `review/keyboard-journey/steps.json` |
| 实际可信键盘 | 108个trusted事件、零指针输入；菜单方向/Enter、探索E、关闭Esc，Tab/ShiftTab保持 | `input-and-storage.json` |
| 不跳档 | profile初始空；一次导航无reload；12次仅游戏自身save，无手动种档或删除 | summary.continuity、input-and-storage.storageWrites |
| 当前版本 | 实际HTTP响应main/HTML/CSS哈希与当前文件一致；main仍3917ce66... | summary.hashes、loaded_resources |
| 正常旅程画面 | 坐姿、CTO气泡、紧张、开心、完成5图，同1280×900/DPR1版本；已view_image打开 | player-seated/cto-bubble/player-tense/player-happy/chapter-complete.png |
| 保留生产文件 | 54文件基线无差异；没有行为修复或图集变化 | `/private/tmp/traex-career-rpg-supervisor/journey-backup-20261105/runtime-baseline.json` |

摘要为 [summary.json](./review/keyboard-journey/summary.json)。生产代码未改，按用户要求不复跑根verify和已通过16项；只做git diff --check。Chrome156.0.8078.79、headless/software WebGL；这是技术连续路径，不是人读完文本的时长、真人/真机录屏、性能或作者体验验收。完成正文仍是原滚动区域，本次不另做文字可访问性/美术专项。

此前16项监督者已独立通过，见 `review/keyboard-acceptance/supervisor-review.json`；这条连续路径和同版本画面仍等其复验，不自行放行南京或下一场景。走路仍卡且性能排查暂停，旧全旅程goal不恢复；现有20分钟监工调度不修改。完成即停，worker为ready_for_review。

## 已完成的键盘定点自验记录

2026-11-05，唯一目录仍为 `/Users/bytedance/work/AI/zwhu.github.io`。本次仅键盘缺口小修；常规接续与20分钟监工已授权，不再笼统要求用户重授权。旧全旅程goal保持暂停，走路卡顿性能排查不恢复，现有调度未修改。

| 按键/操作 | 自验结果 | 证据 |
| --- | --- | --- |
| 暂停菜单↑↓←→、Enter/Space | 可见选择；保留单行顺序与多行相邻位置；不移动人物 | `review/keyboard-acceptance/final-checks.json`：pauseDirectionNavigation |
| E/Q、对话选项、Tab/ShiftTab | 附近对象与旧快捷键保留；多行对话可方向选，原生Tab可离开/返回，不困焦点 | dialogueDirectionAndShortcuts、tabHudAndManualFocus |
| Esc确认页/手册/重玩 | 返回上一级与原选项；HUD手册返回按钮；确认页返回保留坐姿与锚点 | confirmationPageBack、pauseManualReturn、completionManualReplay |
| 长按Enter/Space、重复键及松开 | 一次操作只作用当前界面；松开不确认新界面；释放后新确认有效，背后不误交互 | enterReleaseBoundary、spaceReleaseBoundary |
| 必选剧情/存档Esc、禁用项 | 可暂停并回原决定；暂时禁用手册/重玩，方向和Tab跳过，不确认禁用项 | requiredDialoguePauseAndDisabled、damagedSaveChoices |
| 真实浏览器标签切换、持方向键 | trusted blur/visibility事件清键暂停，返回焦点后位置不跳，原对话选择保留 | nativeDialogueFocusRestore、nativeBlurClearsHeldMovement |
| 重玩、损坏存档、保存失败 | 全部用键盘选择和确认；显式重置只动游戏存档；重试/本次继续保留旧值 | completionManualReplay、explicitSaveReset、storageFailureKeyboard |
| 375/560/700/1280预览 | 菜单选择可见、无整页横向溢出；DPR2为模拟，不能代替手机 | final-menu-*.png、responsiveDirectionPreview |

实际命令：`node games/career-rpg/web/tests/browser.mjs --keyboard-acceptance --evidence=final`，16项通过。复用原browser.mjs的CDP/键盘/走动接口，新增隔离本地服务与定点场景，不依赖旧8765服务。所有观察键盘事件isTrusted=true，零指针；检查点用localStorage合法夹具，保存失败注入只在隔离浏览器，未用click/状态函数代替操作。Chrome156.0.8078.79，macOS26.6.2，headless/software WebGL。实际标签切换已验证，旧合成blur证据不充当本轮结论。

根 `python3 scripts/verify.py` 13组、游戏15规则通过；`git diff --check`通过。菜单/气泡六张同版本截图已view_image核对；16份原PNG校验不变。world/story/scene-config/actors、章节数据及vendor未改；本次没有性能探针、整章重跑或新场景。

[summary.json](./review/keyboard-acceptance/summary.json)记录版本、逐项操作、失败/修复、复用证据、命令与未验项；[final-checks.json](./review/keyboard-acceptance/final-checks.json)保留原始可信事件。备份在 `/private/tmp/traex-career-rpg-supervisor/keyboard-backup-20261105/`。早期失败记录保留；修前方向导航失败、初始body焦点失败已修；一次多行布局断言错误已纠正测试；写入失败确认保护改用键盘按下/松开隔离，最终专项通过。

唯一下一步：停等监督者独立复验。`ready_for_review`不是监督者通过，也不是游戏全部验收。仍未验Safari/真机/真人连续键盘体验与录屏、完整最新坐姿气泡美术、作者与3人试玩、阅读时长、真机性能、导出/发布及既有史实缺口。走路仍卡未解决，不自动开性能排查或下个场景。

## 合并阶段记录（已由监督者通过）

本Web实现已完整合并到 `/Users/bytedance/work/AI/zwhu.github.io/games/career-rpg/web/`，源worktree仅只读，不再作为后续工作目录。七状态主线、存档、四向/行走、NPC、情绪、五工位、坐姿打字与头部气泡已存在；本次未修改任何运行代码或素材。合并结果见 [摘要](../review/merge-2026-11-05/summary.json)。

最新作者反馈“走路还是很卡”，未解决且要求暂停；不得自动恢复下方旧的cold/warm测量、debug或新场景任务。已有文件和截图完整保留，仅按对应版本证明原检查。最新坐姿/气泡最终视觉与全键盘专项仍待验；方向键选择所有选项、Enter确认的新增要求仅合入文档，本次不补代码、不声称通过。保留既有Tab/ShiftTab、E/Q/M、Space、Esc及头部气泡。

唯一下一步等待监督者核对合并摘要；未经用户恢复不做研发、绘图、浏览器整章或性能检查。当前不验证旧HTTP服务或session，不操作其他会话进程。合并前原文件逐字保存于 `../history/merge-source-2026-11-05/web/handoff.md`，下列历史中的“静态正面/尚无存档/正在排查”等不代表当前状态。

## 合并前Web历史记录

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
