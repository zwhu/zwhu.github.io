import assert from 'node:assert/strict';
import test from 'node:test';
import { sceneLayout } from '../scene-scale.mjs';

const VIEWPORTS = [
  [1280, 800, 3, 1152, 648],
  [1920, 1080, 4, 1536, 864],
  [1024, 640, 2, 768, 432],
  [390, 844, 1, 384, 216],
];

test('整数倍按视口较短的一边取值，顶栏、画面和种子框放进一屏', () => {
  for (const [width, height, scale, sceneWidth, sceneHeight] of VIEWPORTS) {
    const layout = sceneLayout(width, height);
    assert.equal(layout.scale, scale, `${width}×${height} 倍数`);
    assert.equal(Number.isInteger(layout.scale), true);
    assert.equal(layout.sceneWidth, sceneWidth);
    assert.equal(layout.sceneHeight, sceneHeight);
    assert.equal(layout.sceneWidth, 384 * layout.scale);
    assert.equal(layout.sceneHeight, 216 * layout.scale);
    assert.equal(layout.fits, true, `${width}×${height} 出现滚动`);
    assert.equal(layout.maximal, true, `${width}×${height} 还能再放大一倍`);
    assert.ok(layout.sceneWidth <= width);
    assert.ok(layout.totalHeight <= height);
  }
});
