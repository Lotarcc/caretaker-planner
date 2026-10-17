import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeChunks } from '../shared/save/chunks.js';
import { parseGvas, tryParseNested } from '../shared/save/gvas.js';
import { extractFromProperties } from '../shared/save/items.js';
import { mapToInventory } from '../shared/importer.js';

const FIXTURES = {
  prebeta: { file: 'test/fixtures/prebeta.sav', compressor: 'zlib', build: 651238 },
  beta: { file: 'test/fixtures/beta-update6.sav', compressor: 'oodle-kraken', build: 653002 },
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
    assert.ok(summary.foods > 10);
    assert.equal(typeof inventory.nutrient, 'object');
  });
}

test('beta: storage boxes are not double counted (module components mirror the inventory)', { skip: skip(FIXTURES.beta) }, () => {
  const { gvas } = decodeChunks(fs.readFileSync(FIXTURES.beta.file));
  const result = extractFromProperties(parseGvas(gvas).properties);
  assert.equal(result.owned['DA_Food_High-FatEnergy'], 18);
  assert.equal(result.owned['DA_Food_Nutri-Core'], 6);
  // Items missing from the old database are reported as unmapped.
  const { summary } = mapToInventory(result, db);
  assert.ok('DA_Cartridge_Last_Bastions' in summary.unmapped);
  assert.equal(mapToInventory(result, db).inventory.nutrient.Omega3, 400);
  assert.equal(result.humans.length, 2);
  assert.ok(result.humans[1].traits.includes('DA_Profession_Room_Supervisor'));
});

test('nested property blobs need the leading zero byte', () => {
  const none = Buffer.concat([Buffer.from([0]), Buffer.from([5, 0, 0, 0]), Buffer.from('None\0'), Buffer.alloc(4)]);
  assert.deepEqual(tryParseNested(none), {});
  assert.equal(tryParseNested(Buffer.from('not a property stream')), null);
});

test('rejects non-save files', () => {
  assert.throws(() => decodeChunks(Buffer.from('hello world, definitely not a save file')), /Not a Last Caretaker save/);
});
