import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HEFEI} from '../scene-config.mjs';
import {blocked, integrateWalk} from '../world.mjs';
import {SHOT_TYPES, sceneRequest, wholeLerp, lerpView, stepFollow, followTarget, walkIntent, createDirector, validateScript} from '../cinematic.mjs';

const script = JSON.parse(readFileSync(new URL('../cinematic/hefei.json', import.meta.url), 'utf8'));

test('cinematic query is the only switch', () => {
  assert.deepEqual(sceneRequest(''), {cinematic: null, chapter: null});
  assert.deepEqual(sceneRequest('?chapter=hefei'), {cinematic: null, chapter: 'hefei'});
  assert.deepEqual(sceneRequest('?chapter=hangzhou'), {cinematic: null, chapter: 'hangzhou'});
  assert.deepEqual(sceneRequest('?cinematic=hefei'), {cinematic: 'hefei', chapter: 'hefei'});
  assert.deepEqual(sceneRequest('?cinematic=nanjing'), {cinematic: 'nanjing', chapter: 'nanjing'});
  assert.deepEqual(sceneRequest('?cinematic=nope&chapter=hefei'), {cinematic: null, chapter: 'hefei'});
});

test('push-in interpolation stays on whole pixels and never reverses', () => {
  const from = {x: 20, y: 40, size: 168};
  const to = {x: 90, y: 100, size: 96};
  let prev = null;
  for (let i = 0; i <= 32; i++) {
    const view = lerpView(from, to, i / 32);
    assert.equal(view.x, wholeLerp(from.x, to.x, i / 32));
    assert.ok(Number.isInteger(view.x) && Number.isInteger(view.y) && Number.isInteger(view.size));
    if (prev) {
      assert.ok(view.x - prev.x === 0 || Math.sign(view.x - prev.x) === Math.sign(to.x - from.x));
      assert.ok(view.y - prev.y === 0 || Math.sign(view.y - prev.y) === Math.sign(to.y - from.y));
      assert.ok(view.size - prev.size === 0 || Math.sign(view.size - prev.size) === Math.sign(to.size - from.size));
    }
    prev = view;
  }
  assert.deepEqual(lerpView(from, to, 1), to);
});

test('follow steps at most one pixel and holds still', () => {
  const room = script.room;
  const target = followTarget({x: 190, y: 196}, 168, room, 20);
  let view = {x: target.x - 5, y: target.y + 3, size: 168};
  const seen = [];
  for (let i = 0; i < 12; i++) {
    const next = stepFollow(view, target);
    assert.ok(Math.abs(next.x - view.x) <= 1 && Math.abs(next.y - view.y) <= 1);
    assert.equal(next.size, view.size);
    seen.push(next);
    view = next;
  }
  const held = stepFollow(target, target);
  assert.deepEqual(held, target);
  assert.deepEqual(stepFollow(held, target), held);
});

test('hefei script uses only the four shots and walks the office', () => {
  validateScript(script);
  assert.ok(script.shots.some(shot => shot.type === 'push-in' && shot.still));
  assert.deepEqual([...new Set(script.shots.map(shot => shot.type))].sort(), [...SHOT_TYPES].sort());
  assert.equal(script.output, 216);
  const director = createDirector(script);
  let position = {x: 190, y: 196};
  const api = {
    state() {
      const wait = director.waiting();
      return wait?.until || 'explore';
    },
    position: () => ({x: position.x, y: position.y}),
    buttons() {
      const wait = director.waiting();
      return wait?.button ? [wait.button] : ['OK'];
    },
    focus: () => true,
    interact() {},
    choose: () => true,
    dismiss: () => true,
    manual() {},
    face(tx, ty) {
      const wish = walkIntent(position, [tx, ty], (x, y) => blocked(x, y, HEFEI));
      if (!wish) return false;
      director.setWish(wish);
      return true;
    },
  };
  let previous = null;
  let mode = 'fixed';
  const tweenRuns = [];
  let tween = [];
  for (let frame = 0; frame < 8000 && director.phase !== 'done'; frame++) {
    if (director.poll(api)) continue;
    const wish = director.takeWish();
    if (wish) {
      const step = integrateWalk(position, wish[0], wish[1], 1 / 60, HEFEI, 0);
      assert.ok(step.x !== position.x || step.y !== position.y, 'walk did not move');
      position = {x: step.x, y: step.y};
    }
    const shot = director.beforeRender(position);
    const view = shot.view;
    assert.ok(Number.isInteger(view.x) && Number.isInteger(view.y) && Number.isInteger(view.size));
    assert.ok(view.size >= 1 && view.x >= 0 && view.y >= 0);
    assert.ok(view.x + view.size <= script.room.width && view.y + view.size <= script.room.height);
    if (director.cameraMode === 'follow' && previous && mode === 'follow') {
      assert.ok(Math.abs(view.x - previous.x) <= 1 && Math.abs(view.y - previous.y) <= 1);
      assert.equal(view.size, previous.size);
    }
    if (director.cameraMode === 'tween') tween.push(view);
    if (mode === 'tween' && director.cameraMode !== 'tween' && tween.length) {
      tweenRuns.push(tween);
      tween = [];
    }
    mode = director.cameraMode;
    previous = view;
    director.afterRender(api, frame);
  }
  if (tween.length) tweenRuns.push(tween);
  assert.equal(director.phase, 'done');
  assert.deepEqual(position, {x: 24, y: 90});
  assert.ok(director.stills.includes('boss') && director.stills.includes('linux') && director.stills.includes('manual'));
  assert.ok(script.route.some(step => step.do === 'pickup') && script.route.some(step => step.focus === 'manual'));
  for (const run of tweenRuns) {
    for (let i = 1; i < run.length; i++) {
      const dx = run[i].x - run[i - 1].x, dy = run[i].y - run[i - 1].y, ds = run[i].size - run[i - 1].size;
      const sx = Math.sign(run.at(-1).x - run[0].x), sy = Math.sign(run.at(-1).y - run[0].y), ss = Math.sign(run.at(-1).size - run[0].size);
      if (sx) assert.ok(dx === 0 || Math.sign(dx) === sx);
      if (sy) assert.ok(dy === 0 || Math.sign(dy) === sy);
      if (ss) assert.ok(ds === 0 || Math.sign(ds) === ss);
    }
  }
});

test('unknown shot types are rejected', () => {
  assert.throws(() => validateScript({...script, shots: [{id: 'zoom', type: 'zoom', frames: 4, to: {x: 0, y: 0, size: 40}}]}), /shot type/);
});
