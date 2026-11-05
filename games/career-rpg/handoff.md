# 《一路写来》交接

## 当前恢复点（2026-11-05，南京技能与旅程地图）

南京章接上通用技能收集：五个技能只展示、不数值。合肥四个技能走同一套逻辑，名字在 `chapter-hefei.json`。章末旅程地图用 `web/art/transition-map/` 的定稿，人物从合肥走到南京。口号只在 `web/slogan.mjs`。不修走路卡顿，不做到杭州场景。

## 当前恢复点（2026-11-05，合肥单场景）

用户授权只做合肥一章，不改南京行为，不修走路卡顿，不上线。入口 `web/?chapter=hefei`。5 个状态、10 个事件，存档键 `career-rpg:hefei:v1`。日夜转场由程序切日景/夜景纹理并做离散压暗，播完才 `advance`。感叹号是运行时精灵，锚点只写在 `HEFEI` 配置。物件用 icon，靠近可交互时换 icon-highlight，交互时才加载 card-192，关闭后清掉地址。老板表情走气泡旁的 `drawPortrait`，不画进行走图。运行图在 `web/art/hefei/`，候选和记录在 `art/processed/hefei-v2/`。数据库卡片与图标已换成带 `#284058` 的一版。

作者确认的房间是居民楼改的办公室：一张长桌、对坐六个位子，`my_pc` 在长桌左侧第一个位子，老板茶桌在右下角沙发旁。v3 底图未到，现在仍用 v2 房间图占位，碰撞和工位坐标只在 `scene-config.mjs` 的 `HEFEI` 里。验收录屏和实机截图等 v3 换上后再录。

以下为上一份停止制作时的交接。

## 当前恢复点（2026-11-05，停止制作并交接）

接手先读本节与[技术方案](./technical-plan.md)，按任务再读相关规格；无需通读下方长历史。工作目录唯一为 `/Users/bytedance/work/AI/zwhu.github.io`。已合并的源worktree继续只读，不再重新合并或重做南京。

### 当前决定

- 保留现有Three.js正交相机、二维背景/人物贴图和项目自用逻辑；程序绘图改变素材生产，不意味着改为Three.js三维建模或切换引擎。
- 人物、NPC、表情和关键姿态用image_gen，实际传入南京成品参考。程序负责所有环境场景、家具、图集整理与压缩；环境不调用image_gen。已有素材优先复用，原图完整归档。
- 当前桌面键盘游玩，浏览器作本地开发入口。H5、移动端、触控、弱网、游戏上线暂不实施，原生安装包工具未定。旧网络预算失败和40秒候选保留历史，不记通过，不继续据此研发。
- **loop为PAUSED；TraeX当前无执行任务，旧全旅程goal暂停。用户说handoff，本轮停止制作。** 不擅自恢复监控、冷启动测试或全旅程目标。走路卡顿未解决，排查继续按用户要求暂停。
- 质量高于速度，一个场景验收通过再接下个；提前准备人物或背景不代表场景通过。人物外貌与没有照片依据的布局是游戏设定，不声称真人或真实空间还原。

### 用户最新反馈与停止位置

用户对12张程序场景v1明确反馈“确实非常简化”“没有什么区分度”。这批未获认可，不能以32KB或数量齐全证明效果可用。问题在于共用房间骨架、规则矩形和重复道具，缺少每个场所的空间特征与材质细节。

随后只重画了3张v2：宿舍加入上下铺/梯子/晾衣与学习区；驿站加入货架/开放卷帘门/打包台/滚筒带/笼车；小区改为室外建筑/内凹入口/庭院/台阶/配送车。**v2尚未收到用户评价，仍为简化草图，不能写成达到南京基准。其余9张尚未按v2重画。**

### 产物与完成范围

| 内容 | 路径与当前结论 |
| --- | --- |
| 原南京游戏 | `web/`，主线、四向、NPC、情绪、坐姿、五工位、头部气泡已有；完整场景仍未通过。不要写成“只有概念图”。 |
| 全旅程人物清单 | [art/character-roster.md](./art/character-roster.md)。主角、CTO、费翔🐘、米衣同伴复用已有图集。 |
| 新人物7个 | 大学同学、安风徳老板、南京老板、杭州TL、项目同伴、业主家长、驿站工作人员；每人四向站姿＋3表情。原图/提示词/记录在 `art/source/remaining-characters-v1/`。外貌是设定，未获用户认可。 |
| 人物候选与总览 | [art/remaining-characters-v1/index.html](./art/remaining-characters-v1/index.html)；候选与审阅记录在 `art/processed/remaining-characters-v1/`。没有新行走/打字动画，未切帧、校准动画锚点或接入游戏。 |
| 人物处理脚本 | `scripts/prepare-character-sheets.py`：使用已有libpng/cwebp/dwebp；alpha阈值128归一化改变原图像素，后续PNG→WebP逐张解码RGBA一致。原图8,738,291 B，候选2,291,462 B；不能把整个过程称为无损或推导内存同比下降。 |
| 程序环境v1 | [art/procedural-scenes-v1/index.html](./art/procedural-scenes-v1/index.html)，12个384×216背景，单场景PNG合计32,826 B。用户不认可其简化程度和区分度；只留作草图历史。 |
| 程序环境v2 | [art/procedural-scenes-v2/index.html](./art/procedural-scenes-v2/index.html)，3个重画背景、旧图对照、`generate.py`、`report.json`和`contact-sheet.png`。单场景PNG合计10,795 B，待审；未配置人物/遮挡层/碰撞/剧情/交互。 |
| 程序绘图探索 | `art/procedural-desk-v1/`、`art/codex-program-character-v1/`、`art/traex-program-character-v1/`；人物纯程序路线已结束实验，不作为默认正式人物。 |
| 官方资料调研 | [design/pixel-rpg-art-pipeline-research.md](./design/pixel-rpg-art-pipeline-research.md)，说明图集、物件/图块/独特背景混用与渲染分工；没有测得工时或token节省比例。 |

v1的12个环境是：大学宿舍、安风徳办公室、南京深夜书桌、杭州商品发布、双11值守、浙里办项目、在家读业主群反馈、健康码支援、驿站、送货入楼、字节工作与现在AI/写作书桌。业主群反馈不改写成当面见家长；健康码不补未知职责；屏幕不伪造日志、聊天或内部系统。

