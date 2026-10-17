import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeChunks } from '../shared/save/chunks.js';
import { parseGvas, tryParseNested } from '../shared/save/gvas.js';
import { extractFromProperties } from '../shared/save/items.js';
import { mapToInventory } from '../shared/importer.js';

// Pinned to snapshots of the developer's own saves (see .claude/skills/caretaker-save): prebeta from 2026-10-06,
// beta from 2026-10-17. Replacing a fixture means updating the counts below.
const FIXTURES = {
  prebeta: { file: 'test/fixtures/prebeta.sav', compressor: 'zlib', build: 651238, minFoods: 10 },
  beta: { file: 'test/fixtures/beta-update6.sav', compressor: 'oodle-kraken', build: 653173, minFoods: 1 },
};
// The save fixtures aren't published; the tests that need them skip when they're absent.
const skip = (fx) => !fs.existsSync(fx.file) && `${fx.file} missing; save tests need local fixtures`;
const read = (f) => JSON.parse(fs.readFileSync(`data/source/${f}.json`, 'utf8'));
const db = { memories: read('Memory'), foods: read('Food') };

for (const [name, fx] of Object.entries(FIXTURES)) {
  test(`${name}: chunks decode to GVAS and extract owned items`, { skip: skip(fx) }, () => {
    const { gvas, compressor } = decodeChunks(fs.readFileSync(fx.file));
    assert.equal(compressor, fx.compressor);
    assert.equal(gvas.subarray(0, 4).toString('latin1'), 'GVAS');

    const { header, properties } = parseGvas(gvas);
    assert.equal(header.saveClass, '/Script/Voyage.VoyageSaveGame');
    assert.equal(properties.GameBuildLastUpdate, fx.build);

    const result = extractFromProperties(properties);
    // Known items with non-zero counts.
    assert.ok(result.owned['DA_Food_High-FatEnergy'] > 0);
    assert.ok(result.owned.DA_Memory_Camera > 0);
    assert.ok(result.owned.DA_ItemLoot_Teddy_02 > 0);
    // Only player, storage and container holders; loose world loot is reported separately.
    assert.deepEqual([...new Set(result.holders.map((h) => h.category))].sort(), ['container', 'player', 'storage']);
    assert.ok(Object.values(result.worldLoot).reduce((a, b) => a + b, 0) > 0);
    // The player's named inventories only (no hidden catalog component).
    assert.deepEqual(result.holders.filter((h) => h.category === 'player').map((h) => h.name).sort(), ['Backpack', 'Equipment', 'Holster']);

    const { inventory, summary } = mapToInventory(result, db);
    assert.ok(summary.memories > 100);
    assert.ok(summary.foods >= fx.minFoods);
    assert.equal(typeof inventory.nutrient, 'object');
    assert.ok(Array.isArray(result.committees));
    assert.ok(result.quests.length > 0);
  });
}

test('beta: storage boxes are not double counted (module components mirror the inventory)', { skip: skip(FIXTURES.beta) }, () => {
  const { gvas } = decodeChunks(fs.readFileSync(FIXTURES.beta.file));
  const result = extractFromProperties(parseGvas(gvas).properties);
  // All four sit in one storage box; reading its module component too would make it eight.
  assert.equal(result.owned['DA_Food_High-FatEnergy'], 4);
  // Items missing from the old database are reported as unmapped.
  const { summary } = mapToInventory(result, db);
  assert.ok('DA_Cartridge_Last_Bastions' in summary.unmapped);
  assert.equal(mapToInventory(result, db).inventory.nutrient.Omega3, 1022);
  assert.equal(result.humans.length, 5);
  assert.ok(result.humans[1].traits.includes('DA_Profession_Room_Supervisor'));
});

test('beta: committee states and quests are read from the save', { skip: skip(FIXTURES.beta) }, () => {
  const { gvas } = decodeChunks(fs.readFileSync(FIXTURES.beta.file));
  const result = extractFromProperties(parseGvas(gvas).properties);
  assert.deepEqual(result.committees.map((c) => [c.key, c.state]), [['HAB_CARE', 'Active']]);
  const quest = (id) => result.quests.find((q) => q.id === id)?.status;
  assert.equal(quest('DA_Quest_CU3_HabitatCommittee'), 'Completed');
  assert.equal(quest('DA_Quest_CU5_TheForbiddenFruit'), 'InProgress');
  // Habitat Care's four members went up in one launch.
  const delivered = result.humans.filter((h) => h.status === 'Delivered').flatMap((h) => h.traits);
  for (const p of ['Room_Supervisor', 'Health_Assistant', 'Teacher', 'Lab_Technician']) assert.ok(delivered.includes(`DA_Profession_${p}`), p);
});

test('nested property blobs need the leading zero byte', () => {
  const none = Buffer.concat([Buffer.from([0]), Buffer.from([5, 0, 0, 0]), Buffer.from('None\0'), Buffer.alloc(4)]);
  assert.deepEqual(tryParseNested(none), {});
  assert.equal(tryParseNested(Buffer.from('not a property stream')), null);
});

test('rejects non-save files', () => {
  assert.throws(() => decodeChunks(Buffer.from('hello world, definitely not a save file')), /Not a Last Caretaker save/);
});
