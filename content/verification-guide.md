# 验证流程

在仓库根目录运行：

```sh
python3 scripts/verify.py
```

需要 Python 3.9+ 与支持 `node --test` 的 Node.js。本地与 `.github/workflows/static-checks.yml` 共用这个入口；检查清单只维护在 `scripts/verify.py`，新增检查时在其中登记。既有 CI 作业名 `check` 保留，继续对应主分支保护。

verify 不更新页面、不生成图片、不请求网络。所有检查都会执行，任何一项失败都会返回非零，并在末尾列出失败项。缺少依赖也视为失败，不跳过检查。测试用的临时文件会自动清理。

## 程序检查的范围

| 规则 | 实现 |
| --- | --- |
| 公共区块与目录保持同步、页面登记、路径唯一、相关阅读有效、生成不覆盖手写正文、公开 content 副本同步 | `render-site.py --check`、`test-site-generation.py` |
| 站内导航与资源使用相对路径，目标文件、HTML 锚点和 srcset 资源存在 | `check-links.py`、`test-links.py` |
| 学习页样式归属、主题作用域、变量与加载顺序 | `check-learning-styles.py` |
| HTML 和图片预算、原图校验值、图片尺寸与响应式来源、统计恰好一份且异步 | `check-performance.py` |
| 关于页能力圈生成同步，分享图片尺寸与预算 | `render-about-map.py --check`、`render-og-images.py --check` |
| canonical、分享元数据、JSON-LD、sitemap、robots 与配置同步；发表日期、译文归属、公开验证标记及快照 noindex | `update-seo.py --check`、`test-seo.py` |
| 评论按需加载、只初始化一次，主题地址和文章标识稳定 | `tests/comments.test.cjs` |
| 检查失败、缺少执行程序时返回失败，后续检查仍执行 | `test-verify.py` |

链接检查从 `docs/` 根目录正式 HTML 出发，继续检查它们引用的本地 HTML；校验 `href`、`src`、`poster`、`xlink:href` 和 `srcset`。canonical 允许正式绝对地址，搜索元数据由 SEO 检查负责；外部链接不联网探测，CSS／JavaScript 中动态生成的地址不在静态链接检查范围内。

正文配图的 SVG 由 `scripts/render-*` 生成后提交，verify 不重新生成比对。改图时先改脚本，再运行对应脚本重新生成，不直接手改 SVG。

## 失败后如何处理

- 公共区块或目录过期：修改对应模板／元信息后运行 `python3 scripts/render-site.py`。不手改 `site:*` 生成区块。
- SEO 过期：核对 `content/seo.json`，运行 `python3 scripts/update-seo.py`。不以迁移、样式或评论更新时间替代真实发表日期。
- 迁入文章正文变化：先更新 `content/blog-issues.json`，再运行 `python3 scripts/render-blog-issues.py`，它会继续更新公共区块与 SEO。
- 图片、图示或样式失败：按报错定位源文件，参照对应维护指南修复。不要通过删正文、删原图或关闭检查来消除错误。

修复后重新运行 verify，提交源文件与生成结果。静态文件仍由 GitHub Pages 直接发布。

## 需要实际审阅的部分

程序检查无法确认语气是否符合作者习惯、修改原因是否真实、译文是否完整准确，也不能证明 CSS 在浏览器中的最终排版符合预期。

写作任务按 [doc-lint](../.agents/skills/doc-lint/SKILL.md) 逐段复核。页面或样式改动按[视觉规范](../VISUAL_STYLE.md)实际预览桌面与移动端，确认正文、插图、导航、相关阅读按钮和触及的交互可用。交付时说明执行范围，不把静态检查通过写成视觉验收通过。

## PR 截图

涉及页面或样式的 PR，创建或更新后在本地运行：

```sh
node scripts/pr-screenshots.cjs --pr <编号> [--section <章节 id>]...
```

- 默认截取相对 `origin/main` 有改动的 `docs/` 根目录 HTML，也可用 `--page name.html` 指定；每页截首屏，`--section` 再截对应章节，从标题截到下一个同级标题。宽度默认 1280px 与 375px，可用 `--widths` 调整。
- 图片推到 `pr-screenshots` 分支的 `pr-<编号>/` 目录，不进 main，也不影响 Pages。PR 描述里的截图区块按提交号引用图片；同一 PR 再次运行时替换该区块，旧图仍可从历史提交打开。
- 需要本机 Google Chrome（或设置 `CHROME=/path/to/chrome`）与已登录的 `gh`。不加 `--pr` 时只把截图存到临时目录，供本地查看。

截图方便在 PR 里看改动，不能代替浏览器里的实际交互检查；交付时仍说明预览过哪些宽度和交互。
