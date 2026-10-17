import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Store, memoryStorage } from '../client/local/store.js';
import { createLocalApi } from '../client/local/server.js';
import { overview, solve } from '../shared/solver.js';
import { extractSave } from '../shared/save/items.js';

// The in-browser API, run in Node: same routes, storage in memory, compute called directly.
const compute = { overview, solve, extract: async (bytes) => extractSave(new Uint8Array(bytes)) };

async function withServer(fn) {
  const store = new Store(memoryStorage());
  const handle = createLocalApi({ store, compute });
  const call = async (method, path, body) => {
    try {
      return { status: 200, body: await handle(method, `/api${path}`, body) };
    } catch (err) {
      return { status: err.status ?? 500, body: { error: err.message } };
    }
  };
  await fn(call, store);
}

test('seeds data including unverified extra memories', () => withServer(async (call) => {
  const { body } = await call('GET', '/state');
  assert.equal(body.professions.length, 40);
  assert.equal(body.foods.length, 13);
  const extra = body.memories.filter((m) => m.unverified);
  assert.deepEqual(extra.map((m) => m.internal_name).sort(), [
    'DA_Cartridge_Last_Bastions', 'DA_Cartridge_Mod_Manifest_Chant', 'DA_Memory_LifeJacket', 'DA_Memory_Shoes',
  ]);
}));

test('upload import, solve, grow and undo', () => withServer(async (call) => {
  const imp = await call('UPLOAD', '/import/upload', new File([fs.readFileSync('test/fixtures/beta-update6.sav')], 'beta.sav'));
  assert.equal(imp.status, 200);
  assert.ok(imp.body.memories > 100);
  assert.deepEqual(imp.body.unmapped, {});
  assert.equal(imp.body.meta.compressor, 'oodle-kraken');

  const state = (await call('GET', '/state')).body;
  const doctor = state.professions.find((p) => p.profession === 'Doctor');
  const res = (await call('POST', '/solve', { professionId: doctor.id, mode: 'inventory' })).body;
  assert.equal(res.feasible, true);

  const items = res.recipe.map((r) => ({ kind: r.kind, id: r.id, qty: r.own }));
  const grown = await call('POST', '/grow', { professionId: doctor.id, items });
  assert.equal(grown.status, 200);
  for (const i of items) assert.equal(grown.body.inventory[i.kind][i.id] ?? 0, state.inventory[i.kind][i.id] - i.qty);

  const log = (await call('GET', '/grown')).body;
  assert.equal(log.length, 1);
  const undo = await call('DELETE', `/grown/${log[0].id}?restore=1`);
  assert.deepEqual(undo.body.inventory, state.inventory);

  const tooMany = await call('POST', '/grow', { professionId: doctor.id, items: [{ ...items[0], qty: 9999 }] });
  assert.equal(tooMany.status, 400);
}));

test('data editing and settings', () => withServer(async (call) => {
  const created = (await call('POST', '/memories', { name: 'Test Memory', Logic: 7, item_weight: 0.5 })).body;
  assert.equal(created.Logic, 7);
  const updated = (await call('PUT', `/memories/${created.id}`, { Logic: 9 })).body;
  assert.equal(updated.Logic, 9);
  assert.equal(updated.name, 'Test Memory');
  assert.equal((await call('DELETE', `/memories/${created.id}`)).status, 200);
  assert.equal((await call('PUT', '/memories/nope', {})).status, 404);

  const s = (await call('PUT', '/settings', { baselineMode: 'max', podCapacity: 120 })).body;
  assert.equal(s.settings.baselineMode, 'max');
  assert.equal(s.settings.podCapacity, 120);
  assert.equal((await call('POST', '/import/file', { path: '/etc/passwd' })).status, 400);
}));
