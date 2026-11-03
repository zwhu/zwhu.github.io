# 架构图工具选型

2026-11-01。用途：为 Super-agent 文章提供静态阅读图和可交互架构图，沿用本站原生 HTML/CSS/JavaScript 与 GitHub Pages。

## 结论

选择 **architecture-canvas（draw-architecture 0.1.0）**。它以 scene 数据生成独立 HTML，内置拖动、缩放、触摸双指操作、节点聚焦、说明面板和 PNG 导出；构建脚本只依赖 Node 标准库。静态 SVG 从同一 scene 生成，网站运行无需构建服务。

| 工具 | 交互与输出 | 适用场景 | 本篇判断 |
| --- | --- | --- | --- |
| architecture-diagram 1.5.0 | 单文件 HTML；场景逐步播放、前后切换、节点拖动和载荷说明 | 演示请求逐步执行 | 当前重点是架构关系，不再增加第二套播放器 |
| architecture-canvas 0.1.0 | 独立 Canvas2D HTML；平移缩放、节点聚焦、说明和 PNG 导出 | 在静态站探索组件关系 | 与本站部署方式吻合，采用 |
| LikeC4 1.60.0 | DSL、布局与静态站/Web Component；多视图、详情和 walkthrough | 多层架构持续建模 | 层级导航更完整，但增加构建依赖，本篇暂不采用 |

节点聚焦只突出当前图的邻接关系，**不等同于进入组件内部的层级下钻**。本篇提供总览探索；今后需要大量子架构视图时，再考虑 LikeC4。LikeC4 可编译后静态托管，不要求线上 Node 服务。

## 实际集成

- 交互图：[assets/superagent/index.html](../assets/superagent/index.html)。默认暖白主题与系统字体，移除远程字体请求；支持缩放、拖动、聚焦、清除与导出。
- 静态图：正文使用 [architecture.svg](../assets/superagent/architecture.svg) 和 [consistency.svg](../assets/superagent/consistency.svg)，完整图为 [architecture-full.svg](../assets/superagent/architecture-full.svg)。原工具没有 SVG 导出，SVG 由本站脚本生成。
- scene、MIT 许可和模块模板保存在仓库内。运行 `node scripts/vendor/architecture-canvas/validate.cjs assets/superagent/scene.js` 校验，再运行 `node scripts/render-superagent-diagrams.cjs` 生成。
- 交互图直接嵌入正文并默认显示，接近视口时自动加载同源模块，无需点击展开或加载 iframe。模块和场景合并为一个请求；旧的独立地址作为兼容入口保留。正文文字可独立阅读；Canvas 本身不是完整的读屏语义视图。

原校验器按等宽拉丁字符估算文字宽度，可能低估中文，必须补真实浏览器字体测量与视觉检查。三个工具均为 MIT，本站复制的模板保留版权和许可。

## 一手来源

- [architecture-diagram README](https://github.com/konraddzbik/architecture-diagram-skill) 与 [SKILL](https://github.com/konraddzbik/architecture-diagram-skill/blob/main/skills/architecture-diagram/SKILL.md)：场景播放器、模板和校验流程。
- [draw-architecture README](https://github.com/yulonghe97/draw-architecture)、[SKILL](https://github.com/yulonghe97/draw-architecture/blob/main/SKILL.md)、[scene 格式](https://github.com/yulonghe97/draw-architecture/blob/main/references/scene-format.md) 和 [模板](https://github.com/yulonghe97/draw-architecture/blob/main/assets/template.html)：实际交互、数据与渲染实现。
- [LikeC4 AI tools](https://likec4.dev/tooling/ai-tools/)、[CLI](https://likec4.dev/tooling/cli/) 和 [Web Component](https://likec4.dev/tooling/code-generation/webcomponent/)：AI 编写工具与网站浏览运行时的区别。当前 CLI 文档没有 `export svg` 命令，不能假定原生支持。

版本取自调研时官方包声明；工具上游 main 不等于固定 commit。本文软件机制引用的 Super-agent 则固定在 `6337fc8`。
