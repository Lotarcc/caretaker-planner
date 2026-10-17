// Turns an extracted save into planner inventory (pure; used in the browser and in tests).
import { aliases, NUTRIENT_ASSETS } from './rules.js';
import { isRelevantAsset } from './save/items.js';

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
