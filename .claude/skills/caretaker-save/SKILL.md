---
name: caretaker-save
description: Copy The Last Caretaker saves from the Windows gaming PC (ssh host cka-win) into test/fixtures, inspect what a save records (inventory, grown humans, committee states, quests), and re-pin the save tests after replacing a fixture. Use when a task needs the user's live save, a fixture is missing, or the save tests fail on changed counts.
---

# The user's save

The game runs on `cka-win` (Windows, reachable as `ssh cka-win`; OpenSSH prints a post-quantum warning, ignore it).
Saves live in `%LOCALAPPDATA%\Voyage\Saved\SaveGames\<steamid>\`:

| File | What it is |
|---|---|
| `<steamid>_AutoSave_0.sav` | newest autosave, usually the one to use |
| `<steamid>_0.sav` … `_4.sav` | manual slots |
| `..\BACKUP\` | the user's own copies; older builds (pre-beta zlib saves live here) |

List them, newest first:

```bash
ssh cka-win 'powershell -NoProfile -Command "Get-ChildItem -Recurse $env:LOCALAPPDATA\Voyage\Saved\SaveGames -Filter *.sav | Sort-Object LastWriteTime -Descending | Format-Table FullName,Length,LastWriteTime -AutoSize | Out-String -Width 250"'
```

## Fixtures

`test/fixtures/*.sav` is gitignored and must stay that way: saves carry the user's Steam id and are never committed
or published. The tests pin counts from specific snapshots (comment at the top of `test/save.test.js`):

| Fixture | Source | Build | Compressor |
|---|---|---|---|
| `test/fixtures/beta-update6.sav` | `_AutoSave_0.sav`, 2026-10-17 | 653173 | oodle-kraken |
| `test/fixtures/prebeta.sav` | `_3.sav`, 2026-10-06 | 651238 | zlib |

Copy a save, using a `FullName` from the listing (forward slashes; never write the real path into the repo):

```bash
scp 'cka-win:C:/Users/<user>/AppData/Local/Voyage/Saved/SaveGames/<steamid>/<steamid>_AutoSave_0.sav' test/fixtures/beta-update6.sav
```

Replacing a fixture changes item counts, humans and committee states, so `test/save.test.js`,
`test/api.test.js` and `e2e/committees.spec.js` will fail on the old numbers. Read the new values with
`extractSave` (below), update the pinned numbers and the table above in one change, and say so in the commit.

## Reading a save

```js
import fs from 'node:fs';
import { extractSave } from './shared/save/items.js';
const r = extractSave(fs.readFileSync('test/fixtures/beta-update6.sav'));
// r.meta, r.owned, r.holders, r.humans, r.committees, r.quests
```

What the save records that the planner uses:

- `HumanGrow`: every grown human, `Type` `Delivered` (launched) or not, `Traits` with the profession asset
  (`DA_Profession_*`) and mutations. A human with no profession trait was grown off-recipe.
- `CommitteeData`: committees the game tracks, by short code (`HAB_CARE` is the only one seen so far) with an
  `EVoyageCommitteeState`. `Active` appeared when the Council of Humanity quest finished, *before* any member was
  launched, so it is not "formed"; the planner calls a committee done when all four members are delivered.
- `Quests.QuestState`: `DA_Quest_*` assets with `FVoyageQuestStatus` (`InProgress`, `Completed`). Committee
  quests use the `CU3_` prefix (`DA_Quest_CU3_HabitatCommittee`, `DA_Quest_CU3_TrueChoices_Main`).
- `Stats`: `STAT_NUM_HUMANS_GROWN`, `STAT_NUM_HUMANS_DELIVERED`, `STAT_NUM_ROCKET_LAUNCHES`.

When a new committee code shows up, the Committees page lists it under "Other committee states in the save"
unless it abbreviates the committee's name; add it as `saveKey` in `shared/committees.js`.
