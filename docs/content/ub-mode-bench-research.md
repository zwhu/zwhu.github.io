# ub-mode 评测博客研究笔记

记录日期：2026-10-30。用途：先对齐博客主线和结构，不是博客正文。

## 资料与核对范围

- 指定分支：`overnight-2026-10-29`；读取时 HEAD 为 `7ce00ee20ac71931be715abd234f55157f06b066`。下列链接固定到该版本，避免后续分支变化影响追溯。
- [小任务报告（54 次正式运行）](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/overnight-2026-10-29.md)。含 54 行逐次结果，可从公开 Markdown 独立重算均值。
- [Vue 详细报告（18 次正式运行，含最终业务复核）](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/vue-2026-10-29-detailed.md)。含 18 行逐次结果，应作为 Vue 叙述的主要来源。
- [Vue 汇总报告](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/vue-2026-10-29.md)、[执行约定与后续扩展](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/HANDOFF.md)、[任务及结果入口说明](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/README.md)。
- 本次未运行模型、测试或质量评分。只读取报告、配置和复核脚本；用 Python 解析两份报告的逐次表格，核对样本数、通过次数、源码改动、耗时及 CRAP 均值，与报告一致。Vue 表内时间和风险分已四舍五入，按展示值重算允许末位舍入差异。
- 公开分支没有 `runs/`、详细报告 JSON、gold 或模型最终补丁；[`.gitignore`](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/.gitignore) 明确排除了 `runs/`、`reports/*/` 和 gold 内容。[HANDOFF](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/HANDOFF.md) 说明历史原始证据保存在仓库外，通过 `BENCH_ARTIFACTS_DIR` 指定。只读检查本机 `/Users/bytedance/work/AI/ub-mode-bench`：仍为旧 main，`reports/` 只有 `.gitkeep`，没有 `runs/`。因此当前能独立核对报告算术和脚本设计，不能独立重验原始执行或逐行分析模型补丁；这不影响先对齐文章结构。

## 推荐文章主线

从“工程纪律听起来有道理，加载成 skill 后有没有可测收益”出发：先用三项小修复测试，发现两组全部通过；再升级 Vue 的真实多模块修复，仍未观察到目标修复成功率提高。两轮最一致的信号是 ub-mode 增加耗时和业务源码改动；CRAP 风险指标有所改善（数值越低通常越好），但不足以直接等同于更可靠或更易维护。评测过程中，离线依赖泄漏、验收对实现的过度约束、变异评分超时，比单一排行榜更值得展开。

这是根据两份实验报告提出的叙事建议，不是额外实验证据。[小任务结论](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/overnight-2026-10-29.md)、[Vue 结论](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/vue-2026-10-29-detailed.md)。

可用标题方向：**《给 AI 加上 Bob 大叔的工程纪律，修 bug 会更好吗？》**。标题使用问题句，正文先交代本轮结果和适用范围。

## 评测对象与实验设计

