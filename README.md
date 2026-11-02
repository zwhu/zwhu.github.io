# zwhu · 个人技术博客

网站：https://zwhu.github.io/

源码：https://github.com/zwhu/zwhu.github.io

此目录是正式维护工程。GitHub Pages 从 `main` 分支根目录自动发布；后续修改通过 PR，在必需检查通过后合并并发布。

原生 HTML / CSS / JavaScript 的个人技术博客，无构建依赖。暖白底、无衬线正文、少量朱砂红强调，采用紧凑的文章列表，支持行内代码和可横向滚动的代码块。目前收录 46 篇从 GitHub Issues 迁入的文章、三篇新增原创文章，以及两篇全文对照译文。

## 预览

在此目录运行 `python3 -m http.server 8765 --bind 127.0.0.1`，打开 http://127.0.0.1:8765/ 。

## 发布至 GitHub Pages

将此目录内的文件（包含 `.nojekyll`）放入个人网站仓库根目录。进入 Settings → Pages，选择 Deploy from a branch，分支 main，目录 /(root)，保存。

## 修改内容

- `index.html`：网站名、个人介绍、个人思考与翻译入口。
- `translations.html`：翻译留档专栏目录。
- `claude-code-review.html`、`engineers-new-problems.html`：两篇英中对照译文，原文出处、正文与插图保持完整。工作区原始文件未修改。
- 各文章 HTML：标题、日期、正文；新增文章时沿用同类页面外壳，登记对应元信息后运行公共生成。
- `content/original-articles.json`：新增原创文章的标题、日期、路径、摘要与标签；目录生成脚本会一并收录，正文维护在对应 HTML 中。
- `ub-mode-bench.html`：ub-mode 评测文章；图表数据见 `content/ub-mode-bench-data.json`，图与移动端版本在 `assets/ub-mode-bench/`。维护脚本 `scripts/render-ub-mode-figures.py` 使用 matplotlib 生成静态 SVG，站点运行不依赖 Python 或绘图库。
- `style.css`：共用颜色、字体与布局；`translation.css`：对照阅读样式；`archive.css`：专栏与评论样式。使用系统字体。

主导航、通用页脚、评论外壳、首页与目录列表、学习页相关阅读统一生成。维护位置与接入流程见[公共模板与目录生成](./content/site-generation-guide.md)：修改 `templates/` 或元信息后运行 `python3 scripts/render-site.py`，用 `python3 scripts/render-site.py --check` 检查同步。脚本自动更新 SEO，静态 HTML 一起提交；正文与译文来源页脚继续保留在各自页面中。

## 搜索引擎收录

正式域名、作者及摘要覆盖项集中在 `content/seo.json`。运行 `python3 scripts/update-seo.py` 更新全站 canonical、摘要、Open Graph／Twitter 分享信息、JSON-LD、`sitemap.xml` 和 `robots.txt`；运行 `python3 scripts/update-seo.py --check` 检查生成结果是否同步，`python3 scripts/test-seo.py` 验证规范地址、摘要、收录范围、发表日期与译文归属。`scripts/render-blog-issues.py` 重新生成文章后会自动更新 SEO，无需在 GitHub Pages 增加构建流程。

首页规范地址为 `https://zwhu.github.io/`；其他页面保持已有 `.html` 文件名。文章结构化数据保留真实发表时间，译文标明原作者及英文来源，不把迁移、评论或样式修改伪装成正文更新。未维护可靠更新时间前不生成 `dateModified` 和 sitemap `lastmod`。

`content/doc-lint-comparison/` 中的对照页保留 `noindex, follow`，不加入 sitemap；robots.txt 允许抓取，以便搜索引擎读取 noindex。新增正式页面后重新运行 SEO 脚本；迁移域名时修改统一配置并重新生成，原站跳转需要另外配置。

