# zwhu 的个人技术博客

中文技术博客，原生 HTML / CSS / JavaScript，直接部署到 GitHub Pages，无需构建工具。

- 保留用户已有及无关修改，不在源码中保存密钥。
- 保留技术含义、引用与真实发表日期；译文保留出处、正文、插图与中英对照，未经要求不删减。
- 只读取当前任务对应的指南；页面与样式沿用现有视觉。

| 任务 | 开始前读取 |
| --- | --- |
| 写作、润色；收到用户对文档表达的纠正时记录修改原因 | [doc-lint](./.agents/skills/doc-lint/SKILL.md)，按其中流程读取个人偏好、记录反馈 |
| 新增页面、发布文章、修改样式 | [视觉规范](./VISUAL_STYLE.md) |
| 页面生成、导航、目录、统计、SEO | [生成说明](./content/site-generation-guide.md)，维护源文件后重新生成，不手改 `site:*` 区块 |
| 学习页 | [学习页复用](./content/learning-styles-guide.md) |
| 图片与加载性能 | [性能维护](./content/loading-performance.md) |

修改后运行 `python3 scripts/verify.py`；检查范围与失败处理见[验证流程](./content/verification-guide.md)。涉及页面或样式时，另做浏览器预览并核对移动端与实际交互；开 PR 后运行 `node scripts/pr-screenshots.cjs --pr <编号>`，把桌面与手机截图附到 PR。
