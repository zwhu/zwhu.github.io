# 可交互架构图技能调研

调研日期：2026-11-01。依据作者仓库、技能源码和官方文档核实；本次未安装候选技能、未运行其示例。安装量与 stars 是访问时的快照，不能代替实际使用验证。

## 本地已有能力

本地画 SVG 的技能是 `fireworks-tech-graph`，版本 `1.2.0`。它以 SVG 为主产物，可导出 PNG、离线 HTML，并为受支持的语义 SVG 生成 GIF。HTML 查看器已有画布平移、缩放、主题切换、源码复制和静态下载。未看到节点详情、层级下钻或编辑关系的通用接口。GIF 动画与用户交互应分开判断。[本地技能说明](/Users/bytedance/.agents/skills/fireworks-tech-graph/SKILL.md)、[HTML 查看器源码](/Users/bytedance/.agents/skills/fireworks-tech-graph/scripts/interactive_html.py)

`visualize` 也已在当前技能列表中，可按任务编写会话内交互可视化；它属于通用生成能力，具体架构图交互需逐次实现。[本地技能说明](/Users/bytedance/.codex/plugins/cache/openai-bundled/visualize/1.0.57/skills/visualize/SKILL.md)

## 候选对照

“未见内置”指已查资料没有承诺该功能，不代表无法扩展。React Flow 项是指导开发的技能，不能视为现成的单文件查看器。

| 技能 | 最合适的用途 | 已核实交互 | 层级下钻 | 交付与依赖 |
| --- | --- | --- | --- | --- |
| `konraddzbik/architecture-diagram-skill@architecture-diagram` | 讲解一次请求如何经过系统 | 选择流程、逐步播放、查看当前步骤的 payload、切换模式、拖动节点调整布局 | 未见内置 | 单 HTML 加说明 Markdown；无需应用构建；字体可移除以离线运行 |
| `yulonghe97/draw-architecture@architecture-canvas` | 浏览完整系统地图 | 平移、缩放、点击隔离组件与关联关系、查看说明、PNG 导出 | 未见内置 | 单 HTML；生成和校验依赖 Node.js；模板请求 Google Fonts |
| `likec4/likec4@likec4-dsl` | 长期维护有层级的架构模型 | 交互导航、组件与关系下钻、多个视图 | 支持 | `.c4` / `.likec4` 源码，经 CLI 构建静态站；支持单 HTML 输出 |
| `existential-birds/beagle@react-flow-implementation` | 开发可编辑架构图工具 | 平移缩放、拖节点、建立连线、更新数据、连线校验 | 需开发 | React 与 `@xyflow/react`；属于应用开发路线 |

前两项的能力分别来自 [architecture-diagram 技能源码](https://github.com/konraddzbik/architecture-diagram-skill/blob/main/skills/architecture-diagram/SKILL.md) 和 [architecture-canvas 技能源码](https://github.com/yulonghe97/draw-architecture/blob/main/SKILL.md)。LikeC4 的交互导航和下钻见 [官网](https://likec4.dev/)，构建能力见 [CLI 文档](https://likec4.dev/tooling/cli/)。React Flow 项见 [技能源码](https://github.com/existential-birds/beagle/blob/main/plugins/beagle-react/skills/react-flow-implementation/SKILL.md)。

## 选择时需要注意

`architecture-diagram` 的当前源码版本为 **1.5.0**。点击节点会跳到当前流程中首次涉及该节点的步骤；右侧展示的是步骤信息。拖动用于调整位置并保存在浏览器，不等于编辑系统拓扑。没有查到通用画布缩放承诺。[交互约定](https://github.com/konraddzbik/architecture-diagram-skill/blob/main/skills/architecture-diagram/SKILL.md)

`draw-architecture` 是仓库及 npm 包名，技能实际名为 **`architecture-canvas`**。它用场景数据生成查看器；点击聚焦与拖动画布适合阅读，未见拖动组件改布局或编辑连线。发布到 artifact.cafe 是可选步骤。[README](https://github.com/yulonghe97/draw-architecture/blob/main/README.md)、[模板源码](https://github.com/yulonghe97/draw-architecture/blob/main/assets/template.html)

LikeC4 提供第一方技能，官方安装入口为 `npx skills add https://likec4.dev/`。技能负责 DSL 写作，交互来自 LikeC4 查看器；CLI 的 `build --output-single-file` 可生成自包含 HTML。历史语法问题 #3162 已关闭并关联修复 #3357，仍应对生成的模型执行 `likec4 validate`。[AI Tools](https://likec4.dev/tooling/ai-tools/)、[CLI](https://likec4.dev/tooling/cli/)、[已关闭的问题](https://github.com/likec4/likec4/issues/3162)

React Flow 另有 `mattwoodco/skills@react-flow`（技能版本 1.3.0），偏 React 19 / Next.js App Router，包含自定义节点、连线和浏览器状态保存示例。但作者技能仓库仅查到 3 stars，适合作参考，暂不优先安装。[技能源码](https://github.com/mattwoodco/skills/blob/main/skills/react-flow/SKILL.md)、[作者仓库](https://github.com/mattwoodco/skills)

## 活跃度与安装入口

| 候选 | GitHub stars | skills.sh 安装量 | 安装命令（仅供参考，本次未执行） |
| --- | ---: | --- | --- |
| architecture-diagram | 142 | 未核实到 | `npx skills add konraddzbik/architecture-diagram-skill --skill architecture-diagram` |
| architecture-canvas | 146 | 未核实到 | `npx skills add yulonghe97/draw-architecture --skill architecture-canvas` |
| likec4-dsl | 约 6.0k（整个 LikeC4 项目） | 105 | `npx skills add https://likec4.dev/` |
| react-flow-implementation | 85（整个 Beagle 技能库） | 未核实到 | `npx skills add existential-birds/beagle --skill react-flow-implementation` |
| react-flow | 3（整个作者技能库） | 未核实到 | `npx skills add mattwoodco/skills --skill react-flow` |

stars 来源：[architecture-diagram](https://github.com/konraddzbik/architecture-diagram-skill)、[draw-architecture](https://github.com/yulonghe97/draw-architecture)、[LikeC4](https://github.com/likec4/likec4)、[Beagle](https://github.com/existential-birds/beagle)、[mattwoodco](https://github.com/mattwoodco/skills)。安装量来源：[LikeC4 的 skills.sh 页面](https://www.skills.sh/likec4/likec4/likec4-dsl)。其余目录页面访问未成功，不能把未核实解释为零安装。仓库加 `--skill` 的命令按技能标准发现规则及已核实名称写出，尚未执行；LikeC4 的网址命令、architecture-canvas 和 Beagle 的仓库安装方式另有作者文档支持。

## 建议

- 只想让已有 SVG 能拖动、缩放：继续使用本地 `fireworks-tech-graph export-html`。
- 想逐步讲清 RAG、Agent、鉴权或请求链路：优先试 `architecture-diagram`。
- 想点击浏览整张系统地图：优先试 `architecture-canvas`。
- 想按系统、容器、组件逐层探索，并在 Git 中长期维护：优先试第一方 `likec4-dsl`。
- 想让使用者修改节点、连线和状态：走 React Flow 开发路线，需额外实现业务规则、持久化和详情界面。

对当前原生 HTML 技术博客，前两个单文件产物最容易嵌入；LikeC4 适合更完整的架构文档。此处是根据产物形式作出的适配判断，尚未验证博客嵌入效果。