### 接手后的唯一下一步

等用户评价v2；收到明确继续指令后，先选一个场景把空间特征、物件细节和南京风格做到满意，再按同样标准逐张修改。不要直接批量复制v2模板补其余9张，不继续用“全部背景已生成”代替质量验收。人物也先核对设定，再做切帧/锚点/压缩和实际渲染；未认可的候选不替换运行引用。

本次handoff只整理文档，不再启动绘图、TraeX、子代理或性能任务。

### 验证与Git

- 最近一次 `python3 scripts/verify.py` 全部13组通过；场景图与浏览器预览不等于场景可玩验收。
- 7个人物候选已逐张看图，候选WebP解码核对通过；总览页桌面、键盘展开原图和375px无溢出已检查。v1场景总览桌面/375px已看；v2三图和桌面对照页已看，未声称新的手机或游戏交互验收。
- 既有南京键盘16项、连续23步、长对话、回退、博客隔离与规则各有独立证据；生命周期只接受20轮可观测计数和显式释放，完整堆/驱动内存仍未验证。最新整体视觉、作者体验和其他桌面环境不得代签。
- 最近一次用户要求提交已完成于 `97b5843`。其后方案文档、程序样品、调研、新人物及环境草图仍是**未提交工作区改动**，需保留；本轮handoff未commit、push或发布。

### 预览与复现

若本地预览服务已退出，可从仓库根目录运行 `python3 -u -m http.server 8765 --bind 127.0.0.1`。优先打开：

- 场景v2：`http://127.0.0.1:8765/games/career-rpg/art/procedural-scenes-v2/`
- 新人物：`http://127.0.0.1:8765/games/career-rpg/art/remaining-characters-v1/`
- 现有南京：`http://127.0.0.1:8765/games/career-rpg/web/`

绘图可从仓库根目录执行 `python3 games/career-rpg/art/procedural-scenes-v2/generate.py`；依赖v1的Canvas与程序工位函数，均为仓库本地源码，不调用image_gen。重复生成只重建实验产物，不代表验收，需保留用户反馈记录。v1与程序人物旧命令仅作追溯，不需要重跑。

TraeX旧会话UUID为 `01a1a787-db6c-77a0-b19c-b70908df7e60`；专用tmux socket `/private/tmp/traex-career-rpg-supervisor/tmux.sock`，pane `career-rpg:0.0`，模型顺序 `gpt-6.1-sol → gpt-6-astra → gpt-5.6-sol`。这些仅供明确授权后恢复；当前不启动、不resume旧goal。临时监督state不能覆盖本节的最新决定。

以下为历史记录；其中旧“仅合并”“待资源偏好”“恢复后自动巡检”等状态不代表当前任务。

## 历史记录：程序绘制工位独立样品

随后用户授权 TraeX 做单次四向人物绘图测试，产物在 `art/traex-program-character-v1/`；完成后已停止，loop 未恢复。用户又要求 Codex 自画对比版，产物与三方对照页在 [codex-program-character-v1](./art/codex-program-character-v1/index.html)：每帧48×64，四向PNG共1,298 B，18种RGBA值，脚底y=61；独立手写绘图几何，原素材不改。两版都只有站姿，均未通过南京造型一致性验收。人物对照页已检查桌面、375px无横向溢出与图片加载。行业流程调研见 `design/pixel-rpg-art-pipeline-research.md`，不自动触发引擎迁移或扩场景。

用户已暂停 loop 与 TraeX，并明确授权 Codex 自行用程序绘制“桌子＋电脑＋椅子”对照样品。样品在 [procedural-desk-v1](./art/procedural-desk-v1/index.html)，源码为同目录 `generate.py`，仅用 Python 标准库逐像素绘制，不读取或复制参考图像素。160×128 透明 PNG 三版分别为 1,186／1,187／1,186 B，尺寸、颜色数和哈希见 `report.json`；不据此推算整幅背景压缩率或人工成本降幅。当前样品比南京参考更规整、材质更简化，未达到正式替换标准，未接入游戏。已预览桌面与375px窄屏，无横向溢出，三图加载正常。用户暂不考虑 H5，不自动继续此前弱网启动测试；旧预算记录保留为历史结果。下一步等待用户审阅此样品的视觉方向，loop、TraeX 与走路卡顿排查均保持暂停。

## 历史阶段：保留原图路线提案完成，停等评审

用户已选择“保留原图，评审4 MiB/6 MiB与40秒加载提案”，这是评审路线选择，尚未批准门槛变更。[具体提案](./web/review/resource-budget/original-art-proposal.md)及[独立短摘要](./web/review/resource-budget/original-art-proposal-summary.json)已落盘，不覆盖既有测量摘要；旧路线偏好待答/推荐仅为当时记录，以本段为准。

15项首玩资源与整章运行集合相同：静态gzip 3,864,937 B、原始5,191,167 B；分发包含MIT许可共16文件、5,192,248 B原始。提议4 MiB用于逐文件静态gzip、6 MiB用于含许可原始分发，不冒充HTTP上限。文本gzip/PNG identity的正文下界36.468552秒，40秒仅余3.531448秒；当前identity夹具正文下界41.529336秒。实际编码、依赖/解码与40秒均未实测，提案写清三轮冷缓存从导航到可信键盘实际移动的终点及等待/失败/重试/返回证据要求。

仅写文档，原PNG/加载路径/生产代码/现行规格未改，15项SHA256与manifest一致；main/HTML/CSS仍为00b8c0/35dee8/d63b62，完整hash见新摘要。本轮不执行启动/帧/CPU、浏览器或规则测试，不复跑根verify。文档资源表、算术、链接与JSON一致性检查通过，`git diff --check`通过。现行512 KiB/2 MiB/8秒不变，BUDGET-LOAD仍failed。最终额度、启动定义和长等待体验需作者明确批准，未制作样品；其他门禁不改。

生命周期[监督者复核](./web/review/lifecycle/supervisor-review.json)已接受正式20轮可观测记录，仅限该范围；完整JS/native/driver内存仍unverified，不重复测试。旧20轮是监督者限缩测试而中止，不是作者新增暂停要求。**走路卡顿未解决，用户要求暂停**，不重开排查。

