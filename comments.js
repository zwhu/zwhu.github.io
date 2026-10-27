(() => {
  const container = document.querySelector('.giscus');
  const status = document.querySelector('.comments-status');
  const config = window.BLOG_COMMENTS;
  if (config && config.enabled === false) return;
  if (!container || !config || !['repo', 'repoId', 'category', 'categoryId'].every(key => typeof config[key] === 'string' && config[key].trim())) return;
  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  // giscus 在独立 iframe 内加载主题，需将站内相对路径解析为完整 URL。
  const theme = new URL('./giscus-theme.css', document.currentScript.src).href;
  const options = {
    repo: config.repo, 'repo-id': config.repoId,
    category: config.category, 'category-id': config.categoryId,
    mapping: 'specific', term: 'blog/' + location.pathname.split('/').pop(),
    strict: '1', 'reactions-enabled': '1', 'emit-metadata': '0',
    'input-position': 'top', theme, lang: 'zh-CN', loading: 'lazy'
  };
  for (const [key, value] of Object.entries(options)) script.setAttribute('data-' + key, value);
  script.crossOrigin = 'anonymous';
  script.async = true;
  if (status) status.textContent = '评论由 GitHub Discussions 提供，登录 GitHub 后即可参与。';
  script.onerror = () => { if (status) status.textContent = '评论加载失败，请检查网络后刷新页面。'; };
  container.appendChild(script);
})();
