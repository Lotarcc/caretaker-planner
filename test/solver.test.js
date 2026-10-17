import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluate, withDefaults } from '../shared/rules.js';
import { overview, solve } from '../shared/solver.js';

const read = (f) => JSON.parse(fs.readFileSync(`data/source/${f}.json`, 'utf8'));
const memories = read('Memory');
const foods = read('Food');
const professions = read('HumanType');
const byName = (rows, key, name) => rows.find((r) => r[key] === name);
const settings = withDefaults();

function inventoryOf(spec) {
  const inv = { memory: {}, food: {}, nutrient: {} };
  for (const [name, qty] of Object.entries(spec.memory ?? {})) inv.memory[byName(memories, 'name', name).id] = qty;
  for (const [name, qty] of Object.entries(spec.food ?? {})) inv.food[byName(foods, 'name', name).id] = qty;
  Object.assign(inv.nutrient, spec.nutrient ?? {});
  return inv;
}

const doctor = byName(professions, 'profession', 'Doctor');
const rich = inventoryOf({
  memory: { 'Small Human Art': 6, 'Biology Notes': 6, Stopwatch: 6, Mirror: 4 },
  food: { 'High-Fat': 20, 'Nutri-Core': 10 },
});

test('inventory recipe satisfies requirements, weight cap and stock', () => {
  const res = solve({ profession: doctor, professions, memories, foods, inventory: rich, settings });
  assert.equal(res.feasible, true);
  assert.ok(res.totals.weight <= settings.podCapacity);
  for (const r of res.recipe) {
    assert.ok(r.qty <= rich[r.kind][r.id], `${r.name} within stock`);
    assert.equal(r.craft, 0);
  }
  const check = evaluate(doctor, res.totals.raw, settings, res.totals.weight);
  assert.equal(check.met, true);
  assert.ok(!res.otherMatches.some((m) => m.tier >= doctor.tier), 'no equal/higher tier matches when exclusive');
});

test('missing inventory: infeasible with a shortfall per attribute', () => {
  const res = solve({ profession: doctor, professions, memories, foods, inventory: inventoryOf({ memory: { Mirror: 1 } }), settings });
  assert.equal(res.feasible, false);
  const weight = res.shortfall.find((s) => s.attr === 'Weight');
  assert.equal(weight.ok, false);
});

test('plan mode crafts foods and lists memories to find', () => {
  const guard = byName(professions, 'profession', 'Guard');
  const inv = inventoryOf({ memory: { "Commander's Log": 1 }, nutrient: { VitaminD: 200, Calcium: 50, Omega3: 50 } });
  const res = solve({ profession: guard, professions, memories, foods, inventory: inv, settings, mode: 'plan' });
  assert.equal(res.feasible, true);
  assert.ok(res.craft.count > 0, 'crafts foods for Strength');
  assert.ok(res.find.length > 0, 'needs more Focus/Discipline/Leadership memories');
  assert.ok(res.totals.weight <= settings.podCapacity);
});

test('plan mode minimises gathering: no Bio Flesh food for a Tier 1 human, even from stock', () => {
  // Stocked Bio Flesh nutrients and an owned Ultimate Genesis still have to be regathered for a later human, so
  // seaweed foods win wherever they can do the job.
  const engineer = byName(professions, 'profession', 'Maintenance Engineer');
  const inv = inventoryOf({
    memory: { Blueprints: 2, "Commander's Log": 2, Crayon: 2, Guitar: 2 },
    food: { 'Ultimate Genesis': 5 },
    nutrient: { Bioregulator: 100, Nanite_Nutrient: 100, Mitochondrial_Amplifier: 100 },
  });
  const res = solve({ profession: engineer, professions, memories, foods, inventory: inv, settings, mode: 'plan' });
  assert.equal(res.feasible, true);
  const bioFlesh = new Set(foods.filter((f) => f.Bioregulator || f.Nanite_Nutrient || f.Mitochondrial_Amplifier).map((f) => f.name));
  const used = res.recipe.filter((r) => bioFlesh.has(r.name)).map((r) => r.name);
  assert.deepEqual(used, []);
});

test('overview marks growable / close / far', () => {
  const ov = overview({ professions, memories, foods, inventory: rich, settings });
  const status = Object.fromEntries(ov.map((o) => [byName(professions, 'id', o.id).profession, o.status]));
  assert.equal(status.Doctor, 'growable');
  assert.equal(status['Quantum Physicist'] === 'growable', false);
  for (const o of ov) assert.ok(['growable', 'close', 'far'].includes(o.status));
});

test('identical items are interchangeable and split across what you own', () => {
  // All "PECO"/mod cartridges share the same stats; own a few different ones.
  const visual = byName(professions, 'profession', 'Visual Technician');
  const inv = inventoryOf({
    memory: { Lonelies: 1, Starshine: 1, Cards: 1, 'Small Human Art': 2 },
    food: { 'Nutri-Core': 10, 'Mind Surge': 10, 'Endura-Growth': 5 },
  });
  const res = solve({ profession: visual, professions, memories, foods, inventory: inv, settings });
  assert.equal(res.feasible, true);
  for (const r of res.recipe) assert.ok(r.own <= inv[r.kind][r.id], `${r.name}: uses at most what is owned`);
});

test('exclusive mode avoids same/higher-tier matches when it can', () => {
  const sculptor = byName(professions, 'profession', 'Sculptor');
  const inv = inventoryOf({
    memory: { 'Oath Token': 2, 'Small Human Art': 6, Cards: 6, 'Music Notes': 6, Camera: 6, Crayon: 6 },
    food: { 'Endura-Growth': 20, 'Neuro-Boost': 10, 'Nutri-Core': 10 },
  });
  const loose = solve({ profession: sculptor, professions, memories, foods, inventory: inv, settings, exclusive: false });
  const strict = solve({ profession: sculptor, professions, memories, foods, inventory: inv, settings, exclusive: true });
  assert.equal(loose.feasible, true);
  assert.equal(strict.feasible, true);
  assert.ok(loose.otherMatches.some((m) => m.tier >= sculptor.tier), 'the unconstrained recipe would also match a T2');
  assert.ok(!strict.otherMatches.some((m) => m.tier >= sculptor.tier), JSON.stringify(strict.otherMatches));
  assert.ok(strict.totals.count >= loose.totals.count);
});