worker=`ready_for_review`、stage=`original-art-proposal`，唯一下一步停等监督者/作者评审本提案；`scene_accepted=false`、`next_scene_authorized=false`，旧全旅程goal保持paused。不扩场景、不自动实施候选、不提交推送发布、不改调度；20分钟每次报告授权保留。

## 已完成的生命周期可观测记录


STORY-05已由监督者独立通过本范围，引用 [supervisor-review.json](./web/review/story-determinism/supervisor-review.json)，不扩大为所有序列证明；本轮不重跑纯规则或键盘专项。资源路线仍待原问题答复，不重复问，不改画质/预算/等待标准。

先验证1次原生pagehide观察链，再正式执行同方法20轮：真实键盘章节重玩→浏览器完整Page.reload→重新进入。重玩复用原场景/渲染器；没有独立的文档内办公室切换API，不伪造场景进出。20次均isTrusted=true、persisted=false，卸载snapshot正常、Runtime无异常，正式进程退出0；没有提前dispose、模拟pagehide、剧情跳状态或帧/启动性能探针。

基线、重玩后与每次重入均为4角色、9mesh、1场景/渲染器/相机、几何/材质/纹理各9逻辑对象，DOM2canvas/3标签/1任务标记/7按钮，连接监听器23、待执行RAF1。20次pagehide后几何/材质/纹理各9收到dispose、渲染器1次dispose，RAF0，renderer.info几何/纹理/程序均0。每轮源图对象5、脚本canvas13、ResizeObserver1稳定；弱观察到的脱离DOM监听器0～3不作保留堆或泄漏结论。

原生WebGL在pagehide仍有4个上下文回退纹理和3个renderer framebuffer辅助对象，JS delete未观察到它们释放；其他buffer/program/shader/VAO计数归零。19个连接监听器与ResizeObserver仍依赖完整文档清理。共享对象、库上下文缓存、JS/native/driver隐式回收分别列清，不能把renderer.info零或进程退出当成完整内存无泄漏证明。完整JS堆/解码图像/canvas/driver内存、BFCache恢复及未来文档内场景切换仍未验证，LIFECYCLE门禁保持unverified，没有证据表明生产资源持续增长，未改生产修复。

证据：[短摘要](./web/review/lifecycle/summary.json)、[逐轮原始计数](./web/review/lifecycle/series-final-counts.json)、[单周期观察链](./web/review/lifecycle/observer-chain-validation.json)、[静态所有权](./web/review/lifecycle/static-audit.json)。前两次代理语法失败、第三次binding卸载报告未送达以及由监督者限缩测试而中止的旧20轮保留为尝试，均不用于正式结论。已证实binding调用返回但CDP无事件，测试独立sessionStorage保存同一原生事件快照后可可靠读取，不改游戏存档。

正式命令：`node games/career-rpg/web/tests/browser.mjs --lifecycle --lifecycle-cycles=20 --evidence=series-final`；单周期用 `--lifecycle-cycles=1 --evidence=observer-chain`。生产15个运行资源hash不变，main/HTML/CSS仍为00b8c0/35dee8/d63b62；不复跑rootverify。worker=`ready_for_review`、stage=`lifecycle`，完成即停，`scene_accepted=false`、`next_scene_authorized=false`。**走路卡顿未解决，用户要求暂停**，预算failed，不扩场景、不改调度、不提交推送发布，20分钟报告授权保留。

## 已完成的STORY-05纯规则记录

资源两路线偏好已由监督者提问，用户尚未答复，不重复询问；原图、生产网格、画质、预算与等待标准不改，候选不接入。**走路卡顿未解决，用户要求暂停**，本轮不测启动/帧或重开排查。

本轮仅补一个公开API变形检查：两个独立章节实例分别连续推进和逐检查点save/inspect恢复，当前同一合法事件序列的可序列化状态与手册一致。两种学习顺序各15个事件（11接受、4旧事件忽略），共32次恢复覆盖office/report/incident/investigation/restored/learning/complete；不同学习顺序只按最终flag集合比较，不误要求插入顺序相同。手册为公开flag与现有文字ID的纯规则投影，不代替DOM或真实历史手册验收。

定点命令 `node --test --test-name-pattern='identical semantic journeys replay equally across independent instances and stable saves' games/career-rpg/web/tests/story.test.mjs` 通过；用 `STORY_DETERMINISM_EVIDENCE` 指向证据文件时落逐步轨迹。新增测试后根 `python3 scripts/verify.py` 只运行一次，13组/16项游戏规则通过。首轮误用“注释”字面断言，与当前“写清楚坑”文案不符，失败日志已保留；仅纠正测试期望，没有改剧情文字或生产代码。

证据：[summary.json](./web/review/story-determinism/summary.json)、[事件/恢复轨迹](./web/review/story-determinism/trace.json)、[verify.log](./web/review/story-determinism/verify.log)。story/world/场景/表现/main/HTML/CSS/章节数据8个生产文件SHA256不变，仍为00b8c0/35dee8/d63b62界面版本；精确测试/数据hash见摘要。该证据限两条采样轨迹，不是所有序列的数学证明；成功内存存储、UI/图形及其他恢复组合分别保留其范围。

监督者提供的当前版本键盘16项、连续23步/108可信事件和两页ISOLATION已核对，对应“仅历史3917”归因改为最新独立证据；当前完成/坐姿1280截图已审，但全部美术/严格网格/真机/作者/场景不签通过。本轮没有重跑这些浏览器项。

门禁仅更新STORY-05和提供的新监督者证据范围；资源BUDGET-LOAD仍failed，其他未验项保留。worker=`ready_for_review`、stage=`story-determinism`，唯一下一步停等独立复验，同时等资源偏好答复；`scene_accepted=false`、`next_scene_authorized=false`。不实施资源方案、不扩场景、不提交推送、不改调度，20分钟报告授权保留。

## 已完成的博客隔离与设计方案记录

监督者已独立核对五份无损候选字节/SHA256与假设总量，确认首玩2,990,922 B gzip、整章3,622,591 B原始仍超现有目标。原PNG/路径和预算不改，候选不接入。

