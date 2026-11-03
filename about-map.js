(() => {
  const board = document.querySelector('.about-board');
  if (!board) return;
  const name = board.querySelector('.map-name');
  const readout = board.querySelector('.map-readout');
  const cells = [...board.querySelectorAll('.ability-map .cell')];
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  let pinned = cells.find(cell => cell.getAttribute('aria-pressed') === 'true')?.dataset.name;

  // Both layouts carry the same cells; the terminal prints whichever one is shown or pinned.
  const show = cell => {
    name.textContent = cell.dataset.name;
    readout.textContent = cell.dataset.detail;
  };
  const pin = cell => {
    pinned = cell.dataset.name;
    cells.forEach(other => other.setAttribute('aria-pressed', String(other.dataset.name === pinned)));
    show(cell);
  };
  const restore = () => show(cells.find(cell => cell.dataset.name === pinned));

  cells.forEach(cell => {
    cell.addEventListener('click', () => pin(cell));
    cell.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      pin(cell);
    });
    cell.addEventListener('pointerenter', () => canHover.matches && show(cell));
    cell.addEventListener('pointerleave', () => canHover.matches && restore());
  });
})();
