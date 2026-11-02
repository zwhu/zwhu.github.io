# zwhu 的个人技术博客

原生 HTML / CSS / JavaScript，部署到 GitHub Pages；无需构建工具。

- 新增页面、发布文章或修改样式前，必须阅读并遵循 [视觉规范](./VISUAL_STYLE.md)；默认沿用现有视觉，不自行改版。此文件固定视觉要求，不规定文章写作语气。
- 内容默认使用中文；保持简洁技术博客的风格，暖白底与少量朱砂红。
- 首页区分“思考与实践”和“翻译留档”，个人经历放在“关于”。
- 译文须保留原文出处、正文、插图与中英对照；未经要求不要删减。
- 站内导航与资源使用相对链接；canonical、Open Graph、JSON-LD 和 sitemap 使用正式站点的绝对 HTTPS 地址。文章文件名是评论标识的一部分，应保持稳定且唯一。
- 共用样式见 style.css；译文见 translation.css；专栏及评论见 archive.css。
- 修改学习页前阅读 [复用说明](./content/learning-styles-guide.md)。公共阅读外壳与基础控件放在 `learning.css`，课程布局、图示和状态放在 `assets/learning/<主题>.css`；修改后运行 `python3 scripts/check-learning-styles.py` 并实际预览，避免课程补丁重新混入公共文件。
- giscus 使用 comments-config.js 中的公开标识，不在源码中保存密钥。
- 全站使用 Cloudflare Web Analytics；新增、复制或修改 HTML 页面时，须在 `</body>` 前保留现有统计代码，每页恰好一份，沿用现有公开站点 token，不写入账户 API 密钥。修改文章生成逻辑时，同步维护 scripts/render-blog-issues.py 中的 `ANALYTICS` 和 `FOOTER`，确保重新生成后仍保留统计。
- SEO 配置见 content/seo.json；新增、删除页面或调整标题、摘要、作者信息后，运行 `python3 scripts/update-seo.py`，并用 `--check` 检查元数据与 sitemap 是否同步。文章生成脚本会自动执行此步骤；部署仍直接使用静态文件。
- 站长工具的公开所有权验证标记放在 content/seo.json 的 site.verification 中，由脚本写入首页；验证成功后仍需保留，不在此配置中保存登录凭据或 API 密钥。
- SEO 保留真实发表日期，不将迁移、样式或评论更新时间当成文章更新；仅在有依据时填写 dateModified。content/doc-lint-comparison/ 下的对照快照保留 noindex，不加入 sitemap；robots.txt 不阻止抓取这些页面，以便爬虫读取 noindex。
- 修改后检查链接、移动端排版与相关阅读按钮；保留无关修改。