[design-options.md](./web/review/resource-budget/design-options.md)已自行写出两条具体路线，不再等待“是否允许写方案”：一是保持512 KiB/2 MiB及1 Mbps/8秒目标，评审能保住南京成品的正式网格；二是保持现有PNG全部像素与来源信息，明确评审4 MiB/6 MiB及1 Mbps/40秒等待提案。后者不能只改体积数字而继续声称8秒通过；当前gzip正文传输下界已30.92秒。文档列保持/改变项、证据、不确定项和各自下个最小样品，本轮不实施；真实美术/像素或预算与启动标准的最终变更仍须作者明确确认。

本轮唯一浏览器工作是ISOLATION：新独立Chrome profile、两次清缓存并禁用缓存/绕过service worker，分别打开真实 `docs/index.html` 与 `docs/claude-code-review.html`，以PageDown/End到文末触发该文章懒加载资源与评论入口。首页7请求、文章17请求，共24请求，无游戏目录、Three或对应图集/脚本请求，本地无失败、无缓存命中。3个公网Cloudflare/giscus脚本请求在发出前主动拦截，失败原因和完整URL/资源类型已记录，不重试；结论不覆盖第三方脚本联网后的行为。

证据：[summary.json](./web/review/blog-isolation/summary.json)、[完整请求清单](./web/review/blog-isolation/worker-requests.json)、[68份正式HTML静态引用](./web/review/blog-isolation/static-references.json)。68份仅是直接资源引用及根共享JS/CSS字面量核对，不等于全页执行或所有浏览器实测。复验入口：`node games/career-rpg/web/tests/browser.mjs --blog-isolation --evidence=worker`；只访问两页，不进入游戏，不测启动或帧。

生产文件未改，仅补局部测试工具和证据；未复跑根verify或已通过专项。ISOLATION按两页worker自验范围标通过，待监督者独立复验；BUDGET-LOAD维持failed，其他门禁不迁移通过。`scene_accepted=false`、`next_scene_authorized=false`。

worker=`ready_for_review`，stage=`blog-isolation-and-options`，完成即停。**走路卡顿未解决，用户要求暂停**，不重开性能，不实施候选、不扩场景、不提交推送、不改调度；20分钟报告授权保留。

## 已完成的无损可行性探测记录

监督者已独立逐文件/SHA256/gzip复算确认15个运行资源的原始5,191,167 B、gzip 3,864,937 B；现有首玩/整章目标失败，预算不变。此次只做一轮保持原像素的临时探测，不制作新素材。

本机现有cwebp/dwebp 1.4.0及libpng 1.6.57。每图只试一次 `-lossless -exact -q 100 -m 4 -metadata all`，没有量化、近无损、缩图或参数穷举。libpng解码原PNG、dwebp解码候选PAM，五图的完整RGBA（含完全透明区域RGB）、alpha和尺寸逐字节相同；源图和候选均无ICC/gamma等声明，当前8位无标签/sRGB默认解释等价。候选未保留caBX附属信息，未验证完整元信息或浏览器格式切换。

假设仅替换五个图像文件，首玩gzip 2,990,922 B，仍超524,288 B上限2,466,634 B；整章原始3,622,591 B，仍超2,097,152 B上限1,525,439 B。本轮未找到可信的无损达标路线，不断言所有无损方法均不可能，也不把未接入格式/分阶段加载算通过。

[lossless-feasibility.json](./web/review/resource-budget/lossless-feasibility.json)记录工具/模式、逐图体积、解码hash、色彩及附属信息差异、假设总量和未决项。原PNG副本、候选WebP、RGBA/PAM、脚本与日志保留在 `/private/tmp/traex-career-rpg-supervisor/lossless-probe/run-45tjk8qo/`。15个生产资源哈希不变，加载路径未改；未安装/下载、调用收费API、复跑verify/浏览器或运行性能。

最小决策问题由监督者安排：在预算和已认可外观不变的前提下，是否允许另行提出南京正式生产网格/资源组织方案评审？这不授权缩尺寸、改像素或颜色，任何此类变化仍须作者明确确认。若未来再考虑格式候选，来源附属信息归档和浏览器色彩/解码也需独立验收。

worker=`needs_design_decision`，完成即停；`scene_accepted=false`、`next_scene_authorized=false`。**走路卡顿未解决，用户要求暂停**，不重开性能、不扩场景、不改调度、不提交推送发布；质量优先、20分钟报告授权及其他未验门禁均保留。

## 已完成的南京资源预算静态测量记录

监督者已独立通过FALLBACK专项：当前版本10个case、127次按键、零指针；故障文字、键盘入口和摘要截图已审，结论见 [supervisor-review.json](./web/review/fallback/supervisor-review.json)。只通过本专项，南京整场景、真机与作者仍未放行。

本轮仅做只读BUDGET-LOAD测量，生产代码、PNG、尺寸和调色板未改。已从开发页HTML追踪到15个运行资源：HTML 1、CSS 1、项目模块5、本地Three模块2、剧情JSON 1、图像5。Three入口的两个core引用按同一URL只计一次；当前背景、JSON与全部图集在同一Promise.all中await，首玩与整章运行集合相同。没有未解析的动态资源，未追加冷缓存网络或启动/帧耗时测试。

| 静态预算 | 实测字节 | 现有上限 | 结果 |
| --- | ---: | ---: | --- |
| 首玩gzip | 3,864,937 | 524,288 | 超3,340,649，失败 |
| 南京运行原始 | 5,191,167 | 2,097,152 | 超3,094,015，失败 |
| HTML原始/gzip | 3,985 / 1,930 | 98,304 / 32,768 | 仅体积两项通过 |

MIT许可不是页面请求，单列1,081 B原始/662 B gzip；包含许可的最小分发清单为5,192,248 B原始，仍超2 MiB。gzip按每文件level 9、mtime 0独立编码后求和，保留原始字节、gzip字节和SHA256，不把结果当HTTP/CDN实际传输。未引用的旧Web图、概念图、提示词、测试和review不混入运行预算，按加载闭包排除。

[summary.json](./web/review/resource-budget/summary.json)列预算差距、贡献和优化顺序；[manifest.json](./web/review/resource-budget/manifest.json)保留完整资源/递归引用边、动态值来源、PNG chunk与逐项字节。复现：`python3 games/career-rpg/scripts/resource-budget.py`；终端摘要在 `web/review/resource-budget/measurement.log`。测量前后27个运行文件及原始PNG哈希检查一致；main/HTML/CSS仍为FALLBACK监督者通过的00b8c0/35dee8/d63b62版本。

