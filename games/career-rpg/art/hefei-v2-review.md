# 合肥章节美术 v2 自审（候选，待制作人审阅）

日期：2026-11-05（UTC+8）。状态：`candidate_pending_producer_review`。
依据：制作人对 v1 的审阅意见（1~8 条 + 新增交互卡），以及 `acceptance.md` 中的 ART-05/07/09/10、`design/chapter-hefei.md` 中的 HF-ART-01~04。
约束执行情况：v1 没有被覆盖（`art/*/hefei-v1/`、`overview.png`、`art/hefei-v1-review.md` 的修改时间都早于 v2，8 个 v1 记录哈希复核一致）；没有写游戏代码，没有改仓库，没有发任何消息。所有产物都在盒子上的 `/workspace/career-rpg-hefei-art/`。每张输出图都用 Read 打开核对过。

**总的说明：以下“通过”都是静态自验（看图 + 脚本测量）。还没有做实机截图验收，也没有做 GPU 观测。**

## 0. 设定标注（按制作人要求，这些不改）
- 窗外楼群和电视塔：**设定**（合肥城市识别）。
- 办公室布局（左上两张、左下两张工位，中间老板桌，右侧书架、饮水机、地毯）：**设定**。
- 书封面（Java 卡片的几何图案、前端书封的条纹）：**设定**，不对应任何真实出版物。
- 老板外貌（棕色夹克、奶白衬衫、深色短发、无眼镜）：**设定**。
- 不做昼夜过渡；不做“说话”表情。

## 1. 南京基准测量（先测量，再处理）
脚本：`tools/v2/measure_ref.py`，结果在 `tools/v2/measure_ref.json`。alpha 阈值 128；头部按“颈部最窄行”切分。
- `player-walk-v1`（3×4，单元 362）：角色高约 309–310，foot_y = 343（脚底下沿 344/362 = **0.95**），头身比 0.345–0.356。
- `npc-team-v1`（3×1，单元 724）：高 654（第 3 列 637），foot_y = 688（689/724 = **0.95**），头身比 **0.356 / 0.356 / 0.364**。
- `scene-config.mjs`：逻辑空间 384×216，角色运行高度 44 / 44 / 42。
- 注意：南京 player 表本身也不在格心上。各列 body_cx 是 215.9 / 182.5 / 146.6，而格心是 181，也就是每列约偏 ±34 源像素。v2 没有照搬这个偏移，而是统一对齐到身体轴 x = 16。

## 2. 共享色板与量化方法（ART-05）
- 提取：`tools/v2/extract_palette.py`，结果 `art/palette/nanjing-extract.json`，共 **34 色**。
  - 来源：office-room-v2、player-walk-v1、npc-team-v1、player-emotions-v1、typing-team-v1。
  - 每张素材取 6 万个不透明像素（丢弃近白底色），做 k-means（K = 96，seed 20261105）。
  - 每个质心吸附到其簇内实际出现最多的真实颜色（4 级分箱），再合并近似色（加权 RGB 距离 < 9，保留像素更多的那个）。
- 共享色板：`tools/v2/build_palette.py` 生成 `art/palette/hefei-v2-shared.{json,gpl,png}` 和 `-x24.png`，共 **125 色**。
  - nanjing 34 色。
  - ui 3 色：#FFD640、#E8A818、#FFF4C0，只给 “!” 标记和高亮框用。
  - night 88 色：由 34 色经夜景变换得到，定义在 `common.py` 的 NIGHT_FN。变换公式：COOL = [0.55, 0.62, 0.90]，暗处 COOL·(4+0.46c)，溢光 COOL·(8+0.62c)；WARM = [1, 0.95, 0.84]，灯池 WARM·(8+0.78c)；灯芯保持日景色。距离 < 4 的颜色合并。
