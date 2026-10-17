# Caretaker Planner

A local planner for **The Last Caretaker** that replaces thelastcaretaker-tools.com/Calculator and works with the
**Update 6 "The Jump" public beta** saves (Oodle-compressed, build 653002).

- **Import your save.** Reads the newest `.sav` from `%LOCALAPPDATA%\Voyage\Saved\SaveGames\<steamid>\`, or a dropped file.
  It counts memories, foods and nutrient materials in your inventory, storage boxes and containers. Loose world loot is left out.
- **See which humans you can grow.** Every profession is marked *Growable*, *Close* or *Far* from what you own.
- **Click a human:**
  - If you can grow it now, you get the cheapest recipe from your inventory. **Grow** removes those items and logs the human.
  - If you can't, you get **what you need**: the foods to craft (with nutrient totals compared to your stock), the memories still
    to find, and the items from your inventory that the recipe uses.
- **Pod builder** like the old calculator: add items, see live totals, the weight limit and which professions match.
- **Data editor** for memories, foods and professions (to fix beta stat changes), plus rule settings (diminishing returns,
  baselines, pod capacity).
- **Grown log**, plus the grown humans recorded in your save (professions, mutations and final attributes).

## Run it

Needs **Node.js 22.5+** (it uses the built-in `node:sqlite`).

```bash
npm install
npm run build     # build the web UI into dist/
npm start         # http://127.0.0.1:5174
```

Development (API with auto-restart + Vite dev server on http://localhost:5173):

```bash
npm run dev
```

Tests:

```bash
npm test
```

The save-file tests need fixtures that aren't published (`test/fixtures/prebeta.sav` and `test/fixtures/beta-update6.sav`, gitignored). Without them, those tests are skipped.

Environment variables (all optional): `PORT` (5174), `HOST` (127.0.0.1), `CARETAKER_DB` (`data/caretaker.db`),
`CARETAKER_SAVE_DIR` (extra save folder). The save folder can also be set in **Data → Settings**. On Linux and Steam Deck,
Proton prefixes under `~/.steam/steam/steamapps/compatdata/*` are searched automatically.

## How it works

```
server/save/chunks.js   UE compressed chunks -> GVAS (zlib pre-beta, Oodle Kraken in the beta via ooz-wasm)
server/save/gvas.js     GVAS property reader (UE 5.4+ "complete type name" tags, nested ByteData blobs)
server/save/items.js    owned items + grown humans from the parsed save
server/importer.js      maps game asset names to DB rows, finds save files
server/db.js            SQLite schema, seed from data/source, queries
server/index.js         Express API (+ serves dist/)
shared/rules.js         attributes, effective value (soft cap), requirement checks (used by server and client)
shared/solver.js        recipe solver (mixed-integer program)
shared/milp.js          HiGHS (WASM) adapter
client/                 React UI
```

### Which items count as owned

A save holds about 30k `Items` maps. Only these count:

| Actor | What it is | Counted |
|---|---|---|
| `BP_FirstPersonCharacter_New_C` | player: named inventories *Holster*, *Equipment*, *Backpack* | yes |
| `BP_Inventory_PlayerBox*` | storage boxes you built | yes |
| `BP_Inventory_Container_*`, `BP_Boat_*` | containers (buoy, boat modules, …) | yes |
| `BP_DynamicMeshActor_C`, `BP_Memory_Drawing_*`, … | loose items and pickups in the world | no (reported as excluded) |

Within those actors, only real inventory components (with `bAllowNearbyQueries`) are read. This matters because:

- storage boxes also carry a *module* component that mirrors the box's items, so reading it would double-count them;
- the player has an unnamed inventory that holds one of every known item (a catalog), which is skipped.

### Rules

- Totals are the sum of item stat × quantity. Effective value = `raw` up to 200, then `200 + (raw − 200)^0.6`.
- Compare types: `Greater` (default), `GreaterOrEqual`, `Less` (≤), `Equal` (±0.5).
- Baselines (Weight 20, Height 30, Life Expectancy 10) are always required. By default they are **added** to the requirement,
  which matches the old site's cards. Switch to *max* in Settings if the game turns out to work that way.
- Pod capacity: 100 kg.
- The pod picks randomly among matching professions, favouring higher tiers. The solver therefore tries to keep
  professions of the same or a higher tier from also matching (toggle on the profession page), and lists every other match.

### Solver

Each profession is a small mixed-integer program solved with [HiGHS](https://highs.dev) (WASM, `highs` on npm):

- **From inventory:** minimize item count (then weight) subject to every requirement, the weight cap and what you own.
- **Plan (what you need):** also allows *crafting* foods and *finding* memories. Crafting is charged per item plus the nutrients
  it uses. Nutrients already in stock are cheap; missing ones cost by scarcity (editable). Finding is expensive, with
  a penalty for stats nobody asked for. As a result it uses what you have first, crafts from the nutrients you hold, and
  suggests targeted memories rather than rare all-stat ones.
- Items with identical stats (for example the many cartridges) are treated as interchangeable.
- Same-or-higher-tier matches are excluded with lazily added big-M constraints.

The spec named `javascript-lp-solver`, but its branch-and-bound timed out on these models (returning poor or fractional plans),
while HiGHS solves them optimally in milliseconds.

### Data

`data/source/{Memory,Food,HumanType}.json` is a dump of the old site's API: 58 memories, 13 foods and 40 professions.
Four memories found in beta saves are added with empty stats and flagged **unverified**: *Last Bastions*, *Manifest Chant*,
*Life Jacket* and *Shoes*. Fill them in under **Data**. The import lists any memory or food in a save that is still unknown.

## Licence note

`ooz-wasm` (the Oodle decompressor) is GPL-3.0. Keep that in mind if you redistribute this project.
