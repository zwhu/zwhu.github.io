import assert from 'node:assert/strict';
import test from 'node:test';
import { NAV } from '../nav.mjs';
import { applyAction, createGame, snapshot } from '../rules.mjs';
import { effectFor, findPath, isWalkable, nearestWalkable, sceneFile, visibleSpots } from '../walk.mjs';

const start = nearestWalkable(NAV, NAV.seat.stand[0], NAV.seat.stand[1]);

test('each clickable spot has a path that stays on walkable cells', () => {
  assert.ok(start);
  for (const spot of NAV.spots) {
    for (const at of [spot.at, spot.boss ? nearestCenter(spot.boss) : null].filter(Boolean)) {
      const goal = nearestWalkable(NAV, at[0], at[1]);
      const path = findPath(NAV, start, goal);
      assert.ok(path && path.length > 0, spot.id);
      for (const cell of path) assert.equal(isWalkable(NAV, cell), true, `${spot.id} ${cell}`);
    }
  }
});

test('clicking empty ground does not change the game', () => {
  const state = createGame('ground');
  const before = snapshot(state);
  assert.equal(effectFor(null), null);
  assert.equal(effectFor({ kind: 'ground', at: [40, 200] }), null);
  assert.deepEqual(snapshot(state), before);
});

test('walking does not spend action points or stamina', () => {
  const state = createGame('pace');
  const goal = nearestWalkable(NAV, 142, 198);
  const path = findPath(NAV, start, goal);
  assert.ok(path.length > 1);
  for (const cell of path) assert.equal(isWalkable(NAV, cell), true);
  assert.equal(state.ap, createGame('pace').ap);
  assert.equal(state.stamina, createGame('pace').stamina);
  assert.deepEqual(snapshot(state), snapshot(createGame('pace')));
});

function nearestCenter(hit) {
  return [hit[0] + hit[2] / 2, hit[1] + hit[3] / 2];
}

test('night loads the night plate and ground clicks do not change state', () => {
  assert.equal(sceneFile({ night: true, boss: true }), 'night-384x216.png');
  assert.equal(sceneFile({ night: false, boss: false }), 'day-384x216.png');
  assert.equal(sceneFile({ night: false, boss: true }), 'boss-384x216.png');
  let state = applyAction(createGame('night-plate'), { type: 'overnight' });
  assert.equal(state.night, true);
  const ticketId = state.tickets[0].id;
  assert.equal(applyAction(state, { type: 'work', ticketId }), state);
  const before = snapshot(state);
  const ap = state.ap;
  const stamina = state.stamina;
  assert.equal(effectFor({ kind: 'ground', at: [48, 200] }, { night: true }), null);
  assert.equal(effectFor(NAV.spots.find(spot => spot.kind === 'colleague'), { night: true }), null);
  assert.equal(effectFor(NAV.spots.find(spot => spot.kind === 'board'), { night: true }), null);
  assert.deepEqual(effectFor(NAV.spots.find(spot => spot.kind === 'shelf'), { night: true }), {
    type: 'show', id: 'skills',
  });
  assert.deepEqual(effectFor(NAV.spots.find(spot => spot.kind === 'computer'), { night: true }), {
    type: 'show', id: 'skills', sit: true,
  });
  assert.deepEqual(visibleSpots(NAV.spots, { night: true }).map(spot => spot.id), ['computer', 'shelf']);
  assert.equal(state.ap, ap);
  assert.equal(state.stamina, stamina);
  assert.deepEqual(snapshot(state), before);
});
