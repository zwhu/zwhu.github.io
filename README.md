# zwhu · 个人技术博客

网站：https://zwhu.github.io/

源码：https://github.com/zwhu/zwhu.github.io

此目录是正式维护工程。GitHub Pages 从 `main` 分支根目录自动发布，提交并推送后网站会更新。

原生 HTML / CSS / JavaScript 的个人技术博客，无构建依赖。暖白底、无衬线正文、少量朱砂红强调，采用紧凑的文章列表，支持行内代码和可横向滚动的代码块。名字和个人介绍已使用用户提供的信息；三篇个人思考文章仍为占位示例，两篇翻译来自工作区现有的全文对照稿。

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

## GitHub 评论（待安装 giscus 后启用）

所有五篇文章均接入共用的 `comments.js`。采用 [giscus](https://giscus.app/zh-CN)，评论存放在本仓库的 GitHub Discussions。仓库已启用 Discussions，公开仓库 ID 和 Announcements 分类 ID 已填好。安装 giscus 前保留 `enabled: false`，不加载第三方评论脚本。

完成启用：

1. 将 [giscus GitHub App](https://github.com/apps/giscus/installations/new) 安装到 `zwhu/zwhu.github.io`，只选择此仓库。
2. 将 `comments-config.js` 的 `enabled` 改为 `true`，提交并推送。
3. 在真实域名下验证评论加载、GitHub 登录和发表评论。浏览器当前未登录 GitHub，安装及实际发表评论尚未完成。

配置里只有公开 ID，不需要 Token。评论按 `blog/文件名.html` 的固定标识对应讨论，因此之后更换域名不会改变标识；文章文件名应保持稳定且唯一。访客评论需要 GitHub 登录授权。正式接通后的登录与评论尚未验证。

链接采用相对路径，可用于个人站与项目站。Git 提交使用 GitHub noreply 邮箱。