- 量化流程，即“真逻辑像素”的做法：
  1. 抠图。
  2. 按目标逻辑尺寸切块。
  3. 每块先映射到色板索引，再取众数（mode downsample）；不透明像素超过 50% 的块才算不透明。
  4. 清理（`cleanup`）：去孤立像素、补洞、去斑点，并把亮色边缘像素强制改为描边色。
  5. 输出逻辑尺寸的 PNG。
  6. 放大图一律用整数倍 NEAREST 由逻辑图生成。42/42 张放大图经 `is_integer_upscale` 逐像素校验，全部一致。
  - 老板和表情只使用色板中的 23 色子集 FOUNDER_HEX（见 `tools/v2/process_founder_pal.py`）。
  - alpha 只有 0 或 255。
- 量化前后同尺度对照：`art/processed/hefei-v2/compare/quantize-before-after-x4.png`。
  - 老板 idle：619 色 → 15 色。
  - 场景 my_pc 区域：3657 色 → 29 色。
  - DB 卡片：5989 色 → 19 色。
  - 脸、发型、轮廓、衣色都保留了。DB 屏幕原来的深蓝底变成了灰米色，因为色板里没有藏青色。这一点见第 7 节。

### 各素材颜色数（`art/processed/hefei-v2/verify-v2.json`）
| 素材 | 逻辑尺寸 | 颜色数 | 所用色板 | 全部在色板内 | alpha 取值 |
|---|---|---|---|---|---|
| `hefei-founder-walk/walk-sheet-32x48.png` | 96×192 | 20 | founder subset 23 | 是 | [0, 255] |
| `hefei-founder-walk/walk-sheet-48x48.png` | 144×192 | 20 | founder subset 23 | 是 | [0, 255] |
| `hefei-office-day/day-384x216.png` | 384×216 | 34 | nanjing 34 | 是 | [255] |
| `hefei-office-night/night-384x216.png` | 384×216 | 67 | shared 125 | 是 | [255] |
| `hefei-founder-emotions/doubtful-32.png` | 32×32 | 10 | founder subset 23 | 是 | [0, 255] |
| `hefei-founder-emotions/approving-32.png` | 32×32 | 9 | founder subset 23 | 是 | [0, 255] |
| `hefei-founder-emotions/emotions-strip-64x32.png` | 64×32 | 10 | founder subset 23 | 是 | [0, 255] |
| `hefei-marker/marker-7x16.png` | 7×16 | 4 | shared 125 (ui+outline) | 是 | [0, 255] |
| `hefei-props/linux-git-screen/icon.png` | 28×25 | 8 | nanjing 34 | 是 | [0, 255] |
| `hefei-props/linux-git-screen/icon-highlight.png` | 28×25 | 9 | shared 125 | 是 | [0, 255] |
| `hefei-props/linux-git-screen/card-192.png` | 192×172 | 19 | nanjing 34 | 是 | [0, 255] |
| `hefei-props/frontend-jquery/icon.png` | 34×29 | 13 | nanjing 34 | 是 | [0, 255] |
| `hefei-props/frontend-jquery/icon-highlight.png` | 34×29 | 14 | shared 125 | 是 | [0, 255] |
| `hefei-props/frontend-jquery/card-192.png` | 192×158 | 22 | nanjing 34 | 是 | [0, 255] |
| `hefei-props/java-book/icon.png` | 17×18 | 6 | nanjing 34 | 是 | [0, 255] |
| `hefei-props/java-book/icon-highlight.png` | 17×18 | 7 | shared 125 | 是 | [0, 255] |
| `hefei-props/java-book/card-192.png` | 192×236 | 9 | nanjing 34 | 是 | [0, 255] |
| `hefei-props/db-nosql-screen/icon.png` | 32×24 | 5 | nanjing 34 | 是 | [0, 255] |
| `hefei-props/db-nosql-screen/icon-highlight.png` | 32×24 | 6 | shared 125 | 是 | [0, 255] |
| `hefei-props/db-nosql-screen/card-192.png` | 192×138 | 18 | nanjing 34 | 是 | [0, 255] |

## 3. 制作人 1~8 条逐条自验

