# 一路写来

博客仓库内的独立像素 RPG 子项目。通过合肥、南京、杭州的经历呈现作者做事方法的变化，技术方向为 Three.js 加简单引擎。

南京完整 Web 样章已实现，包含七状态主线、存档、四向行走、NPC、情绪、坐姿打字、五工位与头部气泡。2026-11-05 已从指定 worktree 合并；当前只交付合并结果并暂停。走路卡顿未解决，用户要求后续再处理；全键盘专项与最新坐姿／气泡视觉仍待验。不得重做南京或扩展场景。

最新状态见[交接说明](./handoff.md)，启动说明保留在 [Web README](./web/README.md)。本次未启动服务、浏览器或性能测试；历史 HTTP 服务和 session 不保证跨目录或跨会话有效。

- [Agent 规则](./AGENTS.md)：子项目工作约定与验证入口。
- [规格说明](./spec.md)：范围、真实经历、美术方向与南京样章。
- [交接说明](./handoff.md)：当前进度、目录边界及实施顺序。
- [验收方案](./acceptance.md)：美术、功能、叙事与性能标准。
- [南京成品基准](./art/style-guide.md)与[生成记录](./art/README.md)；旧概念板仅辅助。
- [Flash 第一章任务书](./tasks/chapter-01-flash.md)：南京样章设计输入；实际调用与审查结论见交接说明。

- [南京样章设计](./design/chapter-01.md)、[美术制作规格](./design/chapter-01-art.md)与[监督记录](./design/supervision.md)：保留完整设计与历史审查；运行时实现和布局以 Web 文件及最新交接为准。

后续源码、素材、测试与维护脚本均放在本子项目。仅发布必需的静态产物导出到 `docs/assets/career-rpg/`，页面入口拟为 `docs/career-rpg.html`；当前尚未创建这两个位置。GitHub Pages 继续发布 `main /docs`，无需新增线上构建流程。
