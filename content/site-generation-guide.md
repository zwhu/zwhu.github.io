# 公共模板与目录生成

全站仍直接提供静态 HTML，不增加运行时请求或 GitHub Pages 构建步骤。维护时用 Python 3.9+ 标准库更新公共区块，生成后的 HTML 一起提交。

站点根目录是 `docs/`；GitHub Pages 发布 `main /docs`，页面 URL 不含 `/docs`。维护脚本在仓库根目录运行，读取根目录的 `content/` 与 `templates/`，把页面和资源写入 `docs/`。元信息中的页面、图片路径仍相对于站点根目录填写，不加 `docs/` 前缀。

`content/` 中原有公开笔记、数据与文稿对照页由 `render-site.py` 同步到 `docs/content/`；只编辑源文件，副本一起提交。`--check` 会检查副本同步。

## 什么放在哪里

| 内容 | 维护位置 |
| --- | --- |
| 全站主导航文字、顺序、相对链接、站点标识 | `content/site-navigation.json` |
| 公共 HTML 结构 | `templates/`：导航、通用页脚、评论、统计、列表条目、三类目录与相关阅读 |
| 原创文章的标题、发表日期、目录摘要、标签；`readingTime: true` 时在目录和文章元信息显示阅读时长 | `content/original-articles.json` |
| 分享卡片（1200×630 `og:image`）的文案与图片路径 | `content/og-images.json`；`python3 scripts/render-og-images.py` 用本机 Chrome 渲染 PNG，`--check` 只校验文件 |
| 关于页能力圈的格子、面积、深浅与说明 | `content/about-map.json`；`python3 scripts/render-about-map.py` 写入 `docs/about.html` 的 `about-map` 区块，`--check` 只检查 |
| 迁入文章的正文、日期、评论与图源快照 | `content/blog-issues.json`；由 `scripts/render-blog-issues.py` 生成正文 |
| 学习页的目录标题、摘要、标签、顺序与相关阅读选择 | `content/interactive-learning.json`，`related` 引用已有课程 slug |
| 译文的目录标题、摘要、顺序与标签 | `content/translations.json`；译文发表日期读取 `content/seo.json` |
| 正式域名、搜索摘要覆盖项、作者、译文归属、公开验证标记 | `content/seo.json` |
| 原创与译文正文、来源页脚、章节 ID、章节导航、课程讲解和图示 | 对应文章 HTML；章节导航按实际内容维护，不从标题猜测短标签 |
| 视觉与交互 | 沿用现有 CSS／JavaScript；学习页样式归属见[复用说明](./learning-styles-guide.md) |

目录标题和摘要用于站内发现；HTML 文章标题与正文仍由作者维护。SEO 摘要可以按搜索展示需要单独覆盖，不把摘要差异当作内容丢失。修改文章标题时，应同步正文和对应目录元信息。

原创文章默认参与首页最新六篇列表；在 `content/original-articles.json` 中设置 `home: false` 可移除该首页入口，文章仍保留在“思考”完整目录中。

## 如何更新

```sh
python3 scripts/render-site.py
python3 scripts/verify.py
```

第一条命令更新公共区块、首页三组列表、三类目录及学习页相关阅读，随后更新 SEO。第二条执行本地与 CI 共用的[验证流程](./verification-guide.md)，包含生成同步、链接、样式、性能、SEO 与评论检查。生成脚本的 `--check` 模式只检查、不写入，生成结果过期、页面未登记或区块标记不完整时返回非零。

迁入文章的正文发生变化时，先更新快照，再运行 `python3 scripts/render-blog-issues.py`。这个入口会继续调用公共生成与 SEO，不会恢复另一套导航、页脚或统计代码。无需访问 GitHub。

新增页面时沿用同类 HTML 的外壳，登记到对应元信息文件，再运行生成命令。文件名作为站内路径和评论标识保持稳定；学习页还须有同名课程 CSS。新课程的 `related` 只能引用已有课程，不可重复或指向自身。所有正式 `docs/` 根目录 HTML 都须登记；`content/doc-lint-comparison/` 和独立图示不在此生成范围内。

阅读时长按 `.prose` 正文估算（中文约 400 字／分钟、英文约 200 词／分钟，不计图、目录与脚本），写入目录条目和文章 `<!-- site:reading-time:* -->` 区块。新开启的文章须在 `.meta` 的日期后放一对空标记。

修改分享卡片文案后，先运行 `render-og-images.py`，再运行 `update-seo.py`。只有登记的页面输出 `og:image` 与 `summary_large_image`，其他页面保持 `summary`。

新增、删除页面或调整标题、摘要、作者信息时，核对 `content/seo.json` 并更新 SEO。保留真实发表日期，仅在有正文更新依据时填写 `dateModified`；首页公开所有权验证标记在 `site.verification` 中维护，验证成功后继续保留。`content/doc-lint-comparison/` 的快照保留 noindex，不加入 sitemap，robots.txt 允许抓取。这些同步约束由 verify 检查。

## 生成与手写内容的边界

`<!-- site:<名称>:start -->` 与对应 `end` 包住生成区块。修改模板或元信息后重新生成，不手改区块内部，也不移动、复制或截断这些标记。标记外的正文保留；生成前先计算并验证所有页面，遇到无法确定的区块时停止，不猜测替换范围。

全站主导航从页面所属目录确定当前栏目：目录自身使用 `aria-current="page"`，栏目中的文章使用 `aria-current="location"`。首页不固定高亮某个栏目。关闭 JavaScript 时仍有完整导航、列表和相关阅读。

通用页脚按现有文章、学习页、译文目录三种实际用途生成。首页个人页脚、译文来源说明和课程内部说明保留作者维护。评论脚本版本统一在 `scripts/site_templates.py`，giscus 的公开配置放在 `docs/comments-config.js`。

Cloudflare Web Analytics 统一由 `templates/analytics.html` 提供，在 `</body>` 前恰好一份并异步加载，沿用现有公开站点 token，不保存账户 API 密钥。修改迁入文章的生成逻辑时，同步维护 `scripts/render-blog-issues.py` 的 `ANALYTICS` 和 `FOOTER`，保证重新生成后统计仍然保留。verify 检查统计数量、异步属性、公开 token 与模板同步。

生成后检查桌面与窄屏排版、导航和锚点、相关阅读、正文与原图、统计和评论入口。自动检查能发现目录与模板漂移，不能代替视觉和交互验收。
