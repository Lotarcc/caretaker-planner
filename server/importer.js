// Turns an extracted save into planner inventory and finds save files on disk.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractSave, isRelevantAsset } from './save/items.js';
import { aliases, NUTRIENT_ASSETS } from '../shared/rules.js';

/** Maps game asset names to DB rows; returns inventory plus everything the UI needs to explain the import. */
export function mapToInventory(extracted, { memories, foods }) {
  const byAsset = new Map();
  for (const [kind, rows] of [['memory', memories], ['food', foods]]) {
    for (const row of rows) for (const a of aliases(row)) byAsset.set(a, { kind, row });
  }

  const inventory = { memory: {}, food: {}, nutrient: {} };
  const unmapped = {};
  for (const [asset, qty] of Object.entries(extracted.owned)) {
    const hit = byAsset.get(asset);
    if (hit) inventory[hit.kind][hit.row.id] = (inventory[hit.kind][hit.row.id] ?? 0) + qty;
    else if (NUTRIENT_ASSETS[asset]) inventory.nutrient[NUTRIENT_ASSETS[asset]] = qty;
    else if (isRelevantAsset(asset)) unmapped[asset] = qty;
  }

  // Where the planner-relevant items are stored, for the import summary.
  const sources = extracted.holders
    .map((h) => {
      const items = Object.entries(h.items).filter(([a]) => byAsset.has(a) || NUTRIENT_ASSETS[a] || isRelevantAsset(a));
      return { category: h.category, kind: h.kind, name: h.name, count: items.reduce((n, [, q]) => n + q, 0) };
    })
    .filter((s) => s.count > 0);

  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  return {
    inventory,
    summary: {
      memories: sum(inventory.memory),
      memoryTypes: Object.keys(inventory.memory).length,
      foods: sum(inventory.food),
      foodTypes: Object.keys(inventory.food).length,
      nutrients: inventory.nutrient,
      unmapped,
      excludedWorldLoot: sum(Object.fromEntries(Object.entries(extracted.worldLoot).filter(([a]) => byAsset.has(a)))),
      sources,
    },
  };
}

export function importBuffer(buf, store, source) {
  const extracted = extractSave(buf);
  const db = { memories: store.list('memories'), foods: store.list('foods') };
  const { inventory, summary } = mapToInventory(extracted, db);
  store.replaceInventory(inventory);
  const record = {
    ...summary,
    source,
    meta: extracted.meta,
    humans: extracted.humans,
    importedAt: new Date().toISOString(),
  };
  store.setSetting('lastImport', record);
  return record;
}

// ---- save discovery ----

export function saveDirs(configured) {
  const dirs = [];
  if (configured) dirs.push(configured);
  if (process.env.CARETAKER_SAVE_DIR) dirs.push(process.env.CARETAKER_SAVE_DIR);
  if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Voyage', 'Saved', 'SaveGames'));
  const home = os.homedir();
  // Steam Proton prefixes on Linux / Steam Deck.
  for (const steam of [path.join(home, '.steam', 'steam'), path.join(home, '.local', 'share', 'Steam')]) {
    const compat = path.join(steam, 'steamapps', 'compatdata');
    let ids = [];
    try { ids = fs.readdirSync(compat); } catch { continue; }
    for (const id of ids) {
      const d = path.join(compat, id, 'pfx', 'drive_c', 'users', 'steamuser', 'AppData', 'Local', 'Voyage', 'Saved', 'SaveGames');
      if (fs.existsSync(d)) dirs.push(d);
    }
  }
  return [...new Set(dirs.map((d) => path.resolve(d)))];
}

/** All .sav files in the save dirs (directly or one folder down, e.g. <steamid>/), newest first. */
export function findSaves(configured) {
  const out = [];
  const scan = (dir, depth) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && depth > 0) scan(p, depth - 1);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.sav')) {
        const st = fs.statSync(p);
        out.push({ path: p, name: e.name, folder: path.basename(dir), size: st.size, modified: st.mtime.toISOString() });
      }
    }
  };
  const dirs = saveDirs(configured);
  for (const d of dirs) scan(d, 1);
  out.sort((a, b) => b.modified.localeCompare(a.modified));
  return { dirs, saves: out };
}

/** Only allow importing .sav files that discovery found (never arbitrary paths). */
export function resolveSavePath(requested, configured) {
  const { saves } = findSaves(configured);
  const target = path.resolve(requested);
  return saves.find((s) => s.path === target) ?? null;
}
