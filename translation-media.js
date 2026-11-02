(() => {
  const links = document.querySelectorAll('.media-zoom[data-video]');
  if (!links.length || typeof HTMLDialogElement !== 'function') return;

  // One shared dialog; without script the link still opens the archived file.
  const dialog = document.createElement('dialog');
  dialog.className = 'media-dialog';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'media-close';
  close.textContent = '关闭';
  const video = document.createElement('video');
  video.controls = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  const caption = document.createElement('p');
  caption.className = 'media-caption';
  dialog.append(close, video, caption);
  document.body.append(dialog);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let opener = null;

  links.forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    opener = link;
    const image = link.querySelector('img');
    video.src = link.href;
    video.poster = image ? image.currentSrc || image.src : '';
    video.setAttribute('aria-label', link.getAttribute('aria-label') || '');
    const figcaption = link.closest('figure')?.querySelector('figcaption');
    caption.textContent = figcaption ? figcaption.textContent : '';
    caption.lang = link.closest('[lang]')?.lang || 'zh-CN';
    dialog.showModal();
    close.focus();
    if (!reduceMotion.matches) video.play().catch(() => {});
  }));

  close.addEventListener('click', () => dialog.close());
  // Clicks on the backdrop land on the dialog element itself.
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    opener?.focus();
  });
})();