PNG占gzip约94.45%；全部PNG附属chunk只有114,784 B原始，删元信息不足以弥补原始总量差距，颜色元信息也不能默认删除。建议先评估保持原像素/alpha/色彩的无损打包，严格网格与图集仍须独立验收；再评估保留r180/MIT的Three裁剪（当前179,261 B gzip，即使全去掉也不达标）；必要时再讨论有真实可玩证据的分阶段加载，它不能降低整章原始总量。本轮没有确认能无损达到预算的方案，不压图、不缩尺寸、不改标准、不自动优化。

普通博客首页与一篇文章仅有静态直接引用证据，冷缓存隔离仍未验。未重跑已通过FALLBACK或根verify；门禁只更新FALLBACK独立通过与BUDGET-LOAD失败。`scene_accepted=false`、`next_scene_authorized=false`。

**走路卡顿未解决，用户要求暂停。** 真机、作者、真人和其余当期门禁保留。测量任务已完成，worker为`ready_for_review`，唯一下一步停等监督者核对预算，不扩场景、不提交推送、不改调度；20分钟每次报告授权保留。

## 已完成的FALLBACK制作方自验记录

2026-11-05。只补本条：静态摘要直接可读，键盘回博客链接在当前根HTTP开发页实际到达 `/docs/index.html`（200）；JS禁用、WebGL创建失败、必需图片失败和上下文丢失均有文字与返回路径，可恢复时用Tab/Shift+Tab、Enter重试。上下文丢失停止渲染、清输入并移除损坏画布；重试清摘要片段，保留路径、查询参数和原稳定存档。剧情、美术和正常气泡未重做。

[证据摘要](./web/review/fallback/summary.json)列10个case及各自版本范围。最终4项为上下文丢失/正常烟测×1280/375：实际可信键盘、零指针，view_image已核对故障文字、重试焦点和摘要首尾。其他故障按未变HTML/CSS及renderer创建前的失败路径复用；早期DOM通过但损坏画布遮挡的截图保留为失败，不算通过。375仅为桌面模拟，真机/真人、整体布局、作者和其余当期门禁仍未验。

完整定点复验入口：`node games/career-rpg/web/tests/browser.mjs --fallback`，自动启动当前工作区隔离server和Chrome profile，不连接旧8765服务；本轮按失败范围用 `--fallback-case` 复验，具体命令、按键和结果见摘要。`python3 scripts/verify.py` 最终13组/15游戏离线规则通过，日志在 `web/review/fallback/current-verify.log`；未重跑无关16项、整条旅程或性能。

最后生产SHA256：

- main.mjs：`00b8c0c26cddc956a5401e7d3df3fbfdb637f192532f6d0d8881822fe34c93f1`
- index.html：`35dee878a076e8285299058b6439657d9c26266045d661dec28865172a9a81dd`
- style.css：`d63b626c58f2bb058b6926bb57af4d11d718f28750f563a47bfffad3f8f12213`

24个纯模块/章节/美术/vendor基线SHA256一致，既有剧情纯规则、碰撞和素材证据按范围复用。门禁仅更新FALLBACK、当前verify与必要版本标记；FALLBACK为worker自验通过，尚待监督者独立签通过。`scene_accepted=false`、`next_scene_authorized=false`。

**走路卡顿未解决，用户要求暂停。** 不重开性能排查，不扩场景，不修改调度，不提交推送发布。20分钟每次报告授权保留；唯一下一步停等监督者独立复验，无需泛化为重新授权所有常规工作。以下均为历史阶段记录。

## 已整理的南京门禁摘要记录

2026-11-05。监督者已独立通过本次正文阅读4项：complete/long-system ×1280/375，真实键盘正文可达、首尾可见、文本不变、不串页面/画布滚动、返回确认不误动。最新根verify13组及git diff --check也由监督者通过。原自动审批超时仅作历史保留；本轮不再重试final或请求相同审批，不改权限配置，只整理现有证据。

最新生产版本（与监督者证据匹配）：

- main.mjs：`255f77acfbcc2aedbe636af92b833e3bfb521a4891acf936581e7495d96d2c47`
- index.html：`b932843f68895a68d1ec2af804fb9ee10019a4ffdd4dcb43a5d8d4ce6e11272a`
- style.css：`229902e2e1c94e42bf7e49a37c204e35beb6e8f2fc4dec8a79c6a19840d4843e`

[阅读摘要](./web/review/dialogue-reading/summary.json)已以监督者结果为准，[场景门禁](./web/review/nanjing-scene-gate.json)列出39项及证据/缺口。旧3917版本的键盘16项、连续23步和五图审阅保留为其版本通过，不能自动覆盖最新阅读/UI改动后的全场景。375只证明正文阅读模拟，窄屏整体/头部标题和真机未正式验。

当期缺口包括：最新完整键盘/恢复的受影响范围复验，整体布局与严格生产网格，回博客入口缺实现及后备失败路径，资源/启动预算与生命周期等；本轮仅列清，不开启测试或修复。作者、真机、真人试玩和正式发布标准保留，不将当期项自动后移或标通过。

**走路卡顿未解决，用户要求暂停处理。** 软件GL/步态证据不替代体验，卡顿性能排查及旧全旅程goal仍暂停。`scene_accepted=false`、`next_scene_authorized=false`。现有20分钟每次报告授权继续，不修改调度，也不泛化为要求用户再次授权所有常规工作。

唯一下一步停等监督者核对摘要并安排当前缺口。本轮无代码/测试/绘图/新场景/提交推送发布，worker stage=`scene-gate-summary`、status=`ready_for_review`；这个状态不表示南京整场景已验收。

## 已完成的连续键盘旅程记录

2026-11-05。本次只调整测试入口，复用keyboard-scenarios的隔离服务，首次运行 `node games/career-rpg/web/tests/browser.mjs --keyboard-journey` 已从全新profile连续走到南京完成。没有使用8765旧服务；实际加载main/HTML/CSS字节与唯一当前工作区哈希匹配。