- 固定版 ub-mode 为 `57a8bdd`，按“先做对功能、再整理实现、遵守实践”组织规则，包含测试先行、根因修复、行为测试、复杂度与覆盖检查、消除高相似度重复、变异测试和小步提交。[上游固定版 SKILL](https://raw.githubusercontent.com/unclebob/ub-mode/57a8bdd/SKILL.md)、[本次固定版本记录](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/HANDOFF.md)。
- A：无额外 skill。C：加载 ub-mode，并提供 crapper/dryer/mutator。两组修复后都接受相同外部评分。因此测到的是“skill＋工具可用性”整体效果，不能拆成某条规矩或某个工具的效果。[A 配置](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/variants/A_baseline.yaml)、[C 配置](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/variants/C_ub_mode.yaml)、[评分说明](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/overnight-2026-10-29.md)。
- 三模型：GPT-6.1-Sol、GPT-5.6-Luna、DeepSeek-V4.1-Flash；GPT 使用 xhigh/codex，DeepSeek 使用 high/claudecode，harness 和工具模式存在差异。只比较同一模型内 A/C，不用于跨模型排名。编号 1/2/3 是独立重复，不是 provider RNG seed；没有做显著性检验。[执行口径](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/overnight-2026-10-29.md)。
- 容器隔离、去 Git 历史/变更日志、隐藏验收留在评分侧；C 有完整 skill 读取证据，但“读取了”不能等同“每条都遵守”。运行时隔离也不能证明训练时未见过答案。[小任务隔离记录](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/overnight-2026-10-29.md)、[Vue 条件与观察项](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/vue-2026-10-29-detailed.md)。

## 第一轮：三项小修复，54 次

三个任务分别来自 unjs/ufo #335（URL 前导斜杠）、unjs/defu #156（默认配置合并的原型污染）、unjs/pathe #246（UNC 网络根）。正式规模为 3 任务×3 模型×A/C×3 次＝54 次；试跑 6 次不计入正式统计。A/C 各 27 次，公开和隐藏验收均 27/27 通过。基线已达到天花板，本轮不能观测到通过率提升。[任务、样本和通过率](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/overnight-2026-10-29.md)。

| 同一模型 | CRAP 均分 A→C | 源码改动行 A→C | 模型及工具分钟 A→C | 额外分钟 |
| --- | ---: | ---: | ---: | ---: |
| Sol | 5.8888→5.0575 | 3.78→16.22 | 1.74→3.97 | +2.23 |
| Luna | 5.8847→4.9912 | 3.44→19.67 | 1.59→6.94 | +5.35 |
| DeepSeek | 6.2431→4.9840 | 16.11→28.22 | 3.57→9.59 | +6.02 |

每组每模型 n=9。业务源码行数是新增＋删除，只计 `src`，不含测试与日志；并非净增行数。时间包含 executor 准备及模型/工具阶段，不含后续外部评分，不能直接换算 token 费用。[原始逐次表和汇总](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/overnight-2026-10-29.md)。

mutation survivor 均值 Sol 为 0.78→0.56，Luna 0.44→0.78，DeepSeek 1.33→0.50；DeepSeek C 为 n=8、A 为 n=9，有一次超时。方向不一致，不可称“测试稳定变强”。重复代码对全部为 0。[评分解释与数据](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/overnight-2026-10-29.md)。

## 第二轮：Vue 真实修复，18 次

任务源于 Vue core #15136：模板已被转换、分析缓存被挤出后，重复编译丢失仅模板使用的导入。修复前仓库约 56,855 行 TypeScript；官方参考改动 134 行业务源码、涉及 4 个模块。1 任务×3 模型×A/C×3 次＝18 次，独立于上一轮，不混合计算。[详细任务说明](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/vue-2026-10-29-detailed.md)、[公开 prompt](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/tasks/vue-template-cache/prompt.md)。

| 同一模型 | 最终独立业务验收 A/C | 源码改动行 A→C | 模型及工具分钟 A→C | 额外分钟 |
| --- | --- | ---: | ---: | ---: |
| Sol | 3/3、3/3 | 97.33→214.67 | 9.24→19.49 | +10.26 |
| Luna | 3/3、3/3 | 90.33→161.33 | 7.72→11.51 | +3.79 |
| DeepSeek | 3/3、3/3 | 117.00→168.67 | 14.75→24.17 | +9.42 |

源码改动分别增加约 120.5%、78.6%、44.2%；耗时分别约为 2.11、1.49、1.64 倍。组内差异明显，例如 Luna C 为 27/234/223 行，不能把均值理解成每次都如此。[成本数据和逐次结果](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/vue-2026-10-29-detailed.md)。

| 同一模型 | CRAP 均值 A→C | 文件内最高分均值 A→C | 注意事项 |
| --- | ---: | ---: | --- |
| Sol | 12.08→11.26 | 46.67→56.00 | 平均下降，最高分上升 |
| Luna | 23.84→11.65 | 186.90→42.00 | 改动文件范围影响统计 |
| DeepSeek | 16.30→15.56 | 123.78→157.68 | C 仅 n=2，其余为 n=3 |

完整 mutation 评分只有 2/18：Luna A1 为 23、C1 为 12，其余 16 次没测完。原因是每个 run 总预算 30 分钟，mutation 最多 20 分钟，较长的模型阶段会挤占评分预算，且文件级扫描产生大量变异点。缺失与耗时和改动范围相关，不能当成随机缺失或记为 0。[指标范围及缺失说明](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/vue-2026-10-29-detailed.md)。

## 最值得写的三个案例

### 1. 断网仍然能拿到答案

原始依赖镜像含带修复的 ufo@1.6.4、defu@6.1.7，且 6 次正式运行事件流出现直接读取发布实现。受影响的 36 次正式结果及 6 次试跑被隔离，不进入最终结果；锁到修复前版本 ufo@1.6.3/defu@6.1.4 后重跑，pathe 的原 18 次保留。叙述应准确区分“实际发现读取的 6 次”与“全部受影响而排除的 36 次”。[依赖参照隔离修正](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/overnight-2026-10-29.md)。

写作价值：解释隔离不只是关网络，还必须排查安装包中的参考实现；也交代为什么最终是干净的 54 次，而不是把污染结果一起平均。

### 2. 测试把合法的另一种实现判错

Vue Luna C1 原始隐藏验收失败，因为断言要求输入 AST 被标记为 transformed，而该修复选择复制 AST。移除内部状态限定后，目标业务回归通过。该次原始失败记录没有被改写，对全部 18 次统一做行为复核。[Vue 详细报告“修复是否真的通过”](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/vue-2026-10-29-detailed.md)、[统一复核脚本](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/scripts/review_vue_behavior.py)。

进一步从干净旧版恢复原始测试和配置，只导入模型生产源码，丢弃模型测试与辅助文件；在模型提交后生成新标识符的客户端/SSR 两条行为用例。旧版 469 条原测试通过、新 2 条失败；官方参考修复及全部 18 份模型源码均通过这 471 项。复核脚本使用公开编译 API 和 501 次填充触发缓存挤出，并检查原始结果文件哈希未变。[报告独立验收](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/vue-2026-10-29-detailed.md)、[source-only 核验脚本](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/scripts/audit_vue_source_only.py)。

写作价值：解释为何“原隐藏 A9/9、C8/9”不能简单写成 C 修坏一次；最终“业务 A9/9、C9/9”也必须附上统一复核的过程。这与 ub-mode 自身要求测试行为的原则呼应。当前没有模型补丁，不能展开它如何复制 AST 的代码级点评。

### 3. 想测测试质量，评分却没跑完

Vue 16/18 次 mutation 无完整结果，不能拿唯一一对 23→12 宣称显著收益。整文件评分加总预算让更慢、改动更多的样本更容易缺测，这是测量设计的局限。[Vue 评分说明](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/vue-2026-10-29-detailed.md)、[预算与 null 实现](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/runners/collect.ts)。

写作价值：下一轮先把外部评分预算与模型耗时分开，并统一变异范围；这是改进建议，不是本次做过的实验。

## 结论强弱与表述边界

- **最强的可报告观察**：同一模型内，两轮 C 平均都更费时、源码改动更多；本次目标验收均通过，未观察到成功率收益。具体数字见两轮报告。
- **支持有限的质量信号**：CRAP 均值下降，但指标扫描各自改动文件中的函数，不是固定目标函数集合；新增被扫描文件、函数数和覆盖均可改变均值。不能把它写成实际缺陷下降或未来事故概率下降。
- **最弱的证据**：更强的测试（Vue 仅 2/18 完整评分）、更稳定的 TDD 执行（提交审计没有足够证据）、更易维护（没有人工可维护性评分）。
- 没有首提交失败测试证据，不能推导未提交编辑时从未测试先行；读取 skill 不等于稳定遵守全部规则。小任务 C 的 Sol 有少量提交，Vue Sol C 为 2/1/1，其他组无提交。[小任务过程指标](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/overnight-2026-10-29.md)、[Vue 过程证据](https://github.com/zwhu/ub-mode-bench/blob/7ce00ee20ac71931be715abd234f55157f06b066/reports/vue-2026-10-29-detailed.md)。
- 每任务每组仅 3 次、四项任务均为 bug fix、三项小任务基线已饱和，不足以决定所有编码任务是否默认启用。没有显著性检验，不能声称证明无效、显著改善或全面退化。
- 不宜合成“72 次证明……”的总通过率；两轮验收口径与任务结构不同，应写“第一轮 54 次，升级 Vue 后另做 18 次”。

## 建议对齐的文章结构

1. **为什么测 ub-mode**：承接已有 Agent 评测文章，提出“工程纪律转成 skill 后的收益与成本”问题；简介固定版规则，开头给克制的结果概览。
2. **怎样比较**：A/C、三模型、独立重复、任务隔离、共同验收；一张简洁实验表。清楚写比较的是 skill＋工具组合。
3. **第一轮：小任务都过了，但代价不同**：三任务背景、54 次结果、基线天花板；用紧凑表交代 CRAP 信号与额外时间/改动。
4. **第二轮：把任务升级到 Vue**：为什么扩大任务、业务问题、人能理解的难点、18 次独立验收；成本作为重点结果。
5. **风险指标有所改善，能说明什么**：明确 CRAP 风险分越低通常越好，解释统计范围、最高值方向、mutation 缺失、读过 skill 与执行规则的差距。避免使用容易被理解为代码变差的“质量评分下降”。
6. **这次评测最有价值的三个坑**：离线依赖里有答案、隐藏测试约束了实现、变异评分预算不足。Vue 误判与独立复核是重点案例。
7. **我的选择：先把工程门禁搭好**：用户已明确，自己的工作流中不会使用这套模式，更重视 lint、测试等 LLM 外部的门禁能力。以第一人称写出这个选择及其理由；本轮结果、结论边界和个人工作流判断分别说明。下一轮实验方向可留作简短补充，不再作为结尾主旨。
8. **附录/文末资料**：两轮完整报告、固定分支/版本、指标释义、公开证据范围、复现入口；不要把全部逐次表塞入正文。

建议篇幅约 3,000～4,000 汉字，Vue 与评测教训占主要篇幅，正文控制为 2～3 张表。篇幅和侧重是编辑建议，待用户对齐；不涉及发布或页面修改。

## 用户反馈后的编辑约定（2026-10-30）

- CRAP 统一称“CRAP 风险分（越低通常越好）”。概括时用“风险指标有所改善”，不写“质量评分下降”。指标方向与整体质量判断分开。
- 结尾明确写用户自己的选择：不会在自己的工作流中使用 ub-mode；工程投入重点是搭好 lint、测试等 LLM 外部的门禁。该选择来自用户本人，不虚构为实验已比较并证明门禁方案更优。
- 增加解释图和数据图。表格配对照图，在同一模型内展示普通方式与 ub-mode 的变化方向；独立重复用散点表现波动，编号不画成时间趋势。
- 图表纳入章节安排，暖白底、灰色普通组、朱砂红 ub-mode 组、统一单位与颜色。标清样本数、均值与缺失；不把缺失值画成 0。
- 最新章节、结尾表述与配图方案见 [文章结构稿](./ub-mode-bench-outline.md)。用户确认开写后已完成[完整文章](../ub-mode-bench.html)与配图，当前保存为本地页面，尚未对外发布。按用户后续反馈，正文已移除变异测试的解释、结果与配图；本研究笔记保留原始依据。
