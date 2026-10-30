# zwhu 的个人技术博客

原生 HTML / CSS / JavaScript，部署到 GitHub Pages；无需构建工具。

- 新增页面、发布文章或修改样式前，必须阅读并遵循 [视觉规范](./VISUAL_STYLE.md)；默认沿用现有视觉，不自行改版。此文件固定视觉要求，不规定文章写作语气。
- 内容默认使用中文；保持简洁技术博客的风格，暖白底与少量朱砂红。
- 首页区分“思考与实践”和“翻译留档”，个人经历放在“关于”。
- 译文须保留原文出处、正文、插图与中英对照；未经要求不要删减。
- 站内使用相对链接；文章文件名是评论标识的一部分，应保持稳定且唯一。
- 共用样式见 style.css；译文见 translation.css；专栏及评论见 archive.css。
- giscus 使用 comments-config.js 中的公开标识，不在源码中保存密钥。
- 全站使用 Cloudflare Web Analytics；新增、复制或修改 HTML 页面时，须在 `</body>` 前保留现有统计代码，每页恰好一份，沿用现有公开站点 token，不写入账户 API 密钥。修改文章生成逻辑时，同步维护 scripts/render-blog-issues.py 中的 `ANALYTICS` 和 `FOOTER`，确保重新生成后仍保留统计。
- 修改后检查链接、移动端排版与相关阅读按钮；保留无关修改。