- 路径：office→report→incident→investigation→restored→learning→complete，含论坛、CTO、三个排查确认、恢复安慰、两项学习和手册归档。
- 证据：23步、108个可信键盘事件、零指针输入，一次页面导航、零reload/跳档。12次写入均为游戏自身存档；无手动localStorage写入、直接焦点/点击或剧情函数推进。
- 沿正常旅程取主角坐姿、CTO气泡、紧张/开心和完成共5张同版本截图，已用view_image打开。main仍为 `3917ce66a381c636b99221dabb314ef2703a673c5eb8653cf9731fcbef584ca7`，54个生产/美术/数据文件哈希不变。
- 只改browser测试入口及新增journey脚本。按本次要求未复跑已通过16项、无变化根verify、第二学习顺序、存档故障或性能；git diff --check通过。

[连续路径摘要](./web/review/keyboard-journey/summary.json)、[逐步状态/按键](./web/review/keyboard-journey/steps.json)、[可信输入与保存审计](./web/review/keyboard-journey/input-and-storage.json)已落盘。worker stage=`keyboard-journey`、status=`ready_for_review`。监督者已独立通过此前16项键盘缺口，本次连续路径尚待其复验；不能放行整个场景。

唯一下一步停等监督者。走路卡顿性能排查及旧全旅程goal继续暂停；真机/真人、作者/3人试玩、完整美术、时长和发布等仍未验。不扩场景，不提交推送，不修改调度。

## 已完成的键盘定点自验记录

2026-11-05。合并已由监督者通过；本次已授权的单次南京键盘缺口审计、小修和定点自验已完成。旧全旅程goal保持暂停，只有走路卡顿性能排查继续暂停；常规接续及现有20分钟监工循环无需重复请用户确认，本次未修改调度。完成当前任务即停，下一步仅等监督者复验，不扩场景。

- 修复所有对话/菜单的方向选择、Enter/Space确认、Esc返回，保留Tab/ShiftTab及E/Q/M、头部气泡。确认键按下/松开隔离，忽略重复键；鼠标保留短双击保护，合法新键盘确认不再被180ms保护吞掉。
- 普通确认页返回原选项与坐姿锚点；手册从暂停进入后返回暂停。必选剧情/存档按Esc可暂停，继续回原选项；此时手册/重玩禁用，避免丢失待确认进度。修复初始body焦点无效返回；实际标签失焦清键、返回焦点已检查。
- `node games/career-rpg/web/tests/browser.mjs --keyboard-acceptance --evidence=final`：桌面Chrome156.0.8078.79、1280×900、headless/software WebGL，16项定点通过。使用可信CDP键盘事件及实际标签切换，零指针输入；合法存档检查点/存储失败是测试夹具，不直接调用剧情变更函数。没有重跑无关整章或性能。
- `python3 scripts/verify.py`：13组通过，含游戏15项离线规则；`git diff --check`通过。六张同版本菜单/气泡截图已用view_image审阅，选中项和文字可见；375/560/700为桌面缩窄预览，375 DPR2为模拟，不代表真机。
- 16份PNG美术校验一致，未重画或改图集。world/story/scene-config/actors、章节数据和vendor保持不变。

证据：[键盘摘要](./web/review/keyboard-acceptance/summary.json)、[逐项操作与可信事件](./web/review/keyboard-acceptance/final-checks.json)、[Web交接](./web/handoff.md)。失败复现及修复过程保留在同目录，不用旧通过记录覆盖新版本。worker状态为`ready_for_review`，scene=`nanjing-office`、stage=`keyboard-acceptance`；只表示本次自验可复核，监督者尚未签本次通过，不授权下个场景。

仍未验证：桌面Safari/真实iOS和Android、真人完整无鼠标体验与连续录屏、最新坐姿/气泡完整美术、作者/至少3人试玩、真实阅读时长、真机性能及正式发布。走路仍卡未解决且没有追加性能测量；原史实缺口继续保留。不因本次键盘专项通过降低场景门禁。

## 已通过的合并记录（历史阶段）

2026-11-05。唯一后续工作目录为 `/Users/bytedance/work/AI/zwhu.github.io`。本次从只读源 `/Users/bytedance/.codex/worktrees/0f28/zwhu.github.io` 合并完整子项目；源聊天为“设计博客小游戏展示方案 (2)”，ID `01a1a5d7-c6c8-7373-9bde-a03ae9040255`。源 HEAD `dfa162878415287377e087ed2e2f4310976cc787`，目标 HEAD `1a1edf8c143b009b02dc215f89fcc41aff09821f`，两侧均有未提交工作，未提交或改写 HEAD。

南京已有七状态主线、原子存档与15种合法配置、四向站立／行走、CTO与两位同伴、正常／紧张／开心、四人两帧坐姿打字、五工位背景、头部气泡与黄色任务标记。运行代码、正式素材、原图、提示词、review证据、设计、维护脚本／测试及历史交接已完整复制；没有重画、重做南京或修改运行行为。源检查无符号链接，排除唯一 Python 缓存，不导入无关 `social-media-redacted.png`。

**走路仍卡：未解决，按用户要求暂停处理。** 不以历史步态检查、软件WebGL或本次静态测试通过覆盖作者反馈。全键盘专项仍待验，新增“所有选项方向键选择、Enter确认”的要求已合入规格；保留Tab/ShiftTab、E/Q/M、Space和头部气泡。最新坐姿／气泡等最终视觉仍待验。cold/warm文件作为原始证据迁入，本次不分析、不补测，不恢复任何旧进程或session。

| 合并检查 | 当前结果与证据 |
| --- | --- |
| 可恢复备份 | `/private/tmp/traex-career-rpg-supervisor/merge-backup-20261105/`，含目标相关文件、两侧status/diff/HEAD与SHA256清单 |
| 成品基准 | 七张指定图已用view_image打开；[美术规范](./art/style-guide.md)改为已实现版本，旧概念仅辅助；不据此宣称最终视觉通过 |
| 历史保留 | 源原始重叠文档逐字备份于 `history/merge-source-2026-11-05/`；源已有history及全部review复制保留；目标误基线inventory/preflight标过期，NJ-CHAR-001标superseded |
| 代码与美术SHA256 | 源子项目88个非Markdown文件全部与目标一致，根verify也与源一致；[SHA256清单](./review/merge-2026-11-05/sha256-check.json)逐项记录。8份源文档合并调整单列，源文件／status与两侧HEAD未变 |
| 根verify及生成副本 | `python3 scripts/render-site.py`：64页面公共区块、SEO和sitemap无变化，仅同步验证说明副本；`python3 scripts/verify.py`：13组通过，含游戏15项离线规则；`git diff --check`通过。日志见 [verify.log](./review/merge-2026-11-05/verify.log)，不代表游戏全部验收 |
| 本次浏览器与性能 | 未执行；没有行为变更，用户禁止借合并重开卡顿排查或整章复测 |

