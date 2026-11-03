# 博客是否值得迁移到 Cloudflare

调研日期：2026-10-31。依据为当前仓库源码和当日查阅的官方文档。本文只做评估，没有创建 Cloudflare 托管项目、购买套餐、修改 DNS 或迁移网站；大陆网络表现尚未实测。

## 建议

**目前继续用 GitHub Pages，先完成 SEO；不为这个博客购买 Pro。如果希望获得部署预览、响应头和路由控制，可以用 Cloudflare Workers Static Assets 免费试跑，再根据实测决定是否迁移。**

判断依据：博客没有服务端需求，现有发布方式已经简单；迁移可以增加部署与 HTTP 配置能力，但不能据此推断国内访问更快，也不会自动提高搜索排名。若决定长期经营个人博客，先确定自己持有的域名，比在两个平台的免费子域名之间切换更有长期价值。这是针对本项目的建议，不是平台性能测试结论。

## 截图中的套餐是什么

截图对应 Cloudflare 的 Network／CDN 网站套餐：Free 为 0 美元/月；Pro 是年付折合 20 美元/月，也就是每年 240 美元，按月购买为 25 美元/月。这些套餐提供 DNS、CDN、安全规则等能力，不能把购买 Pro 理解成购买博客托管或国内加速服务。[官方价格](https://www.cloudflare.com/plans/)

托管静态博客对应的是 **Pages** 或 **Workers Static Assets**。Pages 仍有现行部署文档，但其入门页已明确建议新项目使用 Workers，因此新建试验项目时优先评估 Workers；这不等于 Pages 已停止运行。[Pages 入门页](https://developers.cloudflare.com/pages/get-started/)

Cloudflare 的付费体系也要分开：网站 Pro 与 Workers Paid 不是同一套餐。Workers Paid 的账户最低费用为 5 美元/月，本博客如果只使用免费静态资源托管，并不需要升级它。域名注册费另计，具体取决于后缀、注册和续费报价；不能拿 Pro 的价格推算域名费用。[Workers 价格](https://developers.cloudflare.com/workers/platform/pricing/)、[域名注册说明](https://developers.cloudflare.com/registrar/)

## 当前博客的迁移条件

以下是调研开始时的本地快照，不代表托管平台的流量或真实访问速度：

| 项目 | 当前情况 | 对迁移的意义 |
| --- | --- | --- |
| 页面 | 根目录 59 个正式 HTML 页面，另有润色对照快照 | 无需改用框架或重新写文章 |
| 运行方式 | 原生 HTML／CSS／JavaScript，已生成静态文件 | 不需要 SSR、数据库或 Functions |
| 发布 | GitHub `main` 根目录自动发布 | 可以继续把 GitHub 当源码仓库 |
| 资源体积 | 排除 `.git`、`.agents` 后约 137 个文件、16.8 MiB；实际上传应再筛选 | 远低于免费静态资源容量门槛 |
| 最大文件 | 一张 PNG 约 2.29 MiB；`claude-code-review.html` 约 1.63 MiB | 未触及 25 MiB 单文件限制，但内嵌图片使译文 HTML 偏大 |
| 域名 | `zwhu.github.io`，没有 `CNAME` 自定义域名配置 | 无法把这个 GitHub 提供的域名直接带到 Cloudflare |
| 评论 | `comments.js` 使用 `blog/` 加 URL 最后一段作为 giscus 标识 | **必须保留 `.html` 对评论标识的影响** |
| 统计 | 已嵌入 Cloudflare Web Analytics | 使用统计不要求迁移托管 |

页面、发布与评论的本地依据分别见 [README](../README.md)、[comments.js](../comments.js) 和 [统计约定](../AGENTS.md)。文件量是工作区清点值，包含文档等不必部署的内容；未来试跑应生成部署白名单，避免把维护材料、快照与配置全部当网站资源上传。

## 四种方案对比

| 方案 | 主要收益 | 需要处理的事 | 对这个博客的判断 |
| --- | --- | --- | --- |
| 继续 GitHub Pages | 保持现有网址、发布和评论流程，成本低 | HTTP 响应头和服务端路由控制有限 | **现在的默认选择** |
| GitHub Pages ＋自定义域名＋Cloudflare 免费代理 | 保留 GitHub 托管，增加 DNS／边缘代理能力 | 域名费用、DNS、源站证书签发与续期、缓存一致性 | 可选，但多一层配置，不是无成本提速 |
| Cloudflare Pages Git 集成 | 自动部署、分支预览、`_headers`、`_redirects` 和部署回滚 | 默认去除 `.html`、自定义域名与 SEO 地址迁移 | 静态博客能用，但本项目需要先解决路径兼容 |
| Workers Static Assets | 免费静态托管，支持 Git 集成、响应头和 HTML 路径配置 | 增加部署配置；验证首页、404、预览与既有路径 | **如要新建 Cloudflare 试跑，优先评估** |

Pages 和 Workers 都可连接 GitHub 自动部署，源码无须离开 GitHub。Pages 的纯静态文件也不要求引入构建框架。DNS Only 只是让 Cloudflare 提供 DNS；只有开启代理，HTTP 流量才通过 Cloudflare，不能把两者的效果混在一起。[Pages Git 集成](https://developers.cloudflare.com/pages/get-started/git-integration/)、[静态 HTML 部署](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)、[Workers GitHub 集成](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)、[DNS 代理状态](https://developers.cloudflare.com/dns/proxy-status/)

`zwhu.github.io` 是 GitHub 提供的默认站点地址，不是用户控制 DNS 的自有域名。要通过自己设置的 Cloudflare DNS／代理接入，应使用自己持有的域名，并在 GitHub Pages 或 Cloudflare 托管项目中配置。GitHub Pages 支持从默认站点切换到自定义域名；这一步和更换托管平台可以分开进行。[GitHub 自定义域名配置](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

## 免费配额是否够用

| 项目 | 官方当前免费范围 | 本项目 |
| --- | --- | --- |
| Pages 静态请求 | 不调用 Functions 的静态资源请求免费且不限量 | 当前运行方式适用 |
| Pages 构建 | 500 次/月，同一时间 1 次，单次最多 20 分钟 | 普通博客发布通常足够；高频自动提交需计数 |
| Pages 文件 | 20,000 个，每个最多 25 MiB | 当前文件量和最大资源足够小 |
| Workers Static Assets | 静态请求免费不限量，存储无额外费用 | 无须为了静态页面购买 Workers Paid |
| Workers 静态文件 | 免费 20,000 个，每个最多 25 MiB | 当前可容纳 |
| Workers Builds | 免费每月 3,000 构建分钟，1 个并发，单次最多 20 分钟 | 没有复杂构建，预计负担很小；仍需观察实际分钟数 |

来源：[Pages 计费](https://developers.cloudflare.com/pages/functions/pricing/)、[Pages 限制](https://developers.cloudflare.com/pages/platform/limits/)、[Workers 静态资源计费](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)、[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)、[Workers Builds 限额](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)。

这里的“静态不限量”不包括 Worker 代码、Pages Functions、数据库等动态产品。若为了重写、鉴权或日志让每个请求先执行 Worker，必须另看动态执行配额；不要把静态免费范围扩展成所有 Cloudflare 服务免费。[计费边界](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

## 国内访问：没有证据支持“迁移后一定更快”

Cloudflare 官方说明，境外节点向中国大陆交付内容会面临跨境网络的延迟与可靠性问题。中国网络 China Network 是企业套餐的额外订阅，需要对应域名具备有效 ICP 备案或许可证；并非所有 Cloudflare 产品都在该网络中提供。因此 Free、Pro、`pages.dev` 或 `workers.dev` 都不能被当成已获得大陆节点的证明。[中国网络说明](https://developers.cloudflare.com/china-network/)

本次未取得现站与候选站在大陆多地、电信／联通／移动网络下的同期测试结果，因此不能判断哪个更稳定。仅仅能打开 Cloudflare 控制台，或者用境外服务器请求成功，都不足以回答国内读者的体验。

值得试跑的理由是验证实际表现。建议让真实目标网络同时访问现站与候选站，比较 DNS／TLS 是否成功、首字节时间、HTML 和图片加载完成时间、失败率，并覆盖晚间时段。首页、最大译文和带图表的原创文章分别测；同时单独验证 giscus 和统计上报，因为迁移 HTML 托管并不会消除这两项外部依赖。

## 本项目最大的兼容性风险：`.html` 和评论

Pages 默认把 `/contact.html` 重定向到 `/contact`。Workers Static Assets 默认的自动 HTML 处理也有类似的扩展名规范化，但可以设置 `assets.html_handling` 为 `none`，让 `/file.html` 直接返回对应文件。[Pages 路由默认值](https://developers.cloudflare.com/pages/configuration/serving-pages/)、[Workers HTML 处理](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)

当前 [comments.js](../comments.js) 的标识算法是 `blog/` 加 `location.pathname.split('/').pop()`。因此 `/ub-mode-bench.html` 的讨论标识是 `blog/ub-mode-bench.html`，而规范化后的 `/ub-mode-bench` 会变成另一个标识。这不是仅换域名：用户可能看到一组新的空评论。

迁移优先保留 `.html` 和现有文件名。若平台上最终选择无扩展名地址，则应先建立明确的文章 ID 映射，使新旧 URL 都对应旧 giscus 标识，不能简单使用新 URL 的 basename。要连同锚点深链接、带查询参数链接、相关阅读、图片、主题 CSS 和前进后退一起测试。

关闭 Workers HTML 自动处理后，还要单独处理 `/` 到首页文件的访问与真正的 404。可以评估站内 `200` 重写，但配置需在候选站验证，不能只改一个 `html_handling` 字段就宣称迁移完成。Workers 支持站内代理规则，不能用它代理外部站点。[Workers 重定向与站内代理](https://developers.cloudflare.com/workers/static-assets/redirects/)

Pages 若没有顶层 `404.html`，会按 SPA 方式对未知路径返回首页。本博客是多页面静态站，迁移时应避免失效链接返回首页 `200` 形成软 404。[Pages 404 行为](https://developers.cloudflare.com/pages/configuration/serving-pages/)

## SEO、预览和统计的迁移顺序

1. **先保持一个正式主地址。** 当前 SEO 使用 `https://zwhu.github.io/`。试跑时不能把候选站误声明为正式站，也不要同时让两个完全相同的站点竞争收录。
2. **先选长期域名，再分阶段变更托管。** 如果要换自有域名，可先在 GitHub Pages 上启用，再保持该域名切换底层托管，减少同时改变域名、路径、布局的变量。GitHub 默认域名的旧入口如何跳转，需要在实际启用配置后逐页验证，不能由 Cloudflare 替用户控制 `github.io` 的 DNS。
3. **真正迁移时统一更新地址。** canonical、sitemap、结构化数据、Open Graph、robots 中的 sitemap 地址与站长平台配置均应使用最终域名；保留一一对应的旧新 URL 映射并测试永久跳转。Google 对迁移建议也是先准备映射、配置旧址跳转，再监测两端。[Google 网站迁移指南](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
4. **候选站阻止收录。** Pages 分支预览默认带 `X-Robots-Tag: noindex`，但不能把这个结论套到其生产 `pages.dev` 域名，或假设所有 Workers URL 都带同样配置。候选站应实际检查 HTTP 响应；正式域名切换后要确认没有误留 `noindex`。[Pages 预览索引策略](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
5. **统计单独验证。** 为最终域名检查 Cloudflare Web Analytics 的站点配置，保持每页一次统计脚本；若改用平台自动注入，先检查它与现有手动代码是否重复。不要把旧域名的统计成功当成新域名也能上报。[Web Analytics 接入](https://developers.cloudflare.com/web-analytics/get-started/)

## 可逆试跑方案

这是后续执行建议，本次没有执行这些操作：

1. 保存当前发布提交与 Pages 配置，继续让 GitHub Pages 对外服务。
2. 创建独立的 Workers Static Assets 免费候选项目，GitHub 集成只授权所需仓库；从受控部署目录上传 HTML、CSS、JS、图片、SEO 文件和主题，排除维护快照与仓库工具文件。
3. 保留 `.html`，验证 `/`、`/index.html`、文章、目录、错误路径和 `#results` 等锚点。若使用 Pages，构建预设选无框架，现有静态文件可直接部署；上传目录必须与实际发布目录一致。
4. 候选域名设置 `noindex`，暂不修改正式 canonical、GitHub Pages 域名设置或对外链接。
5. 完成大陆目标网络的对照测试，并验证评论能够对应同一旧讨论、统计不重复、移动端和译文交互正常。
6. 只有测试达到预期，才准备域名切换与旧址跳转。保留 GitHub Pages 回退能力；Cloudflare 部署版本本身也有回滚机制，但部署回滚不能替代 DNS 与 SEO 地址的回退。[Pages 回滚](https://developers.cloudflare.com/pages/configuration/rollbacks/)、[Workers 回滚](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

建议的通过条件：全部正式页面和资源可访问，失效路径返回正确 404；评论仍使用旧标识；没有多余的重复收录入口；国内实测的失败率和加载体验至少不差于现站；无须为该博客引入 Pro 或动态后端。

## 尚未验证

- 候选托管站未创建，所有路由、重写、证书和回滚步骤均未作线上验证。
- 没有大陆多地三网实测，不能保证 Cloudflare 的可达性或速度优势。
- 未登录站长平台，未知当前收录、自然流量与各来源访问量。
- 用户尚未选定自有域名，因此无实际域名价格、备案状态或最终 DNS 方案。

现阶段最有价值的投入仍是完成 SEO、继续积累有来源和可复现数据的原创文章，以及建立真实网络体验的测量。Cloudflare 值得免费试验，尚不构成立即正式迁移或付费的理由。