发布后，在 Google Search Console 和 Bing Webmaster Tools 验证站点，提交 `https://zwhu.github.io/sitemap.xml`，再用 URL 检查确认首页与代表文章的抓取、规范地址和收录情况。站长平台的验证与抓取结果需在平台内确认；本地检查不代表已经收录。

首页的公开所有权验证标记维护在 `content/seo.json` 的 `site.verification` 中；验证成功后仍应保留。它们用于证明站点所有权，不是账户 API 密钥。

## 访问统计

全站接入 [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/)，在 Cloudflare 控制台查看浏览量、访问来源和热门页面。网站仍由 GitHub Pages 托管，无需修改 DNS 或增加服务端。

新增页面与维护生成模板时的统计代码约定见 [AGENTS.md](./AGENTS.md)。嵌入代码中的 token 是公开的站点统计标识，不是账户 API 密钥。

发布后，在已配置的 `zwhu.github.io` 域名下访问首页和文章页，等待几分钟后检查统计面板。本地预览不能用于确认正式域名的数据上报；浏览器拦截或网络异常可能导致漏计，国内效果需在实际网络下验证。

## 长文章快速导航

长文可复用原生 HTML/CSS/JavaScript 导航，无第三方依赖。样式在 `archive.css`，当前章节高亮在 `article-toc.js`；接入模板与交互约定见 [导航复用说明](./content/article-toc-guide.md)，示例为 `ub-mode-bench.html`。

## 项目 Skill

[doc-lint](./.agents/skills/doc-lint/SKILL.md) 用于中文文档润色、精简冗余和表达检查，保留技术含义、限定条件与引用。可通过 `$doc-lint` 调用。

ub-mode 文章的润色前后快照与对照记录保存在 `content/doc-lint-comparison/`，不加入 `content/original-articles.json`，因此首页和文章归档只展示正式文章。

## GitHub 评论

