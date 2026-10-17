// SQLite storage (node:sqlite, built in). Seeded from data/source on first run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { ALL_ATTRS, FOOD_ATTRS, MEMORY_ATTRS, NUTRIENTS, DEFAULT_SETTINGS, withDefaults } from '../shared/rules.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE_DIR = path.join(ROOT, 'data', 'source');
export const DEFAULT_DB_PATH = path.join(ROOT, 'data', 'caretaker.db');

// Items seen in saves that the old site's database lacks. Stats unknown until checked in game.
export const EXTRA_MEMORIES = [
  { name: 'Last Bastions', internal_name: 'DA_Cartridge_Last_Bastions', item_weight: 0.3 },
  { name: 'Manifest Chant', internal_name: 'DA_Cartridge_Mod_Manifest_Chant', item_weight: 0.3 },
  { name: 'Life Jacket', internal_name: 'DA_Memory_LifeJacket', item_weight: 1 },
  { name: 'Shoes', internal_name: 'DA_Memory_Shoes', item_weight: 1 },
];

const TEXT = 'TEXT';
const REAL = 'REAL NOT NULL DEFAULT 0';

export const TABLES = {
  memories: {
    columns: {
      id: 'TEXT PRIMARY KEY', name: 'TEXT NOT NULL', internal_name: TEXT, item_weight: REAL,
      description: TEXT, image_url: TEXT, unverified: 'INTEGER NOT NULL DEFAULT 0',
      ...Object.fromEntries(MEMORY_ATTRS.map((a) => [a, REAL])),
    },
    numeric: ['item_weight', 'unverified', ...MEMORY_ATTRS],
    order: 'name',
  },
  foods: {
    columns: {
      id: 'TEXT PRIMARY KEY', name: 'TEXT NOT NULL', internal_name: TEXT, item_weight: REAL, tier: REAL,
      description: TEXT, image_url: TEXT, unverified: 'INTEGER NOT NULL DEFAULT 0',
      ...Object.fromEntries([...FOOD_ATTRS, ...NUTRIENTS].map((a) => [a, REAL])),
    },
    numeric: ['item_weight', 'tier', 'unverified', ...FOOD_ATTRS, ...NUTRIENTS],
    order: 'tier, name',
  },
  professions: {
    columns: {
      id: 'TEXT PRIMARY KEY', profession: 'TEXT NOT NULL', internal_name: TEXT, tier: REAL, category: TEXT,
      requirement_types: "TEXT NOT NULL DEFAULT '{}'",
      ...Object.fromEntries(ALL_ATTRS.map((a) => [a, REAL])),
    },
    numeric: ['tier', ...ALL_ATTRS],
    json: ['requirement_types'],
    order: 'tier, category, profession',
  },
};

export const ITEM_KINDS = ['memory', 'food', 'nutrient'];