**1. 老板朝右一行：通过（静态）**
- 朝右一行是单独生成的，没有用左行镜像。
- 对照图：`compare/right-row-vs-mirrored-left-x6.png`，上排是左行水平镜像，下排是实际的朝右行。
- 与镜像左行逐像素比较，相同像素只占 67% / 63% / 65%（真镜像应为 100%），alpha IoU 为 0.98 / 0.92 / 0.96。
- 夹克开襟和拉链在前进方向（右侧，胸前）。
- 第 B 步头顶有一个肤色杂点，已手修，见 `tools/v2/hand_edits_founder.log.json`。

**2. 头身比：通过**
- 统一用 `measure_ref.measure` 测量。
- 老板：正面 0.341（44 px 高时头 15 px），侧面 0.349–0.372（16 px），背面 0.326–0.349。
- 南京 npc 为 0.356（15.7 px），player 为 0.345。差距都在 ±1 逻辑像素以内。
- 同尺度对照图：`compare/head-ratio-vs-nanjing.png`。老板按真 ×6 放大（44 → 264），南京参考按 LANCZOS 缩到同一高度，只用于对照。

**3. 32×48 运行精灵：通过（静态）**
- 文件：`hefei-founder-walk/walk-sheet-32x48.png`（96×192，3×4），另有 ×4 / ×8 版；还有 48×48 单元的版本。
- 清理前的版本保留为 `walk-sheet-32x48-before-cleanup*.png`。
- 描边干净，斑点已去除。
- 所有 12 帧身体轴 body_cx 在 15.1–16.0，以 x = 16 为准。
- 所有 12 帧脚底行都是 y = 45，下沿 46/48 = 0.958。南京是 0.95，换算到 48 高是 45.6，取整为 46。
- 角色高度：正面 44，背面 42–43，侧面 43。

**4. Java 封面：通过**
- 封面按程序重画：红色封面、深色书脊，奶白标题块里是 5×7 像素字 “Java”（×3），下面三排阶梯三角（奶白 / 橙 / 奶白），底部是书页块。
- 没有咖啡杯，也没有任何类似 Oracle 的图形。
- 场景内的小图标手绘，13×14，外加 2 px 边距。
- 4 件物品的卡片、图标和高亮版都已按 ×4 逐张检查，没有发现 logo、吉祥物或像商标的形状：
  - Linux 屏幕：没有企鹅，git 分支图重画成两条泳道。
  - 前端：没有 jQuery 标志，书封是条纹。
  - DB：表格加 `{ }` 和圆柱，不是任何品牌形状。

**5. ART-05 真逻辑像素和共享色板：通过（静态）**
- 方法见第 2 节，色板文件在 `art/palette/`。
- 全部 20 个运行素材的颜色都在各自色板内，alpha 只有 0 或 255。

**6. ART-10 无损 WebP：完成文件、解码字节和往返校验；GPU 未观测**
- 每个运行 PNG 旁边都有同名 `.webp`，参数：lossless、exact、method 6。
- 解码后的 RGBA 与 PNG 逐像素一致，全部 39 个文件都校验过。
- 量化前后对照见第 2 节。数据表见第 5 节。

**7. 黄色 “!” 标记：通过（静态）**
- **日景和夜景底图都不含 “!”，也不含 UI 黄色。** `process_scene.log.json` 中 day_has_ui_yellow = False。这个标记应由引擎在运行时叠加。
- 独立精灵：`hefei-marker/marker-7x16.png`，4 色：#221E1A 描边、#FFD640 主色、#E8A818 暗部、#FFF4C0 高光。另有 ×3 / ×4 / ×8 版。
- 示意图：`mock-day/night-384x216(-x4).png`、`mock-day/night-closeup-x8.png`。标记放在 my_pc（左上组第一张工位）显示器上方，锚点在底边中点 (46.5, 49)，精灵左上角在 (43, 33)。显示器顶 y = 50，x 范围 34–59。参数见 `marker.json`。

**8. 夜景地毯：通过**
- 地毯内区 (323,89)–(366,114) 中的非绿色杂点改为地毯底色，共 121 px。
- 夜景中地毯不是纯黑，外轮廓和内圈都看得见。
- 夜景地板纹理也保留了：夜景变换提高了对比度，合并阈值改为 < 4。

