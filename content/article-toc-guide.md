# 长文章快速导航：复用说明

采用原生 HTML、CSS、JavaScript，无第三方依赖。当前示例为 [ub-mode 评测文章](../ub-mode-bench.html)。

## 文件与职责

- [archive.css](../archive.css)：贴顶布局、导航内部横向滚动、当前项颜色、键盘焦点和打印隐藏；`.article-with-toc` 为锚点预留顶部空间。
- [article-toc.js](../article-toc.js)：根据阅读位置更新 `aria-current="location"`，必要时横向滚动导航，让当前项可见。手动阅读时不改写 URL，也不产生浏览历史。
- 页面 HTML：普通锚点链接和稳定的章节 ID。关闭 JavaScript 时仍可以跳转。

## 如何接入

在 `style.css` 之后加载 `archive.css`。给文章容器增加 `article-with-toc`，在引言后、首个章节前放置导航，每页一条。

```html
<article class="article article-with-toc">
  <h1>文章标题</h1>
  <div class="prose">
    <p>引言。</p>

    <nav class="article-toc" aria-label="文章快速导航">
      <span class="article-toc-label">本文导航</span>
      <div class="article-toc-links">
        <a href="#overview" aria-current="location">概览</a>
        <a href="#design">实验设计</a>
        <a href="#results">测试结果</a>
        <a href="#conclusion">我的选择</a>
        <a href="#sources">资料</a>
      </div>
    </nav>

    <h2 id="overview" tabindex="-1">1. 概览</h2>
    <!-- 正文 -->
    <h2 id="design" tabindex="-1">2. 实验设计</h2>
    <!-- 正文 -->
    <h2 id="results" tabindex="-1">3. 测试结果</h2>
    <!-- 正文 -->
    <h2 id="conclusion" tabindex="-1">4. 我的选择</h2>
    <!-- 正文 -->
    <h3 id="sources" tabindex="-1">资料</h3>
  </div>
</article>
<script src="./article-toc.js" defer></script>
```

按实际章节修改链接与 ID，无需修改脚本。导航短标题可以比正文标题简洁，顺序须与正文一致，目标 ID 必须存在且唯一。`tabindex="-1"` 让锚点目标能够接收焦点，不额外占用 Tab 顺序。

## 使用约定

- 复用暖白底、细分隔线、11–12px 辅助文字；当前章节用朱砂红文字与细下划线。保持正文宽度。
- 到达视口顶部后贴顶，生命周期由所在正文容器决定。
- 建议 4–6 个主要入口。窄屏保持单行，内容较多时仅导航内部横向滚动。
- 标题进入导航下方的阅读区域时更新高亮；到页底时标记最后一项。点击使用浏览器原生锚点与前进后退，不额外管理路由。
- `.article-with-toc [id]` 的 `scroll-margin-top` 避免标题和参考条目被导航遮挡。若页面另有固定顶栏，需相应增加预留高度。
- 保留键盘焦点轮廓。平滑滚动沿用 `style.css`；系统选择减少动态效果时即时跳转。打印隐藏导航。
- 不要随意给导航祖先增加 `overflow: hidden/auto`，以免改变 sticky 的滚动容器。
- 每页一条导航；无导航时脚本直接退出。其他页面按需接入，不自动修改现有文章。

## 验证范围

接入后检查桌面和窄屏、全部锚点、标题避让、滚动高亮、键盘 Enter、直接打开章节链接、前进后退，以及关闭 JavaScript、减少动态效果和打印时的行为。确认整页没有横向溢出，溢出仅限导航内部。
