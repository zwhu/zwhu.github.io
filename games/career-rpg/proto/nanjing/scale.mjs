// 场景逻辑尺寸。画面只按整数倍放大，和 style.css 里的 --scale 一致。
export const SCENE_W = 384;
export const SCENE_H = 216;

const NARROW_AT = 480;

function fontPx(scale) {
  return Math.max(13, 10 * scale);
}

function rowPx(scale) {
  const border = 4 * scale;
  return Math.ceil(fontPx(scale) * 1.35 + 6 + border);
}

function chrome(viewportWidth, scale) {
  const narrow = viewportWidth <= NARROW_AT;
  const border = narrow ? 4 : 8;
  const padX = narrow ? 0 : 16;
  const padY = narrow ? 4 : 16;
  const meterLines = scale <= 1 ? 2 : 1;
  const topbar = 4 + rowPx(scale) * (meterLines + 1) + 2;
  const seed = 48;
  return {
    extraW: border + padX,
    extraH: border + padY + topbar + seed,
  };
}

export function sceneScale(viewportWidth, viewportHeight) {
  const maxByWidth = Math.max(1, Math.floor((viewportWidth - chrome(viewportWidth, 1).extraW) / SCENE_W));
  for (let scale = maxByWidth; scale > 1; scale -= 1) {
    const box = chrome(viewportWidth, scale);
    const fitsW = SCENE_W * scale + box.extraW <= viewportWidth;
    const fitsH = SCENE_H * scale + box.extraH <= viewportHeight;
    if (fitsW && fitsH) return scale;
  }
  return 1;
}

export function sceneFrame(viewportWidth, viewportHeight) {
  const scale = sceneScale(viewportWidth, viewportHeight);
  const box = chrome(viewportWidth, scale);
  return {
    scale,
    sceneWidth: SCENE_W * scale,
    sceneHeight: SCENE_H * scale,
    outerWidth: SCENE_W * scale + box.extraW,
    outerHeight: SCENE_H * scale + box.extraH,
  };
}
