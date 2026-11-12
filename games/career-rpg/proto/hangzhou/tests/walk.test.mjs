import assert from 'node:assert/strict';
import test from 'node:test';
import { NAV, WORLD, stagePixels } from '../nav.mjs';
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
  const neighbor = NAV.spots.find(spot => spot.id === 'neighbor');
  const goal = nearestWalkable(NAV, neighbor.at[0], neighbor.at[1]);
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

test('the room is 640 by 360 and the seat, door and board keep their coordinates', () => {
  assert.deepEqual([WORLD.w, WORLD.h], [640, 360]);
  assert.deepEqual([NAV.width, NAV.height], [640, 360]);
  assert.equal(NAV.cols * NAV.cell, 640);
  assert.equal(NAV.rows * NAV.cell, 360);
  assert.deepEqual(NAV.bounds, { left: 4, right: 636, top: 64, bottom: 342 });
  assert.deepEqual(NAV.seat.seat, [226, 241]);
  assert.deepEqual(NAV.seat.stand, [226, 247]);
  assert.deepEqual(NAV.seat.sitSize, [NAV.seat.sitFrame[2], NAV.seat.sitFrame[3]]);
  const door = NAV.spots.find(spot => spot.id === 'door');
  assert.deepEqual(door.day, [318, 329, 38, 31]);
  assert.deepEqual(door.at, [336, 338]);
  assert.equal(door.facing, 'up');
  assert.deepEqual(NAV.door.box, [318, 329, 38, 31]);
  assert.deepEqual(NAV.door.spawn, [336, 338]);
  const board = NAV.spots.find(spot => spot.id === 'board');
  assert.deepEqual(board.day, [558, 173, 54, 42]);
  assert.deepEqual(NAV.board.lit, [559, 172]);
  assert.deepEqual(NAV.board.litSize, [53, 42]);
  assert.equal(sceneFile({ night: false, boss: true }), 'day-640x360.png');
  assert.equal(stagePixels(1280), 1280);
  assert.equal(stagePixels(1000), 640);
  assert.equal(stagePixels(390), 390);
  const seatCell = nearestWalkable(NAV, NAV.seat.stand[0], NAV.seat.stand[1]);
  const doorCell = nearestWalkable(NAV, NAV.door.spawn[0], NAV.door.spawn[1]);
  assert.ok(findPath(NAV, seatCell, doorCell)?.length > 1);
});

test('night loads the night plate and ground clicks do not change state', () => {
  assert.equal(sceneFile({ night: true, boss: true }), 'night-640x360.png');
  assert.equal(sceneFile({ night: false, boss: false }), 'day-640x360.png');
  assert.equal(sceneFile({ night: false, boss: true }), 'day-640x360.png');
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
    type: 'show', id: 'desk', tab: 'skills',
  });
  assert.deepEqual(effectFor(NAV.spots.find(spot => spot.kind === 'computer'), { night: true }), {
    type: 'show', id: 'desk', tab: 'skills', sit: true,
  });
  assert.deepEqual(effectFor(NAV.spots.find(spot => spot.kind === 'computer'), { night: true, dotaPending: true }), {
    type: 'dota', sit: true,
  });
  assert.deepEqual(effectFor(NAV.spots.find(spot => spot.kind === 'cooler'), { night: true }), { type: 'rest' });
  assert.deepEqual(effectFor(NAV.spots.find(spot => spot.kind === 'door'), { night: false }), { type: 'door' });
  assert.deepEqual(visibleSpots(NAV.spots, { night: true }).map(spot => spot.id), ['computer', 'shelf', 'cooler', 'door']);
  assert.equal(state.ap, ap);
  assert.equal(state.stamina, stamina);
  assert.deepEqual(snapshot(state), before);
});