export function openDb(file = process.env.CARETAKER_DB ?? DEFAULT_DB_PATH) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  for (const [name, t] of Object.entries(TABLES)) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${name} (${Object.entries(t.columns).map(([c, d]) => `"${c}" ${d}`).join(', ')})`);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      item_kind TEXT NOT NULL, item_id TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (item_kind, item_id)
    );
    CREATE TABLE IF NOT EXISTS grown (
      id INTEGER PRIMARY KEY AUTOINCREMENT, profession_id TEXT NOT NULL, items_json TEXT NOT NULL,
      note TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  const store = new Store(db);
  if (store.count('professions') === 0) store.seed();
  return store;
}

function newId() {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export class Store {
  constructor(db) {
    this.db = db;
  }

  count(table) {
    return this.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  }

  transaction(fn) {
    this.db.exec('BEGIN');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /** (Re)loads memories, foods and professions from data/source. Inventory and log are kept. */
  seed(sourceDir = SOURCE_DIR) {
    const read = (f) => JSON.parse(fs.readFileSync(path.join(sourceDir, f), 'utf8'));
    const memories = read('Memory.json');
    const known = new Set(memories.flatMap((m) => String(m.internal_name ?? '').split(',').map((s) => s.trim())));
    for (const extra of EXTRA_MEMORIES) {
      if (!known.has(extra.internal_name)) memories.push({ ...extra, id: `extra-${extra.internal_name}`, unverified: 1 });
    }
    this.transaction(() => {
      for (const table of Object.keys(TABLES)) this.db.exec(`DELETE FROM ${table}`);
      for (const row of memories) this.insertRow('memories', row);
      for (const row of read('Food.json')) this.insertRow('foods', row);
      for (const row of read('HumanType.json')) this.insertRow('professions', row);
    });
  }

  normalize(table, row) {
    const t = TABLES[table];
    const out = {};
    for (const col of Object.keys(t.columns)) {
      let v = row[col];
      if (t.numeric.includes(col)) v = Number(v ?? 0) || 0;
      else if (t.json?.includes(col)) v = JSON.stringify(typeof v === 'string' ? JSON.parse(v || '{}') : v ?? {});
      else v = v == null || v === '' ? null : String(v);
      out[col] = v;
    }
    if (!out.id) out.id = newId();
    return out;
  }

  insertRow(table, row) {
    const r = this.normalize(table, row);
    const cols = Object.keys(r);
    this.db
      .prepare(`INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
      .run(...cols.map((c) => r[c]));
    return this.getRow(table, r.id);
  }

  updateRow(table, id, patch) {
    const current = this.getRow(table, id);
    if (!current) return null;
    const r = this.normalize(table, { ...current, ...patch, id });
    const cols = Object.keys(r).filter((c) => c !== 'id');
    this.db
      .prepare(`UPDATE ${table} SET ${cols.map((c) => `"${c}" = ?`).join(', ')} WHERE id = ?`)
      .run(...cols.map((c) => r[c]), id);
    return this.getRow(table, id);
  }

  deleteRow(table, id) {
    const kind = { memories: 'memory', foods: 'food' }[table];
    return this.transaction(() => {
      if (kind) this.db.prepare('DELETE FROM inventory WHERE item_kind = ? AND item_id = ?').run(kind, id);
      return this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id).changes > 0;
    });
  }

  decode(table, row) {
    if (!row) return row;
    const out = { ...row };
    for (const c of TABLES[table].json ?? []) out[c] = JSON.parse(out[c] || '{}');
    if ('unverified' in out) out.unverified = Boolean(out.unverified);
    return out;
  }

  getRow(table, id) {
    return this.decode(table, this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id));
  }

  list(table) {
    return this.db.prepare(`SELECT * FROM ${table} ORDER BY ${TABLES[table].order}`).all().map((r) => this.decode(table, r));
  }

  // ---- inventory ----

  inventory() {
    const inv = Object.fromEntries(ITEM_KINDS.map((k) => [k, {}]));
    for (const r of this.db.prepare('SELECT * FROM inventory WHERE qty > 0').all()) {
      if (inv[r.item_kind]) inv[r.item_kind][r.item_id] = r.qty;
    }
    return inv;
  }

  setQty(kind, id, qty) {
    if (!ITEM_KINDS.includes(kind)) throw new Error(`Unknown item kind ${kind}`);
    const q = Math.max(0, Math.floor(Number(qty) || 0));
    if (q === 0) this.db.prepare('DELETE FROM inventory WHERE item_kind = ? AND item_id = ?').run(kind, id);
    else {
      this.db
        .prepare('INSERT INTO inventory (item_kind, item_id, qty) VALUES (?, ?, ?) ON CONFLICT(item_kind, item_id) DO UPDATE SET qty = excluded.qty')
        .run(kind, id, q);
    }
  }

  replaceInventory(inv) {
    this.transaction(() => {
      this.db.exec('DELETE FROM inventory');
      for (const kind of ITEM_KINDS) for (const [id, qty] of Object.entries(inv[kind] ?? {})) this.setQty(kind, id, qty);
    });
  }

  clearInventory() {
    this.db.exec('DELETE FROM inventory');
  }

  // ---- settings ----

  getSetting(key, fallback = null) {
    const r = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return r ? JSON.parse(r.value) : fallback;
  }

  setSetting(key, value) {
    if (value === null || value === undefined) this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    else {
      this.db
        .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .run(key, JSON.stringify(value));
    }
  }

  rules() {
    return withDefaults(this.getSetting('rules', {}));
  }

  setRules(patch) {
    const next = withDefaults({ ...this.getSetting('rules', {}), ...patch });
    // Store only differences from the defaults so future default changes still apply.
    const diff = {};
    for (const [k, v] of Object.entries(next)) {
      if (JSON.stringify(v) !== JSON.stringify(DEFAULT_SETTINGS[k])) diff[k] = v;
    }
    this.setSetting('rules', diff);
    return next;
  }

  // ---- grown log ----

  grow(professionId, items, note = null) {
    return this.transaction(() => {
      const inv = this.inventory();
      for (const { kind, id, qty } of items) {
        const have = inv[kind]?.[id] ?? 0;
        if (qty > have) throw Object.assign(new Error(`Not enough of ${kind} ${id}: have ${have}, need ${qty}`), { status: 400 });
      }
      for (const { kind, id, qty } of items) this.setQty(kind, id, (inv[kind]?.[id] ?? 0) - qty);
      const createdAt = new Date().toISOString();
      const r = this.db
        .prepare('INSERT INTO grown (profession_id, items_json, note, created_at) VALUES (?, ?, ?, ?)')
        .run(professionId, JSON.stringify(items), note, createdAt);
      return { id: Number(r.lastInsertRowid), profession_id: professionId, items, note, created_at: createdAt };
    });
  }

  grownLog() {
    return this.db
      .prepare('SELECT * FROM grown ORDER BY created_at DESC, id DESC')
      .all()
      .map((r) => ({ ...r, items: JSON.parse(r.items_json), items_json: undefined }));
  }

  deleteGrown(id, restore = false) {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM grown WHERE id = ?').get(id);
      if (!row) return false;
      if (restore) {
        const inv = this.inventory();
        for (const { kind, id: itemId, qty } of JSON.parse(row.items_json)) {
          this.setQty(kind, itemId, (inv[kind]?.[itemId] ?? 0) + qty);
          inv[kind][itemId] = (inv[kind]?.[itemId] ?? 0) + qty;
        }
      }
      this.db.prepare('DELETE FROM grown WHERE id = ?').run(id);
      return true;
    });
  }
}
