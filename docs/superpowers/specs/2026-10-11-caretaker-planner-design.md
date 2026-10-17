# Caretaker Planner — Design Spec

Local website replacing thelastcaretaker-tools.com/Calculator for **The Last Caretaker**, working with the
**Update 6 "The Jump" public beta** (Steam build 0.10.0.653002, Oct 9 2026; the user calls it "beta 0.6.0").
Design approved by the user on 2026-10-11.

## Goal

1. Import inventory from a game `.sav` file (old site's import finds nothing on the beta).
2. Show which humans (professions) are growable from what you own.
3. For a chosen profession: the cheapest recipe from inventory, and **what you still need to craft**
   (foods + total nutrient cost) and memories still to find.
4. Better interface than the original.

## Findings so far

### Why the old import breaks
Saves are a sequence of UE compressed chunks:

```
u64 tag = 0x222222229E2A83C1
u64 blockSize (0x20000)
u8  compressor          // 3 = zlib (pre-beta), 2 = Oodle Kraken (beta)
u64 compressedSize, u64 uncompressedSize
{u64 blockCompressed, u64 blockUncompressed} * ceil(uncompressedSize/blockSize)
...block payloads
```

The beta switched compressor 3 to 2 (Oodle Kraken). The decompressed payload is still standard GVAS (UE5, `/Script/Voyage.VoyageSaveGame`).
`ooz-wasm@2.0.0` (npm, GPL-3.0) decodes it: 175 MB in about 1.2 s in Node. See `decode-probe.mjs` in this folder.
`decompressUnsafe(block, uncompressedSize)` is called per block.

### Save item structure
Property tags use the UE 5.4+ format: the type name is followed by an int32 param count and nested type names (recursive),
then int32 size, then a u8 flags byte. Flags: 0x01 array index, 0x02 property guid, 0x04 extensions, 0x08 binary/native, 0x10 bool true.

Items appear as `Items: Map<Int, VoyageItemSerialize>` whose value struct holds:
`AssetType{Name: "Item"|"Equipment"|...}`, `AssetName: NameProperty` (e.g. `DA_Food_Nutri-Core`), and
`Data: VoyageItemData{ItemCount: Int, ItemData, ItemDataMap, Timestamp, Flags, Version}`.
Some maps sit inside `ByteData: Array<Byte>` blobs, which are nested property streams.
Top level: `SlotName`, `PlatformUserIndex`, `GameProgress` (Map<Str, GameProgress>, key e.g. `voyageworld2`), `PlayerData` (PersistentPlayerData).

**Resolved (implemented in `server/save/items.js`):** count **player inventory + containers only** (user decision),
excluding loose world loot. Findings from both fixtures:
- The decompressed payload has a u32 length prefix before `GVAS`. Save game version 3 adds one byte after the class name.
- `ByteData` blobs are `u8 0` + a property stream + 4 padding bytes. Items live in `PersistentActors[level].actors[id]`
  under `ComponentData[*].ByteData -> Items`.
- Owned: `BP_FirstPersonCharacter_New_C` (named inventories Holster/Equipment/Backpack), `BP_Inventory_PlayerBox*`,
  `BP_Inventory_Container_*`, `BP_Boat_*`. World: `BP_DynamicMeshActor_C`, `BP_DynamicSkeletalMeshActor_C`, `BP_Memory_Drawing_*`, etc.
- Only inventory components count (they have `bAllowNearbyQueries`). Storage boxes also carry a module component that
  mirrors their items, which would double-count. The player's unnamed inventory is a catalog (one of every known item).
- Nutrient materials (`DA_Material_Food_*`) are imported too, so craft plans can be compared against stock.
- `HumanGrow` holds grown-human results (traits = profession + mutations, final attribute values). Shown on the Grown page.

### Item mapping
The game's `DA_*` names are matched to DB rows by `internal_name` (comma-separated aliases, e.g. `DA_ItemLoot_Teddy_01, DA_ItemLoot_Teddy_02`).
Items in the saves that are missing from the old DB are `DA_Cartridge_Last_Bastions`, `DA_Cartridge_Mod_Manifest_Chant`,
`DA_Memory_LifeJacket`, `DA_Memory_Shoes` (and `DA_Seed_Coffee`, not a memory). Add the four memories with empty stats, flagged "unverified",
so the user can edit them. Report unmapped `DA_Memory_*/DA_Food_*/DA_Cartridge_*` names in the import result.

### Game rules (from the old site's bundle and the wiki)
- Attributes. Memory: Logic, Focus, Discipline, Creativity, Communication, Empathy, Leadership, Wisdom, Patience, Adaptability.
  Food: Strength, Height, Weight, Intellect, Life_Expectancy.
- Totals = sum of item stat × quantity. Effective value = `raw <= 200 ? raw : 200 + (raw-200)^0.6`
  (soft cap 200, power 0.6, min 0; editable in settings).
- Requirement compare types: `Greater` (eff > req, the default), `GreaterOrEqual`, `Less` (<=), `Equal` (|d| <= 0.5).
- Baselines are always required: Weight 20, Height 30, Life_Expectancy 10. The old site shows requirement = raw + baseline on cards,
  but its solver uses max(req, baseline). **Use req + baseline** (matches the old site's display) and keep it switchable in settings until verified in game.
- Pod capacity: total `item_weight × qty` <= 100 kg.
- The pod picks randomly among all matched professions, favouring higher tiers, so warn when a recipe also matches other professions.
- Food rows carry nutrient crafting costs: Protein, Fat, Carbohydrate, Calcium, VitaminD, Omega3, Bioregulator, Nanite_Nutrient, Mitochondrial_Amplifier.
- Data source: `data/source/{Memory,Food,HumanType}.json`, a dump of the old site's public API (58 memories, 13 foods, 40 professions).

## Architecture

- **Node 22 + Express** server; **`node:sqlite`** (built in, no native build) database at `data/caretaker.db`, seeded from `data/source`.
- **React + Vite** frontend, served by Express in production (`npm start`), with the Vite dev server in development.
- Units:
  - `server/save/chunks.js`: chunk decode (zlib/Kraken)
  - `server/save/gvas.js`: GVAS property reader
  - `server/save/items.js`: owned-item extraction
  - `server/db.js`: schema, seed, queries
  - `shared/rules.js`: effective value, requirement check (shared with the client)
  - `shared/solver.js`: recipe solver
  - `client/`: UI
- **Save import:** `POST /api/import/latest` reads the newest `%LOCALAPPDATA%/Voyage/Saved/SaveGames/<steamid>/*.sav`;
  `POST /api/import/upload` takes a dropped file. Both return counts, the list of unmapped items, and the source file and timestamp.
- **DB tables:** `memories`, `foods`, `professions`, `inventory(item_kind, item_id, qty)`, `grown(id, profession_id, items_json, created_at)`, `settings(key, value)`.
- **Solver:** (implemented with HiGHS/WASM instead: `javascript-lp-solver` timed out on these models) integer program that minimizes item count (then weight), subject to per-attribute raw >= inverse-DR(required) (+epsilon for strict),
  the weight cap, and qty <= inventory. A "craft" mode lets food quantities exceed inventory: the excess becomes the craft list, summed into nutrient totals.
  Missing memory requirements are reported as "find these" with suggested memories.

## UI
- **Planner (home):** inventory panel (search, item tiles with +/- quantities, memories and foods tabs) and live attribute totals.
  Profession grid filtered by tier and category; each card shows a status (growable / close / far) with per-attribute bars.
- **Profession detail:** requirements; the best recipe from inventory; a "need to craft" list (foods × qty, total nutrients); memories still missing;
  other-profession match warnings; a **Grow** button that subtracts the items and logs the human.
- **Import:** a "Load latest save" button plus drag and drop; the result summary lists unmapped items.
- **Data editor:** editable tables for memories, foods and professions (to fix beta stat changes), plus DR and baseline settings.
- **Grown log.**
- Dark theme, responsive.

## Testing
- Unit tests (`node --test`):
  - chunk decode on both fixtures (`test/fixtures/prebeta.sav` = zlib, `beta-update6.sav` = Kraken) yields GVAS
  - item extraction yields non-zero counts for known items
  - effective-value and inverse functions
  - requirement compare types
  - solver satisfies requirements and the weight cap
- Manual browser check of import → plan → grow.
