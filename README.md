# Caretaker Planner

A planner for **The Last Caretaker** that replaces thelastcaretaker-tools.com/Calculator. It runs entirely in your
browser (no server, nothing uploaded) and reads the **Update 6 "The Jump" public beta** saves (Oodle-compressed,
build 653173) as well as older zlib saves.

**Open it:** https://lotarcc.github.io/caretaker-planner/ (Chrome or Edge for the save-folder feature).

- **Import your save.** Choose the save folder once (`%LOCALAPPDATA%\Voyage\Saved\SaveGames`) and the newest
  `.sav` loads whenever you open the planner, or drop a `.sav` file on the Import page in any browser. It counts
  memories, foods and nutrient materials in your inventory, storage boxes and containers. Loose world loot is left out.
- **See which humans you can grow.** Every profession is marked *Growable*, *Close* or *Far* from what you own.
- **Click a human:**
  - If you can grow it now, you get the cheapest recipe from your inventory. **Grow** removes those items and logs the human.
  - If you can't, you get **what you need**: the foods to craft (with nutrient totals compared to your stock), the memories still
    to find, and the items from your inventory that the recipe uses.
- **Committees.** The ten Council of Humanity committees in a recommended order, with each member's live status.
  From your save it marks which members are already in orbit, which committee to do next, and advice such as
  launching the Forbidden Fruit pears on their own. **Plan them all** plans every human still to make (plus one for
  Platform Omega) in one go, sharing your memories and foods where they save the most, and totals the foods to craft,
  the memories to find and the nutrients to gather.
- **Pod builder** like the old calculator: add items, see live totals, the weight limit and which professions match.
- **Data editor** for memories, foods and professions (to fix beta stat changes), plus rule settings (diminishing returns,
  baselines, pod capacity) and **backup export/import**: your data lives in this browser only.
- **Grown log**, plus the grown humans recorded in your save (professions, mutations and final attributes).

## Develop

Needs Node.js 22+.

```bash
npm ci
npm run dev       # http://127.0.0.1:5173/caretaker-planner/
npm test          # Node tests
npm run check     # Node tests, build, browser journeys (Playwright)
```

The save tests and journeys need fixtures that aren't published (`test/fixtures/prebeta.sav` and
`test/fixtures/beta-update6.sav`, gitignored). Without them, those tests are skipped. `AGENTS.md` has the
conventions and layout; pushing to `main` tests, builds and deploys to GitHub Pages.

## How it works

```
shared/save/chunks.js   UE compressed chunks -> GVAS (zlib pre-beta, Oodle Kraken in the beta via ooz-wasm)
shared/save/gvas.js     GVAS property reader (UE 5.4+ "complete type name" tags, nested ByteData blobs)
shared/save/items.js    owned items, grown humans, committee states and quests from the parsed save
shared/importer.js      maps game asset names to data rows
shared/rules.js         attributes, effective value (soft cap), requirement checks
shared/solver.js        recipe solver (mixed-integer program), shared/milp.js: HiGHS (WASM) adapter
shared/committees.js    committee rosters, recommended order, progress from a save
shared/council.js       every remaining human planned together (shared memory and food pool)
client/local/           the in-browser API, browser storage, Web Workers, save-folder access
client/pages/           React pages
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
- **Plan (what you need):** also allows *crafting* foods and *finding* memories. Crafting is charged per item plus the time
  to gather the nutrients it uses (seaweed 1, slime and crawlers 3, Bio Flesh 15; editable under Data → Settings).
  Everything can be gathered again, so nutrients in stock and foods you own are valued at that same cost: the plan
  minimises total gathering across all your humans instead of spending stocked Bio Flesh on a Tier 1 human.
  Finding a memory is expensive, with a penalty for stats nobody asked for.
- Items with identical stats (for example the many cartridges) are treated as interchangeable.
- Same-or-higher-tier matches are excluded with lazily added big-M constraints.

The spec named `javascript-lp-solver`, but its branch-and-bound timed out on these models (returning poor or fractional plans),
while HiGHS solves them optimally in milliseconds.

### Data

`data/source/{Memory,Food,HumanType}.json` is a dump of the old site's API: 58 memories, 13 foods and 40 professions.
Four memories found in beta saves are added with empty stats and flagged **unverified**: *Last Bastions*, *Manifest Chant*,
*Life Jacket* and *Shoes*. Fill them in under **Data**. The import lists any memory or food in a save that is still unknown.

## Licence

GPL-3.0-or-later, because the bundled Oodle decompressor (`ooz-wasm`) is GPL-3.0.
