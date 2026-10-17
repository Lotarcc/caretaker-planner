// Browser storage for the planner (replaces the old SQLite store). Everything lives in one JSON
// document in localStorage, seeded from data/source on first run. The storage backend is injectable
// so tests can run it in Node.
import memoriesSrc from '../../data/source/Memory.json' with { type: 'json' };
import foodsSrc from '../../data/source/Food.json' with { type: 'json' };
import professionsSrc from '../../data/source/HumanType.json' with { type: 'json' };
import { ALL_ATTRS, FOOD_ATTRS, MEMORY_ATTRS, NUTRIENTS, DEFAULT_SETTINGS, withDefaults } from '../../shared/rules.js';

const STORAGE_KEY = 'caretaker-planner:v1';

// Items seen in saves that the old site's database lacks. Stats unknown until checked in game.
export const EXTRA_MEMORIES = [
  { name: 'Last Bastions', internal_name: 'DA_Cartridge_Last_Bastions', item_weight: 0.3 },
  { name: 'Manifest Chant', internal_name: 'DA_Cartridge_Mod_Manifest_Chant', item_weight: 0.3 },
  { name: 'Life Jacket', internal_name: 'DA_Memory_LifeJacket', item_weight: 1 },
  { name: 'Shoes', internal_name: 'DA_Memory_Shoes', item_weight: 1 },
];

export const TABLES = {
  memories: {
    text: ['name', 'internal_name', 'description', 'image_url'],
    numeric: ['item_weight', ...MEMORY_ATTRS],
    bool: ['unverified'],
    sort: (a, b) => a.name.localeCompare(b.name),
  },
  foods: {
    text: ['name', 'internal_name', 'description', 'image_url'],
    numeric: ['item_weight', 'tier', ...FOOD_ATTRS, ...NUTRIENTS],
    bool: ['unverified'],
    sort: (a, b) => a.tier - b.tier || a.name.localeCompare(b.name),
  },
  professions: {
    text: ['profession', 'internal_name', 'category'],
    numeric: ['tier', ...ALL_ATTRS],
    json: ['requirement_types'],
    sort: (a, b) => a.tier - b.tier || String(a.category).localeCompare(String(b.category)) || a.profession.localeCompare(b.profession),
  },
};

export const ITEM_KINDS = ['memory', 'food', 'nutrient'];

