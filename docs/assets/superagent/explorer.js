// Default-visible inline diagrams initialize automatically near the reading position.
(() => {
  const targets = document.querySelectorAll('[data-architecture-canvas]');
  async function load(target) {
    if (target.dataset.loading) return;
    target.dataset.loading = 'true';
    target.setAttribute('aria-busy', 'true');
    try {
      const { mountArchitecture } = await import('./canvas.js');
      mountArchitecture(target);
      target.dataset.ready = 'true';
    } catch (error) {
      delete target.dataset.loading;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '交互图加载失败，点击重试';
      retry.onclick = () => { retry.remove(); load(target); };
      target.append(retry);
      console.error('Architecture canvas:', error);
    } finally {
      target.removeAttribute('aria-busy');
    }
  }
  if (!('IntersectionObserver' in window)) {
    targets.forEach(load);
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      load(entry.target);
    });
  }, { rootMargin: '400px' });
  targets.forEach(target => observer.observe(target));
})();
