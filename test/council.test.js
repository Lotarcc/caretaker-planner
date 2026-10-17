import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planCouncil } from '../shared/council.js';
import { solve } from '../shared/solver.js';

// Two humans and one scarce memory: Big (Logic 45) is the only owned memory that gets the second human over 40.
// Planned one at a time, the first human takes Big (it's a touch lighter) and the second must find another;
// planned together, the first makes do with Small and nothing needs finding.
const memories = [
  { id: 'big', name: 'Big', item_weight: 0.5, Logic: 45 },
  { id: 'small', name: 'Small', item_weight: 1, Logic: 10 },
  { id: 'art', name: 'Art', item_weight: 1, Creativity: 10 },
];
const foods = [{ id: 'f', name: 'Body Food', tier: 1, item_weight: 2, Weight: 25, Height: 35, Life_Expectancy: 15, Protein: 1 }];
const profession = (id, tier, Logic, Creativity = 0) => ({ id, profession: id, tier, Logic, Creativity, requirement_types: {} });
// B also needs Creativity, so A holding Big never makes a B (which would stop the one-at-a-time solver taking it).
const professions = [profession('A', 1, 5), profession('B', 2, 40, 5)];
const inventory = { memory: { big: 1, small: 1, art: 2 }, food: {}, nutrient: {} };
const humans = [{ key: 'a', label: 'A', professionId: 'A' }, { key: 'b', label: 'B', professionId: 'B' }];

test('one at a time, the first human takes the scarce memory', () => {
  const a = solve({ profession: professions[0], professions, memories, foods, inventory, mode: 'plan' });
  assert.ok(a.recipe.some((r) => r.id === 'big' && r.own === 1));
});

test('planned together, the scarce memory goes to the human that needs it and nothing is found', () => {
  const plan = planCouncil({ humans, professions, memories, foods, inventory });
  assert.equal(plan.method, 'joint');
  assert.equal(plan.totals.planned, 2);
  const [a, b] = plan.humans;
  assert.ok(a.recipe.some((r) => r.id === 'small' && r.own === 1), JSON.stringify(a.recipe));
  assert.ok(b.recipe.some((r) => r.id === 'big' && r.own === 1), JSON.stringify(b.recipe));
  assert.deepEqual(plan.totals.find, []);
  // Body foods are crafted for both, and what that takes is reported against stock.
  assert.deepEqual(plan.totals.nutrients.map((n) => [n.nutrient, n.gather]), [['Protein', plan.totals.nutrients[0].need]]);
});

test('owned items are never handed out twice', () => {
  const twice = [...humans, { key: 'b2', label: 'B again', professionId: 'B' }];
  const plan = planCouncil({ humans: twice, professions, memories, foods, inventory });
  const ownedBig = plan.humans.flatMap((h) => h.recipe).filter((r) => r.id === 'big').reduce((n, r) => n + r.own, 0);
  assert.equal(ownedBig, 1);
  assert.equal(plan.totals.planned, 3);
  assert.ok(plan.totals.find.length > 0, 'the second B has to find something');
});