function newId() {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/** In-memory storage with the localStorage interface (for tests and private windows). */
export function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

function defaultStorage() {
  try {
    const s = globalThis.localStorage;
    s.setItem(`${STORAGE_KEY}:probe`, '1');
    s.removeItem(`${STORAGE_KEY}:probe`);
    return s;
  } catch {
    return memoryStorage();
  }
}

export class Store {
  constructor(storage = defaultStorage()) {
    this.storage = storage;
    let doc = null;
    try { doc = JSON.parse(storage.getItem(STORAGE_KEY)); } catch { doc = null; }
    this.doc = doc ?? { memories: [], foods: [], professions: [], inventory: {}, grown: [], settings: {}, nextGrownId: 1 };
    if (!this.doc.professions.length) this.seed();
  }

  save() {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.doc));
    } catch (err) {
      throw new Error(`Could not save to browser storage: ${err.message}`);
    }
  }

  /** (Re)loads memories, foods and professions from data/source. Inventory and log are kept. */
  seed() {
    const memories = structuredClone(memoriesSrc);
    const known = new Set(memories.flatMap((m) => String(m.internal_name ?? '').split(',').map((s) => s.trim())));
    for (const extra of EXTRA_MEMORIES) {
      if (!known.has(extra.internal_name)) memories.push({ ...extra, id: `extra-${extra.internal_name}`, unverified: true });
    }
    this.doc.memories = memories.map((r) => this.normalize('memories', r));
    this.doc.foods = foodsSrc.map((r) => this.normalize('foods', r));
    this.doc.professions = professionsSrc.map((r) => this.normalize('professions', r));
    this.save();
  }

  normalize(table, row) {
    const t = TABLES[table];
    const out = { id: row.id ? String(row.id) : newId() };
    for (const c of t.text) out[c] = row[c] == null || row[c] === '' ? null : String(row[c]);
    for (const c of t.numeric) out[c] = Number(row[c] ?? 0) || 0;
    for (const c of t.bool ?? []) out[c] = Boolean(row[c]);
    for (const c of t.json ?? []) out[c] = typeof row[c] === 'string' ? JSON.parse(row[c] || '{}') : structuredClone(row[c] ?? {});
    return out;
  }

  list(table) {
    return [...this.doc[table]].sort(TABLES[table].sort).map((r) => structuredClone(r));
  }

  getRow(table, id) {
    const r = this.doc[table].find((x) => x.id === id);
    return r ? structuredClone(r) : null;
  }

  insertRow(table, row) {
    const r = this.normalize(table, row);
    this.doc[table].push(r);
    this.save();
    return structuredClone(r);
  }

  updateRow(table, id, patch) {
    const i = this.doc[table].findIndex((x) => x.id === id);
    if (i < 0) return null;
    this.doc[table][i] = this.normalize(table, { ...this.doc[table][i], ...patch, id });
    this.save();
    return structuredClone(this.doc[table][i]);
  }

  deleteRow(table, id) {
    const before = this.doc[table].length;
    this.doc[table] = this.doc[table].filter((x) => x.id !== id);
    const kind = { memories: 'memory', foods: 'food' }[table];
    if (kind) delete this.doc.inventory[kind]?.[id];
    this.save();
    return this.doc[table].length < before;
  }

  // ---- inventory ----

  inventory() {
    const inv = Object.fromEntries(ITEM_KINDS.map((k) => [k, {}]));
    for (const kind of ITEM_KINDS) {
      for (const [id, qty] of Object.entries(this.doc.inventory[kind] ?? {})) if (qty > 0) inv[kind][id] = qty;
    }
    return inv;
  }

  setQty(kind, id, qty, { persist = true } = {}) {
    if (!ITEM_KINDS.includes(kind)) throw new Error(`Unknown item kind ${kind}`);
    const q = Math.max(0, Math.floor(Number(qty) || 0));
    this.doc.inventory[kind] ??= {};
    if (q === 0) delete this.doc.inventory[kind][id];
    else this.doc.inventory[kind][id] = q;
    if (persist) this.save();
  }

  replaceInventory(inv) {
    this.doc.inventory = {};
    for (const kind of ITEM_KINDS) for (const [id, qty] of Object.entries(inv[kind] ?? {})) this.setQty(kind, id, qty, { persist: false });
    this.save();
  }

  clearInventory() {
    this.doc.inventory = {};
    this.save();
  }

  // ---- settings ----

  getSetting(key, fallback = null) {
    return key in this.doc.settings ? structuredClone(this.doc.settings[key]) : fallback;
  }

  setSetting(key, value) {
    if (value === null || value === undefined) delete this.doc.settings[key];
    else this.doc.settings[key] = structuredClone(value);
    this.save();
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
    const inv = this.inventory();
    for (const { kind, id, qty } of items) {
      const have = inv[kind]?.[id] ?? 0;
      if (qty > have) throw Object.assign(new Error(`Not enough of ${kind} ${id}: have ${have}, need ${qty}`), { status: 400 });
    }
    for (const { kind, id, qty } of items) this.setQty(kind, id, (inv[kind]?.[id] ?? 0) - qty, { persist: false });
    const entry = { id: this.doc.nextGrownId++, profession_id: professionId, items, note, created_at: new Date().toISOString() };
    this.doc.grown.push(entry);
    this.save();
    return structuredClone(entry);
  }

  grownLog() {
    return [...this.doc.grown].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id).map((r) => structuredClone(r));
  }

  deleteGrown(id, restore = false) {
    const row = this.doc.grown.find((g) => g.id === id);
    if (!row) return false;
    if (restore) {
      const inv = this.inventory();
      for (const { kind, id: itemId, qty } of row.items) this.setQty(kind, itemId, (inv[kind]?.[itemId] ?? 0) + qty, { persist: false });
    }
    this.doc.grown = this.doc.grown.filter((g) => g.id !== id);
    this.save();
    return true;
  }

  /** Everything, for backup/export. */
  exportAll() {
    return structuredClone(this.doc);
  }

  importAll(doc) {
    if (!doc || !Array.isArray(doc.professions)) throw new Error('Not a Caretaker Planner backup');
    this.doc = { inventory: {}, grown: [], settings: {}, nextGrownId: 1, ...structuredClone(doc) };
    this.save();
  }
}
