import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runReport } from '../sim.mjs';

test('three strategies on h0–h239 stay inside the brief', () => {
  const report = runReport();
  const saved = JSON.parse(readFileSync(new URL('../review/strategies.json', import.meta.url), 'utf8'));
  assert.deepEqual(report, saved);
  const byId = Object.fromEntries(report.strategies.map(item => [item.id, item]));
  assert.equal(report.games, 240);
  assert.equal(report.seeds, 'h0–h239');
  assert.ok(byId.greedy.clearRate >= 0.4 && byId.greedy.clearRate <= 0.6);
  assert.ok(byId.greedy.goodRate <= 0.05);
  assert.ok(byId.planned.clearRate >= 0.7 && byId.planned.clearRate <= 0.85);
  assert.ok(byId.planned.clearRate >= byId.greedy.clearRate);
  assert.ok(byId.planned.goodRate >= 0.4 && byId.planned.goodRate <= 0.6);
  assert.ok(byId.random.clearRate <= 0.15);
  assert.ok(byId.random.goodRate <= 0.03);
  const week4Losses = report.strategies.reduce((sum, item) => sum + (item.lossWeeks['4'] || 0), 0);
  assert.ok(week4Losses > 0);
  assert.ok(byId.greedy.lossWeeks['4'] > 0);
  for (const item of report.strategies) {
    assert.equal(item.clears / item.games, item.clearRate);
    assert.equal(item.goodEndings / item.games, item.goodRate);
    assert.ok(item.method.length > 20);
  }
});
