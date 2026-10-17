# AGENTS.md — Caretaker Planner

Instructions for anyone — human or coding agent — changing this repository. Read this file first.

A planner for **The Last Caretaker** that runs entirely in the browser and is published to GitHub Pages:
it imports a save, shows which humans you can grow, plans recipes and tracks the ten committees.
There is no server. The README says what it does for players; this file says how to change it.

**Saves.** Fixtures come from the developer's own saves on their gaming PC. How to fetch them is kept
out of the repository (a local skill under `.claude/skills/`, gitignored).

## Hard rules

These are not style preferences. Breaking one is a defect.

1. **Saves never enter the repository.** `test/fixtures/*.sav` is gitignored; a save carries the
   player's Steam id. No Steam ids, Windows user names or save paths in code, docs or commit messages.
2. **A behaviour change ships with a test that fails without it**: a browser journey in `e2e/` for
   anything a player can see, a Node test in `test/` for the save parser, solver and rules.
3. **Nothing is fetched from the internet at runtime.** Game data ships in `data/source/`; the solver
   (HiGHS) and the Oodle decompressor are bundled WASM.
4. **Direct dependencies are pinned exactly** in `package.json`, and a new version is at least three days
   old (the 72-hour rule). Justify every new dependency: all of it ships to every visitor.
5. **`ooz-wasm` is GPL-3.0**, so the project is `GPL-3.0-or-later`. Don't add code under an incompatible licence.

## Setup and commands

Node 22+. Once per clone:

```bash
npm ci
```

```bash
npx playwright install --only-shell chromium
```

```bash
git config core.hooksPath .githooks
```

| Task | Command |
| --- | --- |
| Dev server (http://127.0.0.1:5173/caretaker-planner/) | `npm run dev` |
| Node tests (parser, solver, rules, committees, in-browser API) | `npm test` |
| Build into `dist/` | `npm run build` |
| Browser journeys against the build | `npm run test:e2e` |
| Everything, before a push | `npm run check` |
| Built site locally | `npm run build && npm run preview` |

The pre-commit hook runs `npm test`. GitHub Actions runs the tests, the build and the journeys on every
push to `main`, then deploys to Pages. Without the save fixtures the save tests and save journeys skip;
copy your own saves into `test/fixtures/` (see the table at the top of `test/save.test.js`). In the desktop app, `.claude/launch.json` starts the dev server
(`caretaker-planner`) or the built site (`caretaker-planner-preview`).

## Layout

| Path | What it is |
| --- | --- |
| `shared/save/chunks.js` | UE compressed chunks → GVAS (zlib pre-beta, Oodle Kraken in the beta via `ooz-wasm`) |
| `shared/save/gvas.js` | GVAS property reader (UE 5.4+ complete type names, nested `ByteData` blobs) |
| `shared/save/items.js` | owned items, grown humans, committee states and quests from a parsed save |
| `shared/importer.js` | maps game asset names to data rows |
| `shared/rules.js` | attributes, effective value (soft cap), requirement checks |
| `shared/solver.js`, `shared/milp.js` | recipe solver: a mixed-integer program per profession, HiGHS (WASM) |
| `shared/committees.js` | committee rosters, recommended order, progress and advice from a save |
| `shared/council.js` | plans every remaining human in one program, sharing owned memories and food |
| `client/local/server.js` | the in-browser API: the routes the pages call through `client/api.js` |
| `client/local/store.js` | browser storage (one JSON document in `localStorage`) |
| `client/local/worker.js`, `compute.js` | Web Workers: a long-lived solver, a throwaway worker per save |
| `client/local/folder.js` | save-folder access (File System Access API, handle kept in IndexedDB) |
| `client/pages/` | one component per route: Planner, Committees, Import, Data, Grown, Profession |
| `data/source/` | the old community site's data: 58 memories, 13 foods, 40 professions |
| `docs/research/` | the human plan: who to grow and the cheapest recipes, with its own PuLP planner |
| `e2e/` | Playwright journeys; `e2e/fixtures.js` fails a journey on any page error |
| `test/` | Node tests (`node --test`) |

## Testing

- Journeys are named for what the player sees (`importing the save marks Habitat Care launched …`).
  Arrange through the UI or a real save fixture; never write to `localStorage` directly.
- In the browser, locate by role and accessible name, and wait with `expect`. Never `waitForTimeout`.
  Every control needs an accessible name; a hidden file input gets an `aria-label`.
- An uncaught error or `console.error` fails the journey even when its assertions pass.
- Save tests pin counts from specific snapshots. Replacing a fixture means updating those numbers in the
  same change, along with the snapshot table in `test/save.test.js`.

## Code conventions

- Plain JavaScript (ES modules), React 18, Vite. No TypeScript.
- Logic that can run outside React goes in `shared/` and gets a Node test; pages stay thin.
- Pages talk to the in-browser API (`api.get('/api/…')`), never to the store directly.
- Every module opens with a comment saying what it is for. Comments explain *why*, including the
  failure that made the code this way. Match the density of the file you are in.
- User-visible text is plain English in short sentences, and says what the player should do.
- Facts about the game (rosters, ages, quest names, save codes) carry where they came from: the research
  report or the save. When the game changes, the save is the authority.

## Git and commits

- `main` deploys. Work on a short-lived branch and merge it back.
- Commit subjects describe the behaviour in a plain sentence, the way the log already does:
  *"Plan against nutrient stock from the save"*.
- One logical change per commit. No AI attribution, co-author trailers or generator notices anywhere.

## Pitfalls

**The File System Access API exists only in Chromium browsers**, and Chromium may refuse
`%LOCALAPPDATA%` as a system folder. Keep drag and drop working for everyone else.

**Permission prompts need a user click.** `requestPermission()` and `showDirectoryPicker()` must run
from one; the import routes do async IndexedDB work first and rely on Chrome's activation window.

**A beta save is 175 MB decompressed.** Extraction runs in a throwaway worker that is terminated
afterwards; don't move it onto the main thread or into the long-lived solver worker.

**A hash link is a route.** The app routes on `location.hash`, so an in-page anchor (`href="#section"`)
navigates to the planner. Scroll with `scrollIntoView` instead.

**`CommitteeData` "Active" does not mean formed.** In the developer's save it turned Active when the
Council of Humanity quest finished, days before any member was launched. The planner counts a committee
as done when all four members are delivered.

**Storage boxes carry a module component that mirrors their items**, and the player has an unnamed
inventory holding one of every known item. Only components with `bAllowNearbyQueries` count, and the
player's only when named.