**新增：4 件物品的 192 宽交互卡：通过（静态）**
- `hefei-props/<name>/card-192.png`，另有 ×4 版。尺寸分别为：git 192×172，frontend 192×158，java 192×236，db 192×138。
- 全部在色板内，没有商标。
- 每件物品还有场景小图标（icon，另有 ×4 / ×8）和高亮版（icon-highlight：1 px #FFD640 内框加 1 px #221E1A 外框，另有 ×4 / ×8）。
- 场景内小图标只要求能认出来，所以细节较少。

**表情（附带）**
- 从 v1 表情原图重新处理：先检测原图的像素网格（间距 18.85 源像素，相位用暴力搜索取块内方差最小），得到 23×30 网格，放在 32×32 单元中。
- 五官在 1 px 级别会丢失，所以手绘修复，说明见 `process_emotions.log.json` 的 hand_edits：
  - doubtful：右眉上挑、斜眼、歪嘴。
  - approving：弯眼、微笑。
- 手修前的版本保留为 `*-before-hand-edit.png`。
- 用 32×32 而不是 48 的单元，是为了保持真逻辑像素。如果引擎要求 48 单元，需要另外定一个放置规则。

## 4. HF-ART-01~04 与 ART-05/07/09/10
- **HF-ART-01**（日景同尺度同风格，城市可辨）：静态通过。
  - 384×216，34 色，完全使用南京色板。
  - 窗外楼群和电视塔是设定。
  - 同尺度示意图：`compare/scale-mock-day-384x216(-x4).png`。
  - **还没做与南京同尺度的实机截图，也没有作者确认。**
- **HF-ART-02**（夜景中主角、屏幕、提示清楚）：静态通过。
  - 夜景 67 色；my_pc 屏幕发亮，有暖色灯池；“!” 标记的夜景示意清楚，地毯没有塌成黑色。
  - 示意图里的角色没有做夜间着色。
  - **还没做昼夜实机截图。**
- **HF-ART-03**（老板四向一致、可区分、外貌标为设定）：静态通过。
  - 四向一致，朝右行是单独生成的。棕夹克在同屏中与主角和同事都能区分（见 scale-mock）。外貌已标为设定。
  - **还没做实机截图。**
- **HF-ART-04**（新物件可辨、高亮清楚）：静态通过。
  - 4 件物品的场景图标和高亮版都能辨认，交互卡也清楚。
  - 验收表中还提到“笔记”，但这次的 4 件物品里没有笔记。如果需要，要另外补做。
  - **还没做实机逐件核对。**
- **ART-05**（严格按网格，帧尺寸、锚点、透明边一致，不渗色）：静态通过。
  - 都是真逻辑像素；帧尺寸统一 32×48；脚底 y = 45；身体轴 16；alpha 只有 0 或 255；共享色板。
  - 但素材来源仍是 AI 生成后再量化，再加少量手修，不是像素画师从零逐像素绘制。
- **ART-07**（南京成品一致性）：静态对照通过，包括头身比、描边色、色板、家具尺度、脚底比例。
  - **还没有同版本实机截图。**
- **ART-09**（可追溯）：满足。
  - 新原图都保留了交付 JPEG（original-as-delivered.jpg）和无损 original.png，以及 prompt.txt、generate-call.json（实际传入的参考图路径）和 record.json。
  - 日景、夜景、表情没有新原图，复用 v1 原图，在记录里写明哈希。
  - 每个处理目录都有 record.json，内容包括：输入/输出哈希、脚本、色板哈希、单元尺寸、锚点、处理日志、手修日志、校验结果。
- **ART-10**（压缩视觉与资源）：部分完成。
  - 已完成：无损 WebP、文件大小、解码缓冲字节、RGBA 往返一致、量化前后同尺度对照。
  - 未做：**GPU 观测**（需要在浏览器里实际运行）。
  - 结论不是根据“文件变小”得出的。

