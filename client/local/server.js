// The planner's API, served inside the browser. Same routes the old Express server had, so the pages
// talk to it the same way; data lives in browser storage and heavy work runs in Web Workers.
import { Store, TABLES } from './store.js';
import { mapToInventory } from '../../shared/importer.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {object} deps
 * @param {Store}  deps.store
 * @param {{overview: Function, solve: Function, extract: Function}} deps.compute
 * @param {object} [deps.folder]  save-folder access (client/local/folder.js); absent in tests
 */
export function createLocalApi({ store = new Store(), compute, folder = null }) {
  const routes = [];
  const on = (method, pattern, fn) => {
    const keys = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
    routes.push({ method, re, keys, fn });
  };

  const catalog = () => ({
    memories: store.list('memories'),
    foods: store.list('foods'),
    professions: store.list('professions'),
  });

  on('GET', '/api/state', () => ({
    ...catalog(),
    inventory: store.inventory(),
    settings: store.rules(),
    lastImport: store.getSetting('lastImport'),
  }));

  // ---- data editor ----
  for (const table of Object.keys(TABLES)) {
    on('GET', `/api/${table}`, () => store.list(table));
    on('POST', `/api/${table}`, ({ body }) => store.insertRow(table, body ?? {}));
    on('PUT', `/api/${table}/:id`, ({ params, body }) => {
      const row = store.updateRow(table, params.id, body ?? {});
      if (!row) throw new HttpError(404, 'Not found');
      return row;
    });
    on('DELETE', `/api/${table}/:id`, ({ params }) => {
      if (!store.deleteRow(table, params.id)) throw new HttpError(404, 'Not found');
      return { ok: true };
    });
  }
  on('POST', '/api/reset-data', () => {
    store.seed();
    return { ok: true };
  });

  on('PUT', '/api/settings', ({ body }) => ({ settings: store.setRules(body ?? {}) }));
  on('DELETE', '/api/settings', () => {
    store.setSetting('rules', null);
    return { settings: store.rules() };
  });

  on('GET', '/api/backup', () => store.exportAll());
  on('POST', '/api/backup', ({ body }) => {
    store.importAll(body);
    return { ok: true };
  });

  // ---- inventory ----
  on('GET', '/api/inventory', () => store.inventory());
  on('PUT', '/api/inventory', ({ body }) => {
    const { kind, id, qty } = body ?? {};
    if (!kind || !id) throw new HttpError(400, 'kind and id are required');
    store.setQty(kind, id, qty);
    return store.inventory();
  });
  on('DELETE', '/api/inventory', () => {
    store.clearInventory();
    return store.inventory();
  });

  // ---- save import ----
  const importBytes = async (bytes, source) => {
    const extracted = await compute.extract(bytes);
    const { inventory, summary } = mapToInventory(extracted, { memories: store.list('memories'), foods: store.list('foods') });
    store.replaceInventory(inventory);
    const record = { ...summary, source, meta: extracted.meta, humans: extracted.humans, importedAt: new Date().toISOString() };
    store.setSetting('lastImport', record);
    return record;
  };
  const importFile = async (file, source) => importBytes(await file.arrayBuffer(), source);
  const fromSave = (s) => importFile(s.file, { type: 'folder', path: s.path, name: s.name, modified: s.modified });

  const requireFolder = () => {
    if (!folder?.folderSupported()) {
      throw new HttpError(400, 'This browser cannot open folders. Use Chrome or Edge, or drop a .sav file on the Import page.');
    }
  };
  // Returns the remembered folder with read access, asking (or picking) when allowed.
  const openFolder = async ({ ask }) => {
    requireFolder();
    let dir = await folder.getSavedFolder();
    if (!dir) {
      if (!ask) return { dir: null, permission: 'none' };
      dir = await folder.pickFolder();
    }
    const permission = await folder.folderPermission(dir, { request: ask });
    return { dir: permission === 'granted' ? dir : null, name: dir.name, permission };
  };
  const strip = (s) => ({ path: s.path, name: s.name, folder: s.folder, size: s.size, modified: s.modified });

  on('GET', '/api/import/saves', async () => {
    if (!folder?.folderSupported()) return { supported: false, folder: null, saves: [] };
    const { dir, name, permission } = await openFolder({ ask: false });
    return { supported: true, folder: name ?? null, permission, saves: dir ? (await folder.listSaves(dir)).map(strip) : [] };
  });
  on('POST', '/api/import/folder', async () => {
    requireFolder();
    const dir = await folder.pickFolder();
    const saves = await folder.listSaves(dir);
    return { folder: dir.name, saves: saves.map(strip) };
  });
  on('DELETE', '/api/import/folder', async () => {
    await folder?.forgetFolder();
    return { ok: true };
  });
  on('POST', '/api/import/latest', async () => {
    const { dir, permission } = await openFolder({ ask: true });
    if (!dir) throw new HttpError(403, `No access to the save folder (${permission}). Choose it again on the Import page.`);
    const saves = await folder.listSaves(dir);
    if (!saves.length) {
      throw new HttpError(404, `No .sav files in "${dir.name}" or its subfolders. Choose the SaveGames folder on the Import page.`);
    }
    return fromSave(saves[0]);
  });
  on('POST', '/api/import/file', async ({ body }) => {
    const { dir } = await openFolder({ ask: true });
    const s = dir && (await folder.listSaves(dir)).find((x) => x.path === body?.path);
    if (!s) throw new HttpError(400, 'That file is not in the save folder');
    return fromSave(s);
  });
  // On page load: if the browser still grants access, load the newest save when it is newer than the last import.
  on('POST', '/api/import/auto', async () => {
    if (!folder?.folderSupported()) return { imported: false, reason: 'unsupported' };
    const { dir, permission } = await openFolder({ ask: false });
    if (!dir) return { imported: false, reason: permission };
    const [newest] = await folder.listSaves(dir);
    if (!newest) return { imported: false, reason: 'empty' };
    const last = store.getSetting('lastImport');
    if (last?.source?.path === newest.path && last?.source?.modified === newest.modified) return { imported: false, reason: 'current' };
    return { imported: true, result: await fromSave(newest) };
  });
  on('UPLOAD', '/api/import/upload', ({ body }) =>
    importFile(body, { type: 'upload', name: body.name, modified: body.lastModified ? new Date(body.lastModified).toISOString() : null }));

  // ---- planning ----
  const planInput = () => ({ ...catalog(), inventory: store.inventory(), settings: store.rules() });
  on('GET', '/api/overview', () => compute.overview(planInput()));
  on('POST', '/api/solve', ({ body }) => {
    const input = planInput();
    const profession = input.professions.find((p) => p.id === body?.professionId);
    if (!profession) throw new HttpError(404, 'Unknown profession');
    return compute.solve({
      ...input,
      profession,
      mode: body.mode === 'plan' ? 'plan' : 'inventory',
      exclusive: body.exclusive !== false,
    });
  });

  // ---- growing ----
  on('POST', '/api/grow', ({ body }) => {
    const { professionId, items, note } = body ?? {};
    if (!store.getRow('professions', professionId)) throw new HttpError(404, 'Unknown profession');
    if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'No items');
    const clean = items.map((i) => ({ kind: String(i.kind), id: String(i.id), qty: Math.floor(Number(i.qty)) }))
      .filter((i) => i.qty > 0);
    const entry = store.grow(professionId, clean, note ?? null);
    return { entry, inventory: store.inventory() };
  });
  on('GET', '/api/grown', () => store.grownLog());
  on('DELETE', '/api/grown/:id', ({ params, query }) => {
    if (!store.deleteGrown(Number(params.id), query.get('restore') === '1')) throw new HttpError(404, 'Not found');
    return { ok: true, inventory: store.inventory() };
  });

  return async function handle(method, url, body) {
    const [path, qs = ''] = url.split('?');
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = path.match(r.re);
      if (!m) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      // Round-trip through JSON so callers never share objects with the store.
      const input = body instanceof Blob || body === undefined ? body : JSON.parse(JSON.stringify(body));
      return r.fn({ params, query: new URLSearchParams(qs), body: input });
    }
    throw new HttpError(404, 'Not found');
  };
}
