import assert from 'node:assert/strict';
import test from 'node:test';
import { sceneFrame, sceneScale } from '../scale.mjs';

const viewports = [
  [1280, 800],
  [1920, 1080],
  [1024, 640],
  [390, 844],
];

for (const [width, height] of viewports) {
  test(`${width}×${height} uses an integer scale and fits on one screen`, () => {
    const frame = sceneFrame(width, height);
    assert.equal(frame.scale, sceneScale(width, height));
    assert.equal(Number.isInteger(frame.scale), true);
    assert.ok(frame.scale >= 1);
    assert.equal(frame.sceneWidth, 384 * frame.scale);
    assert.equal(frame.sceneHeight, 216 * frame.scale);
    assert.ok(frame.outerWidth <= width, `width ${frame.outerWidth} > ${width}`);
    assert.ok(frame.outerHeight <= height, `height ${frame.outerHeight} > ${height}`);
  });
}
