// 由 rules.test.mjs 引入，CI 的南京检查会跑到这些断言。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BOUNDS, DOOR, PLAYER, WALK, WORLD } from '../layout.mjs';
import { applyAction, createGame, present } from '../rules.mjs';
import { paintOrder, whenLabel } from '../scene.mjs';
import { findPath, isWalkable, parseGrid } from '../walk.mjs';

function sha1(url) {
  return createHash('sha1').update(readFileSync(url)).digest('hex');
}

test('the room is 640 by 360 and the new plates keep their bytes', () => {
  assert.deepEqual(WORLD, { width: 640, height: 360 });
  assert.equal(WALK.rows.length, 360 / WALK.tile);
  assert.equal(WALK.rows[0].length, 640 / WALK.tile);
  assert.equal(sha1(new URL('../art/day-640x360.png', import.meta.url)), '35a821374951e906c1dfaef62b87981d9aec288d');
  assert.equal(sha1(new URL('../art/night-640x360.png', import.meta.url)), '1fba22d0e6a7da5e57223f5fea64aaf418d4d983');
});

test('the door is a 64 by 40 sprite at (288, 320) and sorts by its top edge', () => {
  const door = paintOrder('day', PLAYER.seat[1]).find(item => item.id === 'door');
  assert.deepEqual([door.x, door.y], [288, 320]);
  assert.equal(door.sort, 320);
  assert.equal(DOOR.ySort, 320);
  assert.deepEqual([DOOR.w, DOOR.h], [64, 40]);
  assert.notEqual(DOOR.ySort, DOOR.anchor[1]);
  assert.deepEqual(WALK.modes.day.door.hit, [288, 320, 352, 360]);
  assert.deepEqual(WALK.modes.day.door.effect.stand, [320, 336]);
  assert.equal(WALK.modes.day.door.effect.face, 'up');
  const atDoor = paintOrder('day', 336);
  assert.ok(atDoor.findIndex(item => item.id === 'door') < atDoor.findIndex(item => item.id === 'player'));
  const atDesk = paintOrder('day', 108);
  assert.ok(atDesk.findIndex(item => item.id === 'player') < atDesk.findIndex(item => item.id === 'door'));
  for (const mode of ['day', 'night', 'boss']) {
    assert.equal(paintOrder(mode, 108).some(item => item.id === 'water'), false);
  }
});

test('the top bar names the night and leaves the day unmarked', () => {
  const day = present(createGame('room'));
  assert.equal(whenLabel(day), '第 1 周 · 周一');
  assert.equal(whenLabel(day).includes('· 夜里'), false);
  const overnight = present(applyAction(createGame('room'), { type: 'overnight' }));
  assert.equal(overnight.overnightUsed, true);
  assert.equal(whenLabel(overnight), `第 ${overnight.week} 周 · ${overnight.dayName} · 夜里`);
  assert.equal(whenLabel({ week: 2, dayName: '周三', ap: 0, overnightUsed: false }), '第 2 周 · 周三 · 夜里');
  assert.equal(whenLabel({ week: 2, dayName: '周三', ap: 3, overnightUsed: false }), '第 2 周 · 周三');
});

test('seats, the whiteboard, and the door stand on walkable tiles inside the bounds', () => {
  const grid = parseGrid(WALK.rows);
  assert.deepEqual(WALK.modes.day.computer.effect.stand, [142, 120]);
  assert.deepEqual(PLAYER.seat, [142, 108]);
  assert.deepEqual(WALK.start, [17, 15]);
  assert.deepEqual(WALK.modes.day.board.hit, [553, 8, 590, 44]);
  assert.deepEqual(WALK.modes.day.board.effect.stand, [571, 80]);
  for (const [mode, targets] of Object.entries(WALK.modes)) {
    for (const [id, spec] of Object.entries(targets)) {
      assert.equal(isWalkable(grid, spec.tile[0], spec.tile[1]), true, `${mode} ${id}`);
      const path = findPath(grid, WALK.start, spec.tile);
      assert.ok(path, `${mode} ${id}`);
    }
  }
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const cx = x * WALK.tile + WALK.tile / 2;
      const cy = y * WALK.tile + WALK.tile / 2;
      const inside = cx >= BOUNDS.left && cx <= BOUNDS.right && cy >= BOUNDS.top && cy <= BOUNDS.bottom;
      if (!inside) assert.equal(isWalkable(grid, x, y), false, `${x},${y}`);
    }
  }
  assert.equal(isWalkable(grid, 17, 12), false);
  assert.equal(WALK.modes.night.pm, undefined);
  assert.ok(WALK.modes.night.feixiang);
});
