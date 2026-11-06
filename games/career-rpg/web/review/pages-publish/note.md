# Pages 发布核对

本地把 `docs/` 当作站点根（`python` 静态服务，`.mjs` 为 `text/javascript`）。这对应合并后 GitHub Pages 从 `main /docs` 提供的路径。尚未合并，没有请求线上的 `https://zwhu.github.io/`。

合并后可玩地址：

- https://zwhu.github.io/games/career-rpg/
- https://zwhu.github.io/games/career-rpg/?chapter=hefei
- https://zwhu.github.io/games/career-rpg/?chapter=nanjing
- https://zwhu.github.io/games/career-rpg/?chapter=hangzhou

不带参数与 `?chapter=nanjing` 都是南京。`docs/.nojekyll` 原本就在，这次没有再加，也没有改博客首页、导航或文章列表。游戏页仍是 `noindex`。

本地结果（见同目录 `checks.json` 与截图）：

- `/games/career-rpg/`、三个章节查询、`main.mjs`、`style.css`、三份章节 JSON、南京/合肥/杭州底图和行走图集都是 HTTP 200。
- 页面去掉 `no-js` 后，舞台画布为 768×432。「游戏脚本尚未启动」仍在 HTML 里作为无脚本时的说明，计算后为 `display: none`，游戏没有停在这句话上。
- 南京：标题「南京，第一次上线」，章节 `nanjing-first-release`。关掉开场对话后按右方向键，脚底从 (172, 154) 走到 (202, 154)，朝右，`moving` 为真。见 `nanjing-stage.png`、`nanjing-walk.png`。
- `?chapter=nanjing`：同一标题和南京办公室，见 `chapter-nanjing.png`。同一次浏览器会话会读到刚才的存档，状态行是「已恢复上次确认的进度」。
- `?chapter=hefei`：标题「合肥，争取一次机会」，章节 `hefei-first-job`，见 `chapter-hefei.png`。
- `?chapter=hangzhou`：标题「杭州，商品发布」，章节 `hangzhou-publish`，见 `chapter-hangzhou.png`。
- `#back-blog` 与 `#failure-blog` 都是 `https://zwhu.github.io/`。
