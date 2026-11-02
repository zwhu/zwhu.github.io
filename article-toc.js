(() => {
  const navigation = document.querySelector('.article-toc');
  if (!navigation) return;
  const list = navigation.querySelector('.article-toc-links');
  const article = navigation.closest('article');
  const entries = [...navigation.querySelectorAll('a[href^="#"]')]
    .map(link => ({ link, target: document.getElementById(link.hash.slice(1)) }))
    .filter(entry => entry.target);
  if (!list || !article || !entries.length) return;

  // Side ticks fit a narrow mouse-driven window; touch retains the text links.
  const desktop = window.matchMedia('(min-width: 700px) and (hover: hover) and (pointer: fine)');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
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
  previewTitle.id = 'article-rail-preview-title';
  const previewText = document.createElement('p');
  const previewActions = document.createElement('div');
  previewActions.className = 'article-preview-actions';
  previewActions.hidden = true;
  const previewJump = document.createElement('a');
  previewJump.textContent = '跳转到此节 →';
  const previewClose = document.createElement('button');
  previewClose.type = 'button';
  previewClose.textContent = '关闭';
  previewClose.setAttribute('aria-label', '关闭章节预览');
  previewActions.append(previewJump, previewClose);
  preview.append(previewIndex, previewTitle, previewText, previewActions);

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
  rail.append(label, railLinks);
  const main = article.closest('main');
  if (main) main.before(rail, preview);
  else document.body.append(rail, preview);
  navigation.classList.add('article-toc-enhanced');
  article.classList.add('article-with-rail');

  let previewTrigger;
  let pinned = false;
  let restoringFocus = false;
  let closeTimer;

  function closePreview(restoreFocus = false) {
    window.clearTimeout(closeTimer);
    const trigger = previewTrigger;
    preview.hidden = true;
    trigger?.removeAttribute('aria-describedby');
    trigger?.removeAttribute('aria-expanded');
    trigger?.removeAttribute('aria-controls');
    previewTrigger = undefined;
    pinned = false;
    if (restoreFocus && trigger) {
      restoringFocus = true;
      trigger.focus({ preventScroll: true });
      restoringFocus = false;
    }
  }

  function positionPreview() {
    if (!previewTrigger) return;
    const trigger = previewTrigger.getBoundingClientRect();
    const bounds = preview.getBoundingClientRect();
    const isRail = rail.contains(previewTrigger);
    const left = isRail ? rail.getBoundingClientRect().right + 8 : trigger.left;
    let top = isRail ? trigger.top + trigger.height / 2 - bounds.height / 2 : navigation.getBoundingClientRect().bottom + 8;
    if (!isRail && top + bounds.height > window.innerHeight - 12) {
      top = navigation.getBoundingClientRect().top - bounds.height - 8;
    }
    preview.style.left = `${Math.max(16, Math.min(window.innerWidth - bounds.width - 16, left))}px`;
    preview.style.top = `${Math.max(12, Math.min(window.innerHeight - bounds.height - 12, top))}px`;
  }

  function showPreview(entry, trigger, pin = false) {
    closePreview();
    previewTrigger = trigger;
    pinned = pin;
    trigger.setAttribute('aria-describedby', preview.id);
    preview.setAttribute('role', pin ? 'dialog' : 'tooltip');
    if (pin) {
      preview.setAttribute('aria-labelledby', previewTitle.id);
      trigger.setAttribute('aria-expanded', 'true');
      trigger.setAttribute('aria-controls', preview.id);
    } else preview.removeAttribute('aria-labelledby');
    previewIndex.textContent = `${String(entries.indexOf(entry) + 1).padStart(2, '0')} / ${String(entries.length).padStart(2, '0')}`;
    previewTitle.textContent = entry.title;
    previewText.textContent = entry.excerpt;
    previewText.hidden = !entry.excerpt;
    previewActions.hidden = !pin;
    previewJump.href = entry.link.getAttribute('href');
    preview.hidden = false;
    positionPreview();
    if (pin) previewJump.focus({ preventScroll: true });
  }

  entries.forEach(entry => {
    for (const trigger of [entry.link, entry.railLink]) {
      trigger.addEventListener('pointerenter', event => {
        if (!pinned && canHover.matches && event.pointerType !== 'touch') showPreview(entry, trigger);
      });
      trigger.addEventListener('focus', () => {
        if (!pinned && !restoringFocus) showPreview(entry, trigger);
      });
      trigger.addEventListener('click', event => {
        const touchClick = event.pointerType === 'touch' || (!canHover.matches && event.detail > 0);
        if (touchClick && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          event.preventDefault();
          showPreview(entry, trigger, true);
        } else closePreview();
      });
    }
  });
  for (const surface of [rail, navigation, preview]) {
    surface.addEventListener('pointerenter', () => window.clearTimeout(closeTimer));
    surface.addEventListener('pointerleave', () => {
      // Let the pointer cross the small gap from the trigger to the preview.
      closeTimer = window.setTimeout(() => {
        if (!pinned && document.activeElement !== previewTrigger) closePreview();
      }, 120);
    });
    surface.addEventListener('focusout', event => {
      if (![rail, navigation, preview].some(node => node.contains(event.relatedTarget))) closePreview();
    });
  }
  previewClose.addEventListener('click', () => closePreview(true));
  previewJump.addEventListener('click', () => closePreview());
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
    if (event.key === 'Escape') closePreview(pinned);
  });
  document.addEventListener('pointerdown', event => {
    if (![rail, navigation, preview].some(node => node.contains(event.target))) closePreview();
  });
  list.addEventListener('scroll', positionPreview, { passive: true });
  railLinks.addEventListener('scroll', positionPreview, { passive: true });

  let current;
  let scheduled = false;

  function update() {
    scheduled = false;
    if (desktop.matches) {
      const articleLeft = article.getBoundingClientRect().left;
      const compact = articleLeft < 76;
      rail.classList.toggle('article-rail-compact', compact);
      rail.style.left = `${Math.max(0, articleLeft - (compact ? 32 : 76))}px`;
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
