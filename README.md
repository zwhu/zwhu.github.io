# zwhu · 技术博客 Demo

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

## GitHub 评论（待仓库创建后启用）

所有五篇文章均接入共用的 `comments.js`。采用 [giscus](https://giscus.app/zh-CN)，评论存放在未来博客公开仓库的 GitHub Discussions。当前没有仓库，不加载第三方评论脚本，页面明确显示尚未开通。

创建博客仓库后：

1. 在仓库 Settings → General → Features 启用 Discussions。
2. 将 [giscus GitHub App](https://github.com/apps/giscus) 安装到该博客仓库。
3. 在 Discussions 创建评论分类（建议公告类型，如 Blog comments）。
4. 在 [giscus 配置页](https://giscus.app/zh-CN) 选择仓库和分类，把生成代码里的 `data-repo`、`data-repo-id`、`data-category`、`data-category-id` 分别填入 `comments-config.js` 的四项。
5. 发布到 GitHub Pages 后，在真实域名下验证加载、GitHub 登录和发表评论。

配置里只有公开 ID，不需要 Token。评论按 `blog/文件名.html` 的固定标识对应讨论，因此之后更换域名不会改变标识；文章文件名应保持稳定且唯一。访客评论需要 GitHub 登录授权。正式接通后的登录与评论尚未验证。

链接采用相对路径，可用于个人站与项目站。本示例未对外发布。