迁入文章与现有两篇译文均接入共用的 `comments.js`。采用 [giscus](https://giscus.app/zh-CN)，评论存放在本仓库的 GitHub Discussions。仓库已启用 Discussions，giscus 已安装，公开仓库 ID 和 Announcements 分类 ID 已填好，`enabled: true` 启用评论。

完成启用：

1. 将 [giscus GitHub App](https://github.com/apps/giscus/installations/new) 安装到 `zwhu/zwhu.github.io`，只选择此仓库。
2. 将 `comments-config.js` 的 `enabled` 改为 `true`，提交并推送。
3. 在真实域名下验证评论加载；访客登录 GitHub 后可发表评论。

配置里只有公开 ID，不需要 Token。评论按 `blog/文件名.html` 的固定标识对应讨论，因此之后更换域名不会改变标识；文章文件名应保持稳定且唯一。访客评论需要 GitHub 登录授权。正式接通后的登录与评论尚未验证。

链接采用相对路径，可用于个人站与项目站。Git 提交使用 GitHub noreply 邮箱。

## GitHub Issues 迁移

2026-10-27 从 `zwhu/blog` 迁入全部 46 篇 issue（包含 open / closed 查询，当前全部为 open）及 14 条历史评论。原仓库保持不变。

- `writing.html`：完整文章目录，按北京时间的最初发表日期倒序排列；首页展示最近六篇。
- `blog-issue-N.html`：稳定的文章路径，N 为原 issue 编号；保留原文、标签、日期、来源入口、历史评论及相邻文章导航。
- `content/blog-issues.json`：原始 Markdown、GitHub 渲染正文、元数据、历史评论与图片来源快照。
- `assets/blog-issues/`：已成功下载的 14 个图片资源（包括 GIF）。另外 26 个图源访问失败，页面保留原图链接与不可用说明，详见 [迁移记录](./content/blog-issues-migration.md)。
- `scripts/render-blog-issues.py`：使用 Python 3.9+ 标准库从本地快照重新生成文章、目录和首页文章列表：`python3 scripts/render-blog-issues.py`。无需网络；网站仍是直接部署的静态 HTML，无运行时构建依赖。脚本会覆盖迁入文章及首页的文章列表，后续正文修改应先更新快照。

原 issue 之间的链接已转为站内相对链接。历史评论只作只读存档，新评论继续使用独立的 giscus 讨论（`blog/blog-issue-N.html`）。GitHub 反应、订阅、任务指派等协作状态不作博客内容迁移。


## 交互式学习专栏

`learning.html` 收录六篇交互文档：首页与全站导航均提供入口。各篇使用稳定的 `learn-*.html` 文件名，正文与图表保留在页面中，课程布局、图示和交互脚本放在 `assets/learning/`，公共阅读外壳与基础控件放在 `learning.css`。样式归属与接入示例见[学习页复用说明](./content/learning-styles-guide.md)，运行 `python3 scripts/check-learning-styles.py` 检查归属、作用域、语义变量和加载顺序。目录元信息见 `content/interactive-learning.json`，运行公共生成同步首页、目录和相关阅读。

保留场景切换、训练实验、闪卡、测验、SVG 动画与提示词复制。Agent 记忆页原先依赖聊天环境的继续学习按钮已改为站内模块说明、源码阅读路线与自测。大型图表在窄屏局部横向滚动。

`.github/workflows/static-checks.yml` 在 PR 创建／更新、推送 `main` 和手动触发时，检查公共生成、学习页样式归属、SEO 同步以及生成／SEO／评论测试。`main` 已要求 PR 合并、分支保持最新且 GitHub Actions 的 `check` 成功，管理员也受约束；个人仓库不要求额外审批人。保护配置快照及远端验证见[CI 交接](./content/ci-handoff.md)。工作流只读源码，发布仍由 GitHub Pages 在合并后执行。

## Super-agent 文章与研究资产

- `content/superagent.md` / `superagent.html`：整体架构、Router 分发、上下文、Worker 恢复、一致性、冲突、异步执行、存算分离、Watchdog 与实验范围。
- `content/superagent-botmux.md` / `superagent-botmux.html`：与 botmux 的公开能力比较及待验证的方向。
- `content/superagent-evidence.md` / `content/superagent-data.json`：原文结果和补充实验的来源、口径与限制。
- `content/architecture-tool-selection.md`：三种工具对比。选择 architecture-canvas，聚焦是总览节点查看，不是层级下钻。
- `assets/superagent/index.html`：可独立打开的交互画布；`scene.js` 是架构数据，正文静态图与完整图由同一生成脚本维护。
- `assets/superagent/original/`：原文图 3–8、10–14，保留原图号和来源；主文展示七张关键架构图与两张实验图，Thread 示例和原结果表在实验附录。
- `content/superagent-review-changes.md`：第二版与最初博客的主题对应，说明恢复的内容和原图位置。
- 第三版按一次 CSV 修复串联消息归属、身份、上下文、恢复和实验。主题插画与收益/开销比较由 `scripts/render-superagent-editorial.cjs` 生成，局部编辑布局在 `assets/superagent/editorial.css`，三场景交互在 `assets/superagent/routes.js`。网页提供静态表格后备，完整架构图继续按需加载。
- 第四版将正文七张旧架构图重绘成博客风格，桌面/手机 SVG 在 `assets/superagent/redrawn/`；运行 `node scripts/render-superagent-source-diagrams.cjs` 生成，同时检查两种布局的节点与关系对应。原图对照与来源保留。

先执行 `node scripts/vendor/architecture-canvas/validate.cjs assets/superagent/scene.js`，再执行 `node scripts/render-superagent-diagrams.cjs`。生成过程只用 Node 标准库，GitHub Pages 仍直接提供静态文件；修改正文时同时维护 Markdown 与对应 HTML。

这批文章经作者授权合并到 `main`，由 GitHub Pages 直接提供静态页面。正文与配套文章均使用站内章节导航，支持窄屏、键盘、当前章节提示和无脚本锚点跳转。图模板的 MIT 许可保存在 `scripts/vendor/architecture-canvas/LICENSE` 及资源目录内。
