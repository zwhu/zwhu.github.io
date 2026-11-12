// 画面只按整数倍放大。顶栏按夜里最长那一行估算高度，和种子框一起放进视口。
export const SCENE_WIDTH = 384;
export const SCENE_HEIGHT = 216;
export const SEED_HEIGHT = 44;

const HUD_ITEMS = Object.freeze([
  '第 1 周 · 周一 · 夜里',
  '行动点 3',
  '体力 10',
  '交付 24',
  '本周线 64',
  '投诉 0/2',
  '技术债 0',
]);

export function hudFontSize(scale) {
  return Math.max(13, 11 * scale);
}

function textWidth(text, font) {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (ch === ' ') width += font * 0.33;
    else if (code > 0xff) width += font;
    else width += font * 0.62;
  }
  return width;
}

export function hudHeight(scale) {
  const font = hudFontSize(scale);
  const inner = SCENE_WIDTH * scale - 16;
  let lines = 1;
  let used = 0;
  for (const item of HUD_ITEMS) {
    const width = textWidth(item, font);
    if (used > 0 && used + 8 + width > inner) {
      lines += 1;
      used = width;
    } else {
      used = used === 0 ? width : used + 8 + width;
    }
  }
  return Math.ceil(lines * font * 1.25 + 8 + 2);
}

export function sceneScale(viewportWidth, viewportHeight) {
  const maxScale = Math.max(1, Math.floor(viewportWidth / SCENE_WIDTH));
  for (let scale = maxScale; scale >= 1; scale -= 1) {
    const total = hudHeight(scale) + SCENE_HEIGHT * scale + SEED_HEIGHT;
    if (SCENE_WIDTH * scale <= viewportWidth && total <= viewportHeight) return scale;
  }
  return 1;
}

export function sceneLayout(viewportWidth, viewportHeight) {
  const scale = sceneScale(viewportWidth, viewportHeight);
  const sceneWidth = SCENE_WIDTH * scale;
  const sceneHeight = SCENE_HEIGHT * scale;
  const hud = hudHeight(scale);
  const totalHeight = hud + sceneHeight + SEED_HEIGHT;
  const fits = sceneWidth <= viewportWidth && totalHeight <= viewportHeight;
  const larger = scale + 1;
  const largerFits = SCENE_WIDTH * larger <= viewportWidth
    && hudHeight(larger) + SCENE_HEIGHT * larger + SEED_HEIGHT <= viewportHeight;
  return {
    scale,
    sceneWidth,
    sceneHeight,
    hudHeight: hud,
    seedHeight: SEED_HEIGHT,
    totalHeight,
    fits,
    maximal: !largerFits,
  };
}
