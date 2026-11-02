# CI 与主分支保护交接

2026-11-02 按“公共模板生成 → 远端 CI”顺序启用。

## 已生效

- `36f4459` 推送后，首次 [Static checks](https://github.com/zwhu/zwhu.github.io/actions/runs/41413354095) 全部通过：公共生成同步、6 项生成测试、学习页样式归属、SEO 同步、6 项 SEO 测试、5 项评论测试。
- `main` 必须通过 PR 合并；必需检查为 `check`，来源绑定 GitHub Actions（App ID `15368`），要求 PR 分支保持最新。
- 管理员同样受合并要求约束；禁止强推和删除 `main`。个人仓库所需审批人数设为 0，保留本人提交 PR、通过检查后自行合并的能力。
- GitHub Pages 保持从 `main` 根目录自动发布。静态检查工作流只读源码，不持有部署或管理权限。

保护配置已通过 API 写入并回读确认，快照为 [main-protection.json](../.github/main-protection.json)。该文件记录已应用的配置，不会因提交文件自动修改仓库设置；之后调整设置时先读取当前规则，保留新增约束，不直接覆盖成旧快照。

## 后续工作流程

1. 从最新 `main` 创建工作分支，默认使用 `codex/` 前缀。
2. 修改对应模板、元信息或正文，运行生成及本地检查，提交静态 HTML 与源文件。
3. 推送工作分支并创建 PR。PR 创建、更新会触发 `Static checks`；普通工作分支推送本身不会触发该工作流。
4. 检查通过、分支保持最新后正常合并，不使用管理员绕过。合并到 `main` 会再次运行检查并触发既有 Pages 发布。

本轮交接 PR 保存配置快照与维护说明，按同一门禁验收后合并。若 PR 检查失败，修复源文件或生成结果后再推送；不要临时关闭规则。

## 本地检查

```sh
python3 scripts/render-site.py --check
python3 scripts/test-site-generation.py
python3 scripts/check-learning-styles.py
python3 scripts/update-seo.py --check
python3 scripts/test-seo.py
node --test tests/comments.test.cjs
```

修改导航、目录元信息或公共模板后先运行 `python3 scripts/render-site.py`；迁入文章正文改动先运行对应生成脚本。位置约定见[公共模板说明](./site-generation-guide.md)。
