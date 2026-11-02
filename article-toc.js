(() => {
  const navigation = document.querySelector('.article-toc');
  if (!navigation) return;
  const list = navigation.querySelector('.article-toc-links');
  const article = navigation.closest('article');
  const entries = [...navigation.querySelectorAll('a[href^="#"]')]
    .map(link => ({ link, target: document.getElementById(link.hash.slice(1)) }))
    .filter(entry => entry.target);
  if (!list || !article || !entries.length) return;

  // Keep the authored anchors as the narrow-screen and no-script navigation.
  const desktop = window.matchMedia('(min-width: 1200px) and (hover: hover) and (pointer: fine)');
  const rail = document.createElement('nav');
  rail.className = 'article-rail';
  rail.setAttribute('aria-label', '文章章节导航');
  const label = document.createElement('span');
  label.className = 'article-rail-label';
  label.textContent = '目录';
  label.setAttribute('aria-hidden', 'true');
  const railLinks = document.createElement('div');
  railLinks.className = 'article-rail-links';
  const preview = document.createElement('div');
  preview.className = 'article-rail-preview';
  preview.id = 'article-rail-preview';
  preview.setAttribute('role', 'tooltip');
  preview.hidden = true;
  const previewIndex = document.createElement('span');
  previewIndex.className = 'article-rail-preview-index';
  previewIndex.setAttribute('aria-hidden', 'true');
  const previewTitle = document.createElement('div');
  previewTitle.className = 'article-rail-preview-title';
  const previewText = document.createElement('p');
  preview.append(previewIndex, previewTitle, previewText);

  const paragraphs = [...article.querySelectorAll('p, li')]
    .filter(node => !node.closest('nav, aside, figure, [hidden], .margin-note'));
  entries.forEach((entry, index) => {
    const heading = entry.target.cloneNode(true);
    heading.querySelectorAll('.section-index').forEach(node => node.remove());
    entry.title = heading.textContent.trim();
    const next = entries[index + 1]?.target;
    const paragraph = paragraphs.find(node =>
      (entry.target.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      (!next || (node.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING))
    );
    entry.excerpt = paragraph?.textContent.replace(/\s+/g, ' ').trim() || '';
    if (entry.excerpt.length > 180) entry.excerpt = `${entry.excerpt.slice(0, 180)}…`;
    entry.railLink = document.createElement('a');
    entry.railLink.className = 'article-rail-link';
    entry.railLink.href = entry.link.getAttribute('href');
    const text = document.createElement('span');
    text.className = 'article-rail-text';
    text.textContent = entry.title;
    entry.railLink.append(text);
    railLinks.append(entry.railLink);
  });
  rail.append(label, railLinks, preview);
  const main = article.closest('main');
  if (main) main.before(rail);
  else document.body.append(rail);
  navigation.classList.add('article-toc-enhanced');
  article.classList.add('article-with-rail');

  let previewEntry;
  let closeTimer;

  function closePreview() {
    window.clearTimeout(closeTimer);
    preview.hidden = true;
    previewEntry?.railLink.removeAttribute('aria-describedby');
    previewEntry = undefined;
  }

  function showPreview(entry) {
    if (!desktop.matches) return;
    closePreview();
    previewEntry = entry;
    entry.railLink.setAttribute('aria-describedby', preview.id);
    previewIndex.textContent = `${String(entries.indexOf(entry) + 1).padStart(2, '0')} / ${String(entries.length).padStart(2, '0')}`;
    previewTitle.textContent = entry.title;
    previewText.textContent = entry.excerpt;
    previewText.hidden = !entry.excerpt;
    preview.hidden = false;
    const trigger = entry.railLink.getBoundingClientRect();
    const height = preview.getBoundingClientRect().height;
    preview.style.left = `${rail.getBoundingClientRect().right + 8}px`;
    preview.style.top = `${Math.max(12, Math.min(window.innerHeight - height - 12, trigger.top + trigger.height / 2 - height / 2))}px`;
  }

  entries.forEach(entry => {
    entry.railLink.addEventListener('pointerenter', () => showPreview(entry));
    entry.railLink.addEventListener('focus', () => showPreview(entry));
    entry.railLink.addEventListener('click', closePreview);
  });
  rail.addEventListener('pointerenter', () => window.clearTimeout(closeTimer));
  rail.addEventListener('pointerleave', () => {
    // Allow the pointer to cross the small gap into the hoverable preview.
    closeTimer = window.setTimeout(() => {
      const focused = entries.find(entry => entry.railLink === document.activeElement);
      if (focused) showPreview(focused);
      else closePreview();
    }, 120);
  });
  rail.addEventListener('focusout', event => {
    if (!rail.contains(event.relatedTarget)) closePreview();
  });
  rail.addEventListener('keydown', event => {
    const index = entries.findIndex(entry => entry.railLink === event.target);
    if (index < 0) return;
    let nextIndex;
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % entries.length;
    else if (event.key === 'ArrowUp') nextIndex = (index + entries.length - 1) % entries.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = entries.length - 1;
    else return;
    event.preventDefault();
    entries[nextIndex].railLink.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closePreview();
  });

  let current;
  let scheduled = false;

  function update() {
    scheduled = false;
    if (desktop.matches) {
      rail.style.left = `${Math.max(16, article.getBoundingClientRect().left - 76)}px`;
      rail.style.top = `${Math.max(24, (window.innerHeight - rail.offsetHeight) / 2)}px`;
    }
    const readingLine = desktop.matches ? 48 : navigation.getBoundingClientRect().bottom + 24;
    let active = entries[0];
    for (const entry of entries) {
      if (entry.target.getBoundingClientRect().top <= readingLine) active = entry;
    }
    if (Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2) {
      active = entries[entries.length - 1];
    }
    if (active === current) return;
    current = active;
    for (const entry of entries) {
      for (const link of [entry.link, entry.railLink]) {
        if (entry === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }

    if (desktop.matches) {
      // Reveal the active tick only inside the rail, preserving page position.
      const start = active.railLink.offsetTop;
      const end = start + active.railLink.offsetHeight;
      if (start < railLinks.scrollTop) railLinks.scrollTop = start;
      else if (end > railLinks.scrollTop + railLinks.clientHeight) railLinks.scrollTop = end - railLinks.clientHeight;
      return;
    }

    // Reveal the active link horizontally without moving the article vertically.
    const start = active.link.offsetLeft;
    const end = start + active.link.offsetWidth;
    if (start < list.scrollLeft) list.scrollLeft = Math.max(0, start - 8);
    else if (end > list.scrollLeft + list.clientWidth) list.scrollLeft = end - list.clientWidth + 8;
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(update);
  }

  window.addEventListener('scroll', () => {
    closePreview();
    scheduleUpdate();
  }, { passive: true });
  window.addEventListener('resize', () => {
    closePreview();
    current = undefined;
    scheduleUpdate();
  });
  desktop.addEventListener('change', () => {
    closePreview();
    current = undefined;
    scheduleUpdate();
  });
  window.addEventListener('hashchange', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate, { once: true });
  update();
})();
