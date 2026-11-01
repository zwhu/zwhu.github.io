// Load the explorable canvas only after the reader requests it.
document.querySelectorAll('.architecture-explorer').forEach(details => {
  details.addEventListener('toggle', () => {
    const target = details.querySelector('[data-canvas-src]');
    if (!details.open || !target || target.firstElementChild) return;
    const frame = document.createElement('iframe');
    frame.src = target.dataset.canvasSrc;
    frame.title = 'Super-agent 交互架构图';
    frame.loading = 'lazy';
    target.append(frame);
  });
});
