import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openDb } from '../server/db.js';
import { createApp } from '../server/index.js';

async function withServer(fn) {
  const store = openDb(':memory:');
  const server = createApp(store).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, path, body, headers = {}) => {
    const init = { method, headers };
    if (Buffer.isBuffer(body)) init.body = body;
    else if (body !== undefined) { init.body = JSON.stringify(body); init.headers = { ...headers, 'content-type': 'application/json' }; }
    const res = await fetch(base + path, init);
    return { status: res.status, body: await res.json() };
  };
  try { await fn(call, store); } finally { server.close(); }
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
  const imp = await call('POST', '/import/upload', fs.readFileSync('test/fixtures/beta-update6.sav'), { 'x-file-name': 'beta.sav' });
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
