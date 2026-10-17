import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { openDb, TABLES } from './db.js';
import { findSaves, importBuffer, resolveSavePath } from './importer.js';
import { overview, solve } from '../shared/solver.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res);
    if (out !== undefined) res.json(out);
  } catch (err) {
    next(err);
  }
};

export function createApp(store) {
  const app = express();
  app.use('/api', express.json({ limit: '2mb' }));

  const catalog = () => ({
    memories: store.list('memories'),
    foods: store.list('foods'),
    professions: store.list('professions'),
  });

  app.get('/api/state', wrap(() => ({
    ...catalog(),
    inventory: store.inventory(),
    settings: store.rules(),
    saveDir: store.getSetting('saveDir', ''),
    lastImport: store.getSetting('lastImport'),
  })));

  // ---- data editor ----
  for (const table of Object.keys(TABLES)) {
    app.get(`/api/${table}`, wrap(() => store.list(table)));
    app.post(`/api/${table}`, wrap((req) => store.insertRow(table, req.body ?? {})));
    app.put(`/api/${table}/:id`, wrap((req) => {
      const row = store.updateRow(table, req.params.id, req.body ?? {});
      if (!row) throw new HttpError(404, 'Not found');
      return row;
    }));
    app.delete(`/api/${table}/:id`, wrap((req) => {
      if (!store.deleteRow(table, req.params.id)) throw new HttpError(404, 'Not found');
      return { ok: true };
    }));
  }
  app.post('/api/reset-data', wrap(() => {
    store.seed();
    return { ok: true };
  }));

  app.put('/api/settings', wrap((req) => {
    const { saveDir, ...rules } = req.body ?? {};
    if (saveDir !== undefined) store.setSetting('saveDir', saveDir || null);
    return { settings: store.setRules(rules), saveDir: store.getSetting('saveDir', '') };
  }));
  app.delete('/api/settings', wrap(() => {
    store.setSetting('rules', null);
    return { settings: store.rules() };
  }));

  // ---- inventory ----
  app.get('/api/inventory', wrap(() => store.inventory()));
  app.put('/api/inventory', wrap((req) => {
    const { kind, id, qty } = req.body ?? {};
    if (!kind || !id) throw new HttpError(400, 'kind and id are required');
    store.setQty(kind, id, qty);
    return store.inventory();
  }));
  app.delete('/api/inventory', wrap(() => {
    store.clearInventory();
    return store.inventory();
  }));

  // ---- save import ----
  app.get('/api/import/saves', wrap(() => findSaves(store.getSetting('saveDir'))));
  const importFile = (file) => importBuffer(fs.readFileSync(file.path), store, { type: 'file', path: file.path, name: file.name, modified: file.modified });
  app.post('/api/import/latest', wrap(() => {
    const { saves, dirs } = findSaves(store.getSetting('saveDir'));
    if (!saves.length) {
      throw new HttpError(404, `No .sav files found. Looked in: ${dirs.join('; ') || '(no save folders found)'}. Set the save folder in Data → Settings, or drop a file.`);
    }
    return importFile(saves[0]);
  }));
  app.post('/api/import/file', wrap((req) => {
    const file = resolveSavePath(String(req.body?.path ?? ''), store.getSetting('saveDir'));
    if (!file) throw new HttpError(400, 'That file is not in a known save folder');
    return importFile(file);
  }));
  app.post('/api/import/upload', express.raw({ type: () => true, limit: '300mb' }), wrap((req) => {
    if (!req.body?.length) throw new HttpError(400, 'Empty upload');
    const name = String(req.headers['x-file-name'] ?? 'upload.sav');
    return importBuffer(req.body, store, { type: 'upload', name: decodeURIComponent(name) });
  }));

  // ---- planning ----
  const planInput = () => ({ ...catalog(), inventory: store.inventory(), settings: store.rules() });
  app.get('/api/overview', wrap(() => {
    const input = planInput();
    return overview(input);
  }));
  app.post('/api/solve', wrap((req) => {
    const input = planInput();
    const profession = input.professions.find((p) => p.id === req.body?.professionId);
    if (!profession) throw new HttpError(404, 'Unknown profession');
    return solve({
      ...input,
      profession,
      mode: req.body.mode === 'plan' ? 'plan' : 'inventory',
      exclusive: req.body.exclusive !== false,
    });
  }));

  // ---- growing ----
  app.post('/api/grow', wrap((req) => {
    const { professionId, items, note } = req.body ?? {};
    if (!store.getRow('professions', professionId)) throw new HttpError(404, 'Unknown profession');
    if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'No items');
    const clean = items.map((i) => ({ kind: String(i.kind), id: String(i.id), qty: Math.floor(Number(i.qty)) }))
      .filter((i) => i.qty > 0);
    const entry = store.grow(professionId, clean, note ?? null);
    return { entry, inventory: store.inventory() };
  }));
  app.get('/api/grown', wrap(() => store.grownLog()));
  app.delete('/api/grown/:id', wrap((req) => {
    if (!store.deleteGrown(Number(req.params.id), req.query.restore === '1')) throw new HttpError(404, 'Not found');
    return { ok: true, inventory: store.inventory() };
  }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // ---- built client ----
  if (fs.existsSync(DIST)) {
    app.use(express.static(DIST));
    app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
  } else {
    app.get('/', (req, res) => res.type('text').send('Client not built. Run `npm run build`, or `npm run dev` for development.'));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status ?? (err.type === 'entity.too.large' ? 413 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err.message ?? String(err) });
  });
  return app;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT ?? 5174);
  const host = process.env.HOST ?? '127.0.0.1';
  const store = openDb();
  createApp(store).listen(port, host, () => {
    console.log(`Caretaker Planner running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  });
}
