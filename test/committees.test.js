import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COMMITTEES, adviceFromSave, committeeProgress, matchesSaveKey } from '../shared/committees.js';

const professions = JSON.parse(fs.readFileSync('data/source/HumanType.json', 'utf8')).map((p) => ({ ...p, id: String(p.id) }));
const byName = (n) => professions.find((p) => p.profession === n);
const human = (name, status = 'Delivered') => ({ status, traits: [byName(name).internal_name] });

test('the ten committees seat each of the 40 professions exactly once', () => {
  const seats = COMMITTEES.flatMap((c) => c.members);
  assert.equal(COMMITTEES.length, 10);
  assert.equal(new Set(seats).size, 40);
  assert.deepEqual([...seats].sort(), professions.map((p) => p.profession).sort());
});

test('save codes match committee names word for word', () => {
  assert.ok(matchesSaveKey('HAB_CARE', 'Habitat Care'));
  assert.ok(matchesSaveKey('DECK_OPS', 'Deck Operations'));
  assert.ok(matchesSaveKey('TRANSIT_DIST', 'Transit & Distribution'));
  assert.ok(!matchesSaveKey('HAB_CARE', 'Deck Operations'));
  assert.ok(!matchesSaveKey('', 'Habitat Care'));
  // Too loose to trust: one-letter tokens, or fewer tokens than words.
  assert.ok(!matchesSaveKey('D_O', 'Deck Operations'));
  assert.ok(!matchesSaveKey('DS', 'Deep Systems'));
});

test('no save: nothing done and the first committee is next', () => {
  const p = committeeProgress({ professions });
  assert.equal(p.doneCount, 0);
  assert.equal(p.next, COMMITTEES[0].id);
  assert.deepEqual(adviceFromSave(null, p), []);
});

test('a launched committee is done, and the next one follows the order', () => {
  const lastImport = {
    humans: [
      ...['Room Supervisor', 'Health Assistant', 'Teacher', 'Lab Technician'].map((n) => human(n)),
      human('Guard', 'Success'),
      { status: 'Delivered', traits: [] },
    ],
    committees: [{ key: 'HAB_CARE', state: 'Active' }, { key: 'MYSTERY_X', state: 'Locked' }, { key: 'CULT_MEM', state: 'Active' }],
    quests: [
      { id: 'DA_Quest_CU5_Project_Jonah', status: 'InProgress' },
      { id: 'DA_Quest_CU3_HabitatCommittee', status: 'Completed' },
    ],
  };
  const p = committeeProgress({ professions, lastImport });
  const hab = p.committees.find((c) => c.id === 'habitat-care');
  assert.equal(hab.done, true);
  assert.equal(hab.saveState, 'Active');
  assert.equal(hab.quests.find((q) => q.name === 'Seats of Care').status, 'Completed');
  assert.equal(hab.quests.find((q) => q.name === 'True Choices').status, null);
  // A grown Guard doesn't make Transit & Distribution jump the queue: members needn't launch together.
  assert.equal(p.committees.find((c) => c.id === 'transit-distribution').grown, 1);
  assert.equal(p.next, COMMITTEES[1].id);
  assert.equal(p.committees.find((c) => c.id === 'culture-memory').saveState, 'Active');
  assert.equal(p.doneCount, 1);
  assert.equal(p.professionless, 1);
  assert.deepEqual(p.unknownSaveStates.map((s) => s.key), ['MYSTERY_X']);
  const advice = adviceFromSave(lastImport, p);
  assert.ok(advice.some((a) => a.includes('Guard')));
  assert.ok(advice.some((a) => a.includes('Project Jonah')));
});

test('seats are found by profession asset even after a profession is renamed', () => {
  const renamed = professions.map((p) => (p.profession === 'Door Jammer' ? { ...p, profession: 'Jammer (edited)' } : p));
  const p = committeeProgress({ professions: renamed, lastImport: { humans: [human('Door Jammer')] } });
  const seat = p.committees.find((c) => c.id === 'deck-operations').members.find((m) => m.name === 'Door Jammer');
  assert.equal(seat.id, byName('Door Jammer').id);
  assert.equal(seat.fate, 'delivered');
});

test('only known human statuses count', () => {
  const p = committeeProgress({ professions, lastImport: { humans: [human('Guard', 'Failed')] } });
  assert.equal(p.committees.find((c) => c.id === 'transit-distribution').grown, 0);
  assert.deepEqual(p.waiting, []);
});
