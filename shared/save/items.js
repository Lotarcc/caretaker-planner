// Extracts owned items (player inventory + storage + containers) and grown-human results from a parsed save.
import { decodeChunks } from './chunks.js';
import { parseGvas, tryParseNested } from './gvas.js';

// Which actors count as "owned". Everything else (loose physics props, placed pickups) is world loot.
export const HOLDER_RULES = [
  { category: 'player', label: 'Player', test: /^BP_FirstPersonCharacter/ },
  { category: 'storage', label: 'Storage box', test: /^BP_Inventory_PlayerBox/ },
  { category: 'container', label: 'Container', test: /^BP_Inventory_Container_/ },
  { category: 'container', label: 'Boat', test: /^BP_Boat_/ },
];
export const OWNED_CATEGORIES = ['player', 'storage', 'container'];

const RELEVANT = /^DA_(Food_|Memory_|Cartridge_|ItemLoot_Teddy)/;

export function classifyActor(name) {
  for (const rule of HOLDER_RULES) if (rule.test.test(name)) return rule;
  return { category: 'world', label: 'World' };
}

function textValue(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && '$text' in v) {
    const t = v.$text ?? '';
    // String-table references look like "/Game/.../ST_Inventory.ST_Inventory:Backpack".
    return t.includes(':') && t.startsWith('/') ? t.slice(t.lastIndexOf(':') + 1) : t;
  }
  return '';
}

function actorClass(name) {
  const m = name.match(/^(.*?_C)(?:[-\d_]|$)/);
  return m ? m[1] : name;
}

// "EVoyageCommitteeState::Active" -> "Active"
const enumName = (v) => String(v ?? '').replace(/^.*::/, '');

function itemCount(entry) {
  const n = entry.value?.Data?.ItemCount;
  // Non-stackable items store 0; they still represent one item.
  return typeof n === 'number' && n > 0 ? n : 1;
}

/** Walks a parsed save and returns owned items grouped by holder plus grown-human results. */
export function extractFromProperties(properties) {
  const progressEntries = properties.GameProgress?.entries ?? [];
  if (!progressEntries.length) throw new Error('Save has no GameProgress data');
  const world = progressEntries[0].value;

  const holders = [];
  const owned = new Map();
  const worldLoot = new Map();
  const zeroCounts = new Set();

  for (const level of world.PersistentActors?.entries ?? []) {
    for (const actorEntry of level.value?.actors?.entries ?? []) {
      const actor = actorEntry.value;
      const name = actor.ActorName || actor.ActorClass || '';
      const rule = classifyActor(name);
      const blobs = [actor.ByteData, ...(actor.ComponentData?.entries ?? []).map((c) => c.value?.ByteData)];
      const actorHolders = [];
      for (const blob of blobs) {
        if (!blob?.$bytes) continue;
        const data = tryParseNested(blob.$bytes);
        const items = data?.Items?.entries;
        if (!items?.length) continue;

        if (rule.category === 'world') {
          for (const e of items) {
            const asset = e.value?.AssetName;
            if (asset && RELEVANT.test(asset)) worldLoot.set(asset, (worldLoot.get(asset) ?? 0) + itemCount(e));
          }
          continue;
        }
        // Only real inventory components count: module components mirror their owner's inventory, and the
        // player's unnamed inventories are internal (e.g. a catalog holding one of every known item).
        if (!('bAllowNearbyQueries' in data)) continue;
        if (rule.category === 'player' && !textValue(data.Name)) continue;
        const counts = {};
        for (const e of items) {
          const asset = e.value?.AssetName;
          if (!asset) continue;
          const n = itemCount(e);
          if (e.value?.Data?.ItemCount === 0 && RELEVANT.test(asset)) zeroCounts.add(asset);
          counts[asset] = (counts[asset] ?? 0) + n;
          owned.set(asset, (owned.get(asset) ?? 0) + n);
        }
        actorHolders.push({ name: textValue(data.Name), counts });
      }
      // The player keeps separate named inventories (Holster, Backpack, ...); other actors' unnamed
      // components are folded into the actor's named inventory.
      const actorName = actorHolders.find((h) => h.name)?.name || rule.label;
      for (const h of actorHolders) {
        const label = h.name || actorName;
        let holder = holders.find((x) => x.actorId === String(actorEntry.key) && x.name === label);
        if (!holder) {
          holder = { category: rule.category, kind: rule.label, actor: actorClass(name), actorId: String(actorEntry.key), name: label, items: {} };
          holders.push(holder);
        }
        for (const [asset, n] of Object.entries(h.counts)) holder.items[asset] = (holder.items[asset] ?? 0) + n;
      }
    }
  }

  const humans = (world.HumanGrow ?? []).map((h) => ({
    id: h.UniqueID,
    status: enumName(h.Type),
    timestamp: h.Timestamp || null,
    deliveredAt: h.DeliveryTimestamp || null,
    traits: (h.Traits ?? []).map((t) => String(t).replace(/^.*\./, '')),
    attributes: Object.fromEntries(
      (h.properties?.entries ?? []).map((p) => [
        String(p.key).replace(/^.*Property_/, ''),
        Math.round(Number(p.value) * 100) / 100,
      ]),
    ),
  }));

  // Committees the game has started tracking, keyed by its own short codes (e.g. HAB_CARE). Only committees
  // that reached some state are present, so an absent committee means "not started".
  const committees = (world.CommitteeData?.entries ?? []).map((e) => ({
    key: String(e.key),
    state: enumName(e.value?.State),
    updatedAt: e.value?.LastStateUpdateTimestamp || null,
  }));

  const quests = (world.Quests?.QuestState?.entries ?? []).map((e) => ({
    id: e.key?.PrimaryAssetName ?? String(e.key),
    status: enumName(e.value?.Status),
    updatedAt: e.value?.LastUpdate || null,
  }));

  return {
    meta: {
      slot: properties.SlotName ?? null,
      world: progressEntries[0].key,
      build: properties.GameBuildLastUpdate ?? null,
      savedAt: world.LastUpdateTime ?? null,
      playtimeSeconds: world.PlaytimeTime ?? null,
    },
    owned: Object.fromEntries([...owned].sort()),
    worldLoot: Object.fromEntries([...worldLoot].sort()),
    holders,
    humans,
    committees,
    quests,
    zeroCountAssets: [...zeroCounts],
  };
}

/** Full pipeline: raw .sav bytes -> owned items. */
export function extractSave(buf) {
  const { gvas, compressor } = decodeChunks(buf);
  const { header, properties } = parseGvas(gvas);
  const result = extractFromProperties(properties);
  result.meta.compressor = compressor;
  result.meta.engine = `${header.engine.major}.${header.engine.minor}.${header.engine.patch}`;
  return result;
}

export function isRelevantAsset(name) {
  return RELEVANT.test(name);
}
