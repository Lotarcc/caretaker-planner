import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS, compare, effective, evaluate, inverseEffective, requirements, totals, withDefaults,
} from '../shared/rules.js';

test('effective value: linear up to the soft cap, diminishing after', () => {
  assert.equal(effective(0), 0);
  assert.equal(effective(150), 150);
  assert.equal(effective(200), 200);
  assert.ok(Math.abs(effective(300) - (200 + 100 ** 0.6)) < 1e-9);
  assert.equal(effective(-5), 0);
});

test('inverse effective round-trips', () => {
  for (const v of [0, 50, 200, 210, 220, 260]) {
    assert.ok(Math.abs(effective(inverseEffective(v)) - v) < 1e-9, `value ${v}`);
  }
  assert.ok(Math.abs(inverseEffective(220) - (200 + 20 ** (1 / 0.6))) < 1e-9);
});

test('compare types', () => {
  assert.equal(compare(10, 10, 'Greater'), false);
  assert.equal(compare(10.01, 10, 'Greater'), true);
  assert.equal(compare(10, 10, 'GreaterOrEqual'), true);
  assert.equal(compare(10, 10, 'Less'), true);
  assert.equal(compare(10.1, 10, 'Less'), false);
  assert.equal(compare(10.5, 10, 'Equal'), true);
  assert.equal(compare(10.6, 10, 'Equal'), false);
  assert.equal(compare(11, 10), true, 'Greater is the default');
});

test('requirements add baselines (or take the max) and always include them', () => {
  const prof = { Strength: 60, Height: 100, requirement_types: { Strength: 'Greater', Height: 'GreaterOrEqual' } };
  const add = Object.fromEntries(requirements(prof).map((r) => [r.attr, r]));
  assert.equal(add.Strength.required, 60);
  assert.equal(add.Height.required, 130);
  assert.equal(add.Height.type, 'GreaterOrEqual');
  assert.equal(add.Weight.required, 20);
  assert.equal(add.Weight.listed, false);
  assert.equal(add.Life_Expectancy.required, 10);

  const max = Object.fromEntries(requirements(prof, { ...DEFAULT_SETTINGS, baselineMode: 'max' }).map((r) => [r.attr, r]));
  assert.equal(max.Height.required, 100);
  assert.equal(max.Weight.required, 20);
});

test('totals and evaluation include weight cap', () => {
  const food = { Strength: 15, Height: 2, Weight: 8, Intellect: 2, Life_Expectancy: 2, item_weight: 2, VitaminD: 12 };
  const t = totals([{ item: food, qty: 5 }]);
  assert.equal(t.raw.Strength, 75);
  assert.equal(t.weight, 10);
  assert.equal(t.nutrients.VitaminD, 60);
  const prof = { Strength: 60, requirement_types: {} };
  assert.equal(evaluate(prof, t.raw, DEFAULT_SETTINGS, t.weight).met, false, 'height baseline 30 not met');
  assert.equal(evaluate(prof, { ...t.raw, Height: 40, Weight: 25, Life_Expectancy: 11 }, DEFAULT_SETTINGS, 120).met, false, 'over the weight cap');
});

test('withDefaults merges nested settings', () => {
  const s = withDefaults({ baselines: { Weight: 5 } });
  assert.equal(s.baselines.Weight, 5);
  assert.equal(s.baselines.Height, 30);
  assert.equal(s.drThreshold, 200);
});
