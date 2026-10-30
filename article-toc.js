(() => {
  const navigation = document.querySelector('.article-toc');
  if (!navigation) return;
  const list = navigation.querySelector('.article-toc-links');
  const entries = [...navigation.querySelectorAll('a[href^="#"]')]
    .map(link => ({ link, target: document.getElementById(link.hash.slice(1)) }))
    .filter(entry => entry.target);
  if (!list || !entries.length) return;

  let current;
  let scheduled = false;

  function update() {
    scheduled = false;
    const readingLine = navigation.getBoundingClientRect().bottom + 24;
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
      if (entry === active) entry.link.setAttribute('aria-current', 'location');
      else entry.link.removeAttribute('aria-current');
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

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('hashchange', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate, { once: true });
  update();
})();