唯一下一步：监督者核对 [合并摘要](./review/merge-2026-11-05/summary.json) 与成果。合并自验完成即停，status为 `ready_for_review` 只表示合并结果可核对，不表示游戏全部验收通过。旧全旅程目标保持暂停。用户恢复后才能接续南京未验项；当期必验项失败或未验证不得进入下一场景，监督者明确通过版本并另行授权后才可扩展。

质量高于速度，后续同时只制作一个场景。恢复制作后每20分钟巡检且每次报告，无变化也报告；当前不新增巡检或后台研发任务。作者对最新表现与经历表达、真实iOS/Android、其他端、真机性能、真人试玩及正式发布仍按验收方案独立执行，不能代签。南京根因、代码／排查细节、原话、真实布局及恢复画面继续保留缺口，不编造。

## 合并前源交接历史（原结论按版本追溯，任务与进程不可直接续跑）

以下完整保留源记录；其中早期“未实现”“静态正面”“下一步排查／绘图”或旧session不覆盖上面的当前停止点。原文件另存于 `history/merge-source-2026-11-05/handoff.md`。

## 当前停止点：走路仍卡，按作者要求后续再处理

2026-11-05，作者实际体验“走路还是很卡”，明确要求不要继续消耗token，后面再说。已中断代码Agent，不追加性能排查、测试或绘图。走路卡顿保持**未解决、暂停处理**，不能以此前自动检查通过覆盖作者反馈。

保留现有步态修改（4槽/秒、统一尺寸锚点）、任务感叹号（30px、墨描边、1.4秒上下浮动）及绿衣同事名「费翔🐘」。已有证据walk-cadence-check.json、task-marker-check.json和task-marker-visible.png仅证明对应检查，不证明移动流畅。cold/warm测量session58486刚启动，结果未确认；恢复前先确认进程/文件状态，不把它写成完成。全键盘专项仍待验。HTTP服务可保留，其他在途测量应停止。

下一步等待作者明确恢复，不自动续跑或重做整套验证；届时从web/handoff.md及已有测量证据接续。

## 最新试玩反馈：任务感叹号不醒目

用户截图指出黄色感叹号贴在桌面便签处、大小和对比不足，要求上下移动。已委派代码Agent调整共享marker：放到电脑上方、增大亮黄色深描边、缓慢上下浮动，reduce-motion时停浮动；接受任务才消失的规则不变。该项属UI代码，不新增图像生成。与步态修复、首次移动卡顿测量和费翔🐘命名一起收敛，按小修后定点验收，不重复整章全测。最新代码/检查进度见web/handoff.md。

## 最新补充：绿衣同事身份与首次走动卡顿

2026-11-05，作者指定绿衣同事显示名为「费翔🐘」，已补规格，代码Agent将统一角色名/提示/气泡及测试，不扩写真实对白。

用户另反馈第一次走动卡、后续走动顺畅。仍是未定位问题：代码Agent先测刷新后首次移动与warm移动帧耗时，保留修前数据，再区分GPU首用、图集/纹理处理和输入/物理tick问题；不能把推测或headless软件GL结果当成用户真机根因。原步态4姿态槽/秒和统一锚点修复仍在推进；完整键盘专项未全通过保持待验。下一步只收敛步态与首次走动问题，不开新场景。

## 当前优先修复：走路小腿抖动过快

2026-11-05，用户实际试玩反馈步态小腿抖动频繁。已交代码Agent优先检查步态切换频率及逐帧alpha裁切缩放是否造成抖动；保持移动速度，放慢/平滑步态并保留松键立即站立。全键盘专项已有进展但尚未完全通过，先落盘，不以此阻塞本次小修。下一步等待针对性帧时序和实际Web移动复验结果，不重跑不受影响的整章。

更新：2026-11-05。当前阶段：南京 Web 样章的共用场景表现升级；先完成本交接，不启动后续场景绘图。

本轮交接整理已完成，`python3 scripts/verify.py` 13组通过、`git diff --check` 通过。该结论不补写尚未完成的视觉或全键盘验收。

## 接手先看

1. 本文件说明当前结论与下一步；代码细节和在途检查以 [Web 交接](./web/handoff.md) 最新段落为准。
2. [规格](./spec.md) 保存真实经历及目标，[验收方案](./acceptance.md) 保存各阶段门禁，[AGENTS](./AGENTS.md) 保存分工与共用规则。
3. 查看 `git status`，保留无关修改。已有 `social-media-redacted.png` 不属于本任务。不要因旧记录出现“尚未实现”而重做已有内容。
4. [历史交接](./history/handoff-before-scene-upgrade-2026-11-05.md) 仅供追溯，不沿用其中已过期的任务状态、服务进程或下一步。

## 已确认的决定

- 博客工程内独立子项目 `games/career-rpg/`，Three.js 加简单引擎，先桌面 Web 跑通，其他端后验收。暂不公开发布到博客。
- 作者明确分工：Codex 负责绘图、协调及最终审阅，其他 Agent 负责代码、自检与逐步代码交接。当前代码 Agent 为 `web_prototype`。
- 要节省的是 Codex 监工用量：看摘要、失败项并最终抽验，避免反复通读与重复测试。每完成一步、长调用开始前或出现阻塞时落盘。
- 用户已验收上一版单房间 Web 原型；完整南京主线已做过技术验收。最近新增的表现要求尚待本轮最终视觉核对，不沿用旧验收结论。
- 首个样章为南京首次上线事故；人生主线仍为合肥→南京→杭州、自我进化。事故根因、年份和真人外观不编造，演出指令不进入玩家正文。

## 所有后续场景遵守

1. 对话气泡靠近发言人物头部，跟随锚点并避让边界；暂停、存档异常等系统确认可用常规弹层。
2. 四向站立与行走帧匹配移动方向，停下回站立；不以正面图平移代替行走。
3. 关键人物和同伴实际在场且可接近交互。办公场景形成多工位及连通走道。
4. 电脑旁以黄色感叹号提示可接任务，真正接取后消失；靠近或预览不误消失，刷新和重玩正确恢复。
5. 紧张、开心等情绪要在角色附近或对话画像中可见，按剧情变化。
6. 办公人物有坐电脑前打字姿态和动画，手部、椅子、桌面位置及遮挡合理，交互切换不穿桌。
7. 所有核心操作可仅用键盘完成：移动、切换近处对象、交互、选项、推进与关闭对话、手册、暂停/继续、重玩及存档提示。按键提示、可见焦点、焦点恢复和防误移动一起验。