## 5. ART-10 数据：PNG 和无损 WebP 对比（解码字节 = w×h×4）
| 文件 | 尺寸 | PNG 字节 | WebP 字节 | 解码 RGBA 字节 (w×h×4) | RGBA 往返一致 |
|---|---|---|---|---|---|
| `hefei-founder-walk/walk-sheet-32x48.png` | 96×192 | 6221 | 2302 | 73728 | 是 |
| `hefei-founder-walk/walk-sheet-32x48-x4.png` | 384×768 | 11389 | 3646 | 1179648 | 是 |
| `hefei-founder-walk/walk-sheet-48x48.png` | 144×192 | 6580 | 2326 | 110592 | 是 |
| `hefei-founder-walk/walk-sheet-48x48-x4.png` | 576×768 | 12215 | 3812 | 1769472 | 是 |
| `hefei-office-day/day-384x216.png` | 384×216 | 17724 | 6962 | 331776 | 是 |
| `hefei-office-day/day-384x216-x4.png` | 1536×864 | 31535 | 11132 | 5308416 | 是 |
| `hefei-office-night/night-384x216.png` | 384×216 | 18433 | 7018 | 331776 | 是 |
| `hefei-office-night/night-384x216-x4.png` | 1536×864 | 32698 | 10980 | 5308416 | 是 |
| `hefei-founder-emotions/doubtful-32.png` | 32×32 | 636 | 268 | 4096 | 是 |
| `hefei-founder-emotions/doubtful-32-x4.png` | 128×128 | 1075 | 362 | 65536 | 是 |
| `hefei-founder-emotions/approving-32.png` | 32×32 | 672 | 260 | 4096 | 是 |
| `hefei-founder-emotions/approving-32-x4.png` | 128×128 | 1046 | 350 | 65536 | 是 |
| `hefei-founder-emotions/emotions-strip-64x32.png` | 64×32 | 856 | 364 | 8192 | 是 |
| `hefei-marker/marker-7x16.png` | 7×16 | 162 | 86 | 448 | 是 |
| `hefei-marker/marker-7x16-x4.png` | 28×64 | 258 | 120 | 7168 | 是 |
| `hefei-props/linux-git-screen/icon.png` | 28×25 | 344 | 152 | 2800 | 是 |
| `hefei-props/linux-git-screen/icon-x4.png` | 112×100 | 622 | 192 | 44800 | 是 |
| `hefei-props/linux-git-screen/icon-highlight.png` | 28×25 | 403 | 170 | 2800 | 是 |
| `hefei-props/linux-git-screen/icon-highlight-x4.png` | 112×100 | 730 | 214 | 44800 | 是 |
| `hefei-props/linux-git-screen/card-192.png` | 192×172 | 4832 | 1872 | 132096 | 是 |
| `hefei-props/linux-git-screen/card-192-x4.png` | 768×688 | 10342 | 2954 | 2113536 | 是 |
| `hefei-props/frontend-jquery/icon.png` | 34×29 | 501 | 222 | 3944 | 是 |
| `hefei-props/frontend-jquery/icon-x4.png` | 136×116 | 836 | 280 | 63104 | 是 |
| `hefei-props/frontend-jquery/icon-highlight.png` | 34×29 | 572 | 260 | 3944 | 是 |
| `hefei-props/frontend-jquery/icon-highlight-x4.png` | 136×116 | 967 | 324 | 63104 | 是 |
| `hefei-props/frontend-jquery/card-192.png` | 192×158 | 4499 | 1654 | 121344 | 是 |
| `hefei-props/frontend-jquery/card-192-x4.png` | 768×632 | 9636 | 2502 | 1941504 | 是 |
| `hefei-props/java-book/icon.png` | 17×18 | 209 | 104 | 1224 | 是 |
| `hefei-props/java-book/icon-x4.png` | 68×72 | 375 | 118 | 19584 | 是 |
| `hefei-props/java-book/icon-highlight.png` | 17×18 | 267 | 118 | 1224 | 是 |
| `hefei-props/java-book/icon-highlight-x4.png` | 68×72 | 453 | 146 | 19584 | 是 |
| `hefei-props/java-book/card-192.png` | 192×236 | 1444 | 350 | 181248 | 是 |
| `hefei-props/java-book/card-192-x4.png` | 768×944 | 6208 | 594 | 2899968 | 是 |
| `hefei-props/db-nosql-screen/icon.png` | 32×24 | 355 | 146 | 3072 | 是 |
| `hefei-props/db-nosql-screen/icon-x4.png` | 128×96 | 633 | 188 | 49152 | 是 |
| `hefei-props/db-nosql-screen/icon-highlight.png` | 32×24 | 450 | 180 | 3072 | 是 |
| `hefei-props/db-nosql-screen/icon-highlight-x4.png` | 128×96 | 766 | 234 | 49152 | 是 |
| `hefei-props/db-nosql-screen/card-192.png` | 192×138 | 3640 | 1240 | 105984 | 是 |
| `hefei-props/db-nosql-screen/card-192-x4.png` | 768×552 | 7773 | 1862 | 1695744 | 是 |
| 合计 | | 198357 | 66064 | | |

