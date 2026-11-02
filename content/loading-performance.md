# 加载性能：结果与维护

2026-11-02，从 `a54ee08` 开始优化。最重译文的 DOM 就绪时间在受控网络下改善约 **15.6 倍**；这不代表所有页面、所有加载指标都快了 10 倍。

## 实测结果

375 × 900px 视口，1 Mbps 带宽、每请求 150ms 响应延迟，gzip、`no-store` 冷缓存，无 CPU 降速。每个场景测 3 次，取中位数。只在本地测量服务中将 Cloudflare 与 giscus 替换为小型桩脚本，隔离第三方网络波动；正式站点仍使用原服务。原始数据见 [loading-measurements.json](./loading-measurements.json)。

| 页面 | DOM 就绪：优化前 | 优化后 | 倍数 |
| --- | ---: | ---: | ---: |
| Claude Code 译文 | 9,480ms | 608ms | 15.6× |
| 工程师新问题译文 | 1,150ms | 545ms | 2.1× |
| 首页 | 384ms | 373ms | 1.0× |

Claude Code 页首屏最大内容绘制（观测窗口内 LCP）从 904ms 到 436ms，约 2.1×；首次内容绘制从 492ms 到 436ms。首页原本很轻，基本不变。DOM 就绪反映文档解析与延迟脚本完成，译文阅读工具在文末脚本中绑定；不能把这一指标写成首屏绘制速度。定义见 [MDN](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceNavigationTiming/domContentLoadedEventEnd)。

这组实验定位了源文件与资源交付的成本，没有模拟 GitHub Pages CDN、真实移动设备 CPU 或各地第三方网络。线上 p75 等真实访问结果需继续通过现有 Cloudflare Web Analytics 观察。

## 改了什么

- 两篇译文原先共 14 个 Base64 图片引用，去重后 8 份原始图片按原字节存入 `assets/translations/original/`。HTML 不再携带图像二进制。Claude Code 页原文件约 1.71 MB，gzip 约 1.13 MB；现在 HTML 约 76 KB，gzip 约 26 KB。
- 24 份正文栅格资源统一登记到 `content/image-assets.json`。PNG／JPEG 使用 WebP 的多尺寸派生资源，原图仍作回退及完整图片入口；GIF 保留动画。评测集文章的 6 张大图合计从原始 12.22 MB，变为 1024px 档的约 443 KB（约 27.6 倍传输量差异，不当作时间倍数）。
- 图片声明固有尺寸、延迟加载和异步解码。浏览器按 `srcset`／`sizes` 选择派生资源，关闭 JavaScript 也保留图片。原生延迟加载与尺寸预留的依据见 [web.dev](https://web.dev/articles/browser-level-image-lazy-loading)。
- 统计脚本保留原 URL、公开 token 和每页一份，增加异步执行，避免第三方模块影响 DOM 就绪。评论客户端在评论区进入视口前 300px 才加载；缺少 IntersectionObserver 时保持直接加载。文章文件名与评论映射不变。
- Super-agent 的正文配图和路由示意收回正文列，最大 650px，局部图最大 560px。七张重绘图改为暖白底、较轻标题；图 8 重排节点，标签避开连线。原图、来源、编号和关系均保留。

## 维护位置与门禁

| 内容 | 位置／命令 |
| --- | --- |
| 原图及完整分辨率 | 原有 `assets/` 路径；译文提取原图在 `assets/translations/original/` |
| WebP 派生资源 | `assets/optimized/`，由 `python3 scripts/optimize-images.py` 生成 |
| 原图校验值、尺寸与派生资源清单 | `content/image-assets.json`，随脚本生成，不手填校验值 |
| 图片 HTML 与旧文章生成接入 | `scripts/image_assets.py`、`scripts/render-blog-issues.py` |
| 统计与评论 | `templates/analytics.html`、`comments.js`；脚本引用由公共生成同步 |
| 重绘图与布局 | `scripts/render-superagent-source-diagrams.cjs`、`assets/superagent/editorial.css` |

图片生成只需 Python 标准库与 `cwebp`，编码器仅用于维护，网站和 CI 不依赖它。编码为 q88，提供不超过原尺寸的 640／1024／1600px 档；原图不覆盖。修改后运行完整文章及公共生成，图片生成、文章生成均验证了重复执行不产生漂移。

CI 执行 `python3 scripts/check-performance.py`：正式 HTML 不超过 96 KiB 原文件／32 KiB gzip，拒绝内嵌图片；图片须有尺寸与匹配的响应式来源，派生资源不超过 192 KiB，原图校验值不变，统计每页一份且异步。32 KiB gzip 为保留完整长译文的预算，当前纯文档下限约 25 KiB，不通过删正文压缩到更小。评论测试验证初始不发请求、接近页尾后只加载一次、主题地址和评论标识稳定；图生成使用 `--check` 检查是否同步。

## 复测

将优化前版本导出到临时目录，再运行：

```sh
python3 scripts/preview-loading.py --before /tmp/zwhu-loading-before
```

同一个本地服务的 `/before/claude-code-review.html` 与 `/claude-code-review.html` 分别提供优化前后版本。浏览器中的 `#loading-measurement` 隐藏节点保存真实 Navigation／Paint／LCP 观测数据；每次导航独立采样，保持相同视口，不在采样中滚动或点击。服务只绑定 `127.0.0.1`，探针和第三方桩仅用于本地对照，不进入正式 HTML。

视觉验收覆盖 375、560、700、1280、1600、2560、3440px：全部正文配图宽度不超过所在正文列，无整页横向溢出。14 张桌面／手机重绘图的实际文字宽度未超出节点；原文正文、图片顺序、alt、发表时间及原始栅格文件保持不变。中文阅读、字号切换、相关阅读和评论加载需随资源改动继续验证。
