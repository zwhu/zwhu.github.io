# zwhu · 个人技术博客

网站：https://zwhu.github.io/

源码：https://github.com/zwhu/zwhu.github.io

此目录是正式维护工程。GitHub Pages 从 `main` 分支根目录自动发布，提交并推送后网站会更新。

原生 HTML / CSS / JavaScript 的个人技术博客，无构建依赖。暖白底、无衬线正文、少量朱砂红强调，采用紧凑的文章列表，支持行内代码和可横向滚动的代码块。目前收录 46 篇从 GitHub Issues 迁入的文章，以及两篇全文对照译文。

## 预览

在此目录运行 `python3 -m http.server 8765 --bind 127.0.0.1`，打开 http://127.0.0.1:8765/ 。

## 发布至 GitHub Pages

将此目录内的文件（包含 `.nojekyll`）放入个人网站仓库根目录。进入 Settings → Pages，选择 Deploy from a branch，分支 main，目录 /(root)，保存。

## 修改内容

- `index.html`：网站名、个人介绍、个人思考与翻译入口。
- `translations.html`：翻译留档专栏目录。
- `claude-code-review.html`、`engineers-new-problems.html`：两篇英中对照译文，原文出处、正文与插图保持完整。工作区原始文件未修改。
- 各文章 HTML：标题、日期、正文；新增文章时复制一篇并同步首页目录。
- `style.css`：共用颜色、字体与布局；`translation.css`：对照阅读样式；`archive.css`：专栏与评论样式。使用系统字体。

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

`learning.html` 收录六篇交互文档：首页与全站导航均提供入口。各篇使用稳定的 `learn-*.html` 文件名，正文与图表保留在页面中，交互脚本及原布局分别放在 `assets/learning/`，统一视觉放在 `learning.css`。目录元信息见 `content/interactive-learning.json`；修改文章信息时需同步目录与首页。

保留场景切换、训练实验、闪卡、测验、SVG 动画与提示词复制。Agent 记忆页原先依赖聊天环境的继续学习按钮已改为站内模块说明、源码阅读路线与自测。大型图表在窄屏局部横向滚动。