合计：PNG 198357 字节，WebP 66064 字节。GPU 观测：未测。

## 6. 文件路径
- 新生成原图：
  - `art/source/hefei-v2/hefei-founder-walk/`：original.png（864×1152）、original-as-delivered.jpg、prompt.txt、generate-call.json、record.json。
  - `art/source/hefei-v2/hefei-props/`：original.png（1024×1024），其余文件同上。
- 色板：`art/palette/nanjing-extract.json`、`hefei-v2-shared.json/.gpl/.png/-x24.png`。
- 运行候选：
  - `art/processed/hefei-v2/hefei-founder-walk/`
  - `hefei-office-day/`
  - `hefei-office-night/`（含 light-mask）
  - `hefei-marker/`
  - `hefei-founder-emotions/`
  - `hefei-props/{linux-git-screen,frontend-jquery,java-book,db-nosql-screen}/`
  - 每个目录都有 record.json，每个运行 PNG 旁边都有 .webp。
- 对照图：`art/processed/hefei-v2/compare/`
  - head-ratio-vs-nanjing.png
  - right-row-vs-mirrored-left-x6.png
  - quantize-before-after-x4.png
  - scale-mock-day/night-384x216(-x4).png
  - compare.json、founder-measure.json、scale-mock.json
- 校验汇总：`art/processed/hefei-v2/verify-v2.json`。
- 脚本：`tools/v2/*.py`。
  - 依次运行：build_palette → process_founder → hand_edits_founder → process_scene → process_props → make_marker → process_emotions → make_compare → make_scale_mock → verify_v2 → make_records → make_overview。
  - 各步日志在 `tools/v2/*.log.json`。
- 总览图：`overview-v2.png`（1640×3975）。

## 7. 还需要人工处理
1. 实机验收：HF-ART-01~04 和 ART-07 需要同版本实机截图，HF-ART-01 还需要作者确认。
2. GPU 观测（ART-10）：需要在浏览器里加载素材，看显存或纹理占用。
3. 像素精修：素材是 AI 原图量化后再加少量手修。建议像素画师重点看这几处：老板侧面行走的腿部、表情的嘴和眼、frontend 卡片里的书。
4. DB 卡片的屏幕底色：色板里没有藏青色，所以变成了灰米色。如果想要深蓝，需要制作人批准往共享色板里加 1–2 个颜色。
5. 场景中“!”的叠加位置和闪烁，以及物件高亮，需要由引擎实现。这次不写代码。
6. HF-ART-04 提到的“笔记”物件，不在这次的 4 件里。
7. 表情用 32×32 单元，和南京表情的单元比例不同，接入时需要定一个放置规则。
8. 示意图里的南京 player 参考帧带了一条相邻格子的残边。原因是南京原表本身不在格心上，这条残边只出现在示意图中，不影响任何运行素材。
9. 所有候选都要制作人通过后，才能替换运行引用。