第7项已同步规格与验收方案，完整无鼠标流程仍需专项实测，不能以已有移动快捷键检查代替。

## 当前实现和代码进度

| 项目 | 当前结论 | 证据或路径 |
| --- | --- | --- |
| 南京七状态主线 | 已实现；论坛→事故→排查→恢复→补测试/注释→手册完成 | `web/story.mjs`、`design/chapter-01.json` |
| 存档与恢复 | 原子保存、15种合法配置、只读重复、损坏/旧存档保留与提示已做回归 | `web/tests/`、`web/review/chapter-checks.json` |
| 共用场景能力 | 已接入场景配置、角色图集、头部气泡、任务标记、情绪和坐姿接口 | `web/scene-config.mjs`、`web/actors.mjs`、`web/main.mjs` |
| 新背景与角色 | 五桌背景、四向行走、3位NPC、3种情绪、4人两帧打字已交代码Agent并接入 | 见下表 |
| 本轮检查 | Agent报告完整章14项、根verify13组通过；新增表现专项仍在收尾 | 最新进度以 `web/handoff.md` 为准 |
| 最终画面与全键盘 | 尚待最终审阅及无鼠标完整流程证据 | 不标作者验收通过 |

代码 Agent 正完成新增表现专项，已知首轮打字单点采样恰好落同帧，已改多次短采样复验；这不是已证明的动画故障。曾报告浏览器 session22833 为完整章回归，之后专项 session 若有变化，读 Web 交接，不重启旧任务。根handoff由Codex维护，Web交接由代码Agent维护，避免覆盖。

## 已交付美术

运行素材在 `web/art/`，完整生成提示词在 `art/`，均由 Codex 使用内置 imagegen 制作。

| 素材 | 排布与用途 | 提示词 |
| --- | --- | --- |
| `office-room-v2.png` | 16:9，5工位，无烘焙人物，逻辑空间384×216 | `art/web-room-v2-prompt.txt` |
| `player-walk-v1.png` | 3列×4行；行down/up/left/right，列idle/步态A/步态B | `art/player-walk-v1-prompt.txt` |
| `npc-team-v1.png` | 3列；眼镜蓝灰外套CTO、绿衣伙伴、米衣伙伴 | `art/npc-team-v1-prompt.txt` |
| `player-emotions-v1.png` | 3列头像；正常、紧张、开心 | `art/player-emotions-v1-prompt.txt` |
| `typing-team-v1.png` | 4列主角/CTO/绿衣/米衣，2行打字A/B；背向电脑坐姿 | `art/typing-team-v1-prompt.txt` |

各图已审造型与排列，图集存在不等于游戏内表现通过。运行时逐格读取alpha包围并统一脚底；坐姿约34逻辑像素，站姿约44，需按真实截图校准。保留原图，不将渲染裁取冒充精确16×24/12色生产素材。

人物基准为 `art/character-front-v1.png` 与 `art/character-four-directions-v1.png`。旧 `art/grid-sample-v1/` 只证明早期导出方式，作者认为不好看，不能重新当作正式人物方向。

## 本地启动和证据

- 试玩：`http://127.0.0.1:8765/games/career-rpg/web/`。
- 最近已确认服务session51993；恢复工作时先确认HTTP可访问，进程号不保证跨会话有效。
- 仓库根启动：`python3 -u -m http.server 8765 --bind 127.0.0.1`。本机监听可能需要已批准权限，必须看到Serving输出并确认HTTP200，不能把空输出当服务成功。
- 浏览器验收脚本：`node games/career-rpg/web/tests/browser.mjs`，具体模式见 `web/README.md`；Chrome启动需本机进程权限，勿重复发审批后空等。
- 全仓：`python3 scripts/verify.py`，当前13组，含游戏离线逻辑。浏览器检查独立执行，verify不证明视觉或设备表现。
- 审阅材料统一 `web/review/`。旧基线 `desktop-*`、完整章 `chapter-*`、共用表现 `shared-*` 分开识别，最新专项结果以文件及Web交接为准。

## 当前范围未验证

本轮最终视觉、全键盘完整流程仍待验；移动端、其他端、真机性能、真人阅读时长和正式发布也未验。Chrome软件WebGL或合成blur检查不能替代这些结论。作者只在对应阶段Agent自验通过后验收个人表达、风格和体验。

## 唯一下一步与后续顺序

当前先完成本交接。恢复研发后：读取代码Agent专项结果→核对场景截图/坐姿/气泡/任务标记→完成真实全键盘流程→修复失败项并留下证据→提交作者试玩。不启动第二套重复检查，不以新画图掩盖已知运行问题。

南京本轮稳定后，再梳理其他场景的人物和动作并绘图，暂不并行写其他章节代码。候选仅供制作规划，不扩写成未经用户确认的史实：

| 场景 | 可复用 | 可能新增人物/动作 |
| --- | --- | --- |
| 合肥宿舍/Dota | 主角、电脑、坐姿 | 宿舍环境、专注/懊恼表情、游戏操作姿态 |
| 安风徳求职与入职 | 办公工位、对话 | 老板造型、面谈/递资料、技术书阅读 |
| 南京深夜学习 | 主角、打字、书本 | 台灯夜景、阅读翻页、思考与困倦 |
| 天猫双11 | 工位、团队角色机制 | TL造型、背靠背双人排查、疲惫/紧张到释然 |
| 浙里办 | 手机、对话机制 | 居民/家长场景、手机办事操作；个人贡献不过度放大 |
| 菜鸟现场 | 主角、多人交互 | 驿站老板、货筐包裹、扫码/拍照/搬筐/送货动作 |
| 字节/AI与Blogflow | 主角、电脑与学习动作 | 性能观察、AI交互与验证的可视化道具，按实际玩法再定 |

先列缺口和优先级，再画一组代表样张，审过风格后扩展，不一次批量生成全部人物与动作。
