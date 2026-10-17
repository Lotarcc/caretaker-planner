# Handover: Caretaker Planner on GitHub Pages

Written 2026-10-17 by a cloud session for the next (local) session. Branch: `feature/affectionate-bardeen-w3it6s`.

## What the user wants

1. **The planner runs on the web from their GitHub**: GitHub Pages, no local server.
2. **It still opens the game save folder automatically** (`%LOCALAPPDATA%\Voyage\Saved\SaveGames\<steamid>\`).
3. **A recommended committee order** that fits game progression (details below).
4. **The repo can go public**, provided nothing private is in it. The save files stay out of the repo.
5. Background: the research into which humans to make and their cheapest recipes is done. See `docs/research/2026-10-17-human-plan.md`.

## Where things stand

This branch merged `feature/admiring-albattani-snrue4`, the full app another session built on Oct 11: Express + SQLite server, a proper GVAS save parser that counts owned items only, a HiGHS solver, and a React UI. The user approved building on it. Since then:

| Done | Where |
|---|---|
| Express server and `node:sqlite` removed (`server/`, `scripts/dev.js`, `express` dep) | |
| Save parser moved to `shared/save/` and made browser-safe: `import { Buffer } from 'buffer'` (Node built-in in Node, npm polyfill in the browser) and `fflate` `unzlibSync` instead of `node:zlib` | `shared/save/chunks.js` |
| Pure inventory mapping split out of the old importer | `shared/importer.js` |
| Browser store: same API as the old SQLite `Store`, one JSON doc in `localStorage`, injectable storage | `client/local/store.js` |
| In-browser API with the **same routes** as the old Express server, so pages keep calling `api.get('/api/…')`. Adds `/api/import/folder`, `/api/import/auto` and `/api/backup` | `client/local/server.js` |
| Web Workers: the solver worker stays alive; each save extraction gets its own worker, terminated afterwards (a beta save is 175 MB decompressed) | `client/local/worker.js`, `client/local/compute.js` |
| Save folder access (File System Access API): pick once, handle stored in IndexedDB, newest `.sav` in the folder or one level down | `client/local/folder.js` |
| `client/api.js` routes to the local API instead of `fetch` | |
| HiGHS loader reads `globalThis.HIGHS_LOADER_OPTIONS`; the worker sets `locateFile` to the bundled `highs.wasm` | `shared/milp.js` |
| Vite: `base` from `BASE_PATH` (default `/caretaker-planner/`), `target: es2022` (top-level await), ES workers | `vite.config.js` |
| Pages deploy workflow: Node tests, build, browser journeys, deploy (save tests skip without fixtures) | `.github/workflows/pages.yml` |
| Tests (now 29 Node tests + 4 journeys) pass. `test/api.test.js` now drives the in-browser API in Node, with in-memory storage and compute called directly | `npm test` |
| `npm run build` succeeds | |

**Not verified yet:** nothing has run in a real browser. The build warns that `node:module`/`module` are "externalized" in `highs` and `ooz-wasm`. Those should be Node-only branches, but confirm at runtime.

## To do, in order

### 1. Check whether Chrome can open the save folder at all

This is the biggest risk. As far as I remember, Chromium's File System Access blocklist includes `DIR_LOCAL_APP_DATA` (`%LOCALAPPDATA%`) with "block all children" on Windows. If so, `showDirectoryPicker()` on `…\AppData\Local\Voyage\Saved\SaveGames` shows "can't open this folder because it contains system files", and the remembered-folder plan fails. I couldn't confirm this from the web; test it on Windows:

1. `npm run dev`, open the app in Chrome or Edge, run `await showDirectoryPicker()` in the devtools console, and paste `%LOCALAPPDATA%\Voyage\Saved\SaveGames` into the dialog's address bar.
2. If it's blocked, try in order and keep the first that works:
   - **A directory junction** from an allowed place:
     `mklink /J "%USERPROFILE%\Documents\CaretakerSaves" "%LOCALAPPDATA%\Voyage\Saved\SaveGames"`, then pick `Documents\CaretakerSaves`.
     Chrome may resolve junctions before checking the blocklist; test it. If it works, the Import page should show this one-time command with a copy button.
   - **`<input type="file" webkitdirectory>`.** It isn't governed by the File System Access blocklist, and Windows remembers the last folder, but it asks every time ("Upload N files to this site?"), so it's not automatic.
   - **A plain file input or drag and drop.** Already supported.
3. Whatever works, update the Import page copy and the README. Tell the user honestly how automatic it is. Ideally: pick once, choose "Allow on every visit" (Chrome 122+), and from then on the newest save loads on page open via `POST /api/import/auto`.

### 2. Finish the UI for the browser version

- **Done (2026-10-17):** `client/App.jsx` auto-imports after the first load, shows a generic start-up error, and ignores cancelled pickers. `client/pages/Import.jsx` has a new saves panel:
  - Choose / Change / Forget folder;
  - "Allow and load latest" when the permission is `prompt`;
  - a blocked-access notice and an unsupported-browser notice;
  - the path hint, and the junction tip with a Copy button. The tip is worded conditionally until step 1 is tested on Windows.

  Checked in the built preview: both saves import by drag and drop, and the overview and solver work under `/caretaker-planner/`. The real folder picker, the permission prompts and auto-import still need a check in Chrome on Windows (step 1).
- **Done (2026-10-17):** Settings has no `saveDir` field any more, and has **Export backup** / **Import backup**
  (journey: `e2e/backup.spec.js`). The README describes the static app.

### 3. Committees page

**Done (2026-10-17):** `#/committees`, data in `shared/committees.js`, sources in `docs/research/2026-10-17-committees.md`. The order below was revised after that research: quest-giving committees first, then the age-21/22 ones. The save parser now reads `CommitteeData` and `Quests`; a committee counts as launched when all four members are delivered. Journeys in `e2e/committees.spec.js`. The original brief follows.

Add a page (`#/committees`, nav item "Committees") showing the 10 committees in the recommended order below. Each member links to `#/p/<id>` with its live status from the overview (Growable / Close / Far). Also show a per-committee "ready" count (members growable now). Use `COMMITTEES` from the research script, or move it into `shared/`.

| # | Committee | Members | Why here |
|---|---|---|---|
| 1 | Habitat Care | Room Supervisor, Health Assistant, Teacher, Lab Technician | Tier 1, age 18. It's the committee that sends quests (Forbidden Fruit pears, True Choices). The user already has a Room Supervisor |
| 2 | Deck Operations | Maintenance Engineer, Basic Supplier, Nutrient Handler, Door Jammer | Tier 1, the cheapest committee (plan cost 684) |
| 3 | Transit & Distribution | Systems Engineer, Distributor, Growth Specialist, Guard | Tier 1, cheap (992) |
| 4 | Culture & Memory | Visual Technician, Sculptor, Cultural Archivist, Manual Holder | Tier 2 but cheap (1030) and almost no Bio Flesh |
| 5 | Power & Security | Energy Engineer, Resource Director, Station Quartermaster, Station Protector | Tier 1 committee with Tier 3 members (1308) |
| 6 | Cognitive Resilience | Theoretical Scientist, Neuro Specialist, Professor, Star Analyzer | Tier 2, no Bio Flesh foods at all (1541) |
| 7 | Field Continuance | Field Research Scientist, Existential Chancellor, Station Roamer, Doctor | Tier 3. Minimum age may be 22, so launch these early |
| 8 | Governance & Logistics | Settlement Governor, Logistics High Command, Biosphere Director, Guardian of Humanity | Tier 2, but the biggest Bio Flesh sink (18 advanced foods) |
| 9 | Deep Systems | Quantum Engineer, Quantum Physicist, Neural Architect, Sustenance Architect | Tier 3, expensive (2648) |
| 10 | Meaning & Frontier | Existential Expressionist, Frontier Explorer, Mission Seeker, Colonel of Humanity | Tier 3, minimum age 21, most expensive (2847). Grow and launch members as soon as affordable, because aging runs in real time |

Show these notes on the page:

- Members must reach the minimum age in orbit before a committee forms. Players report 1–2 real days for 18, and much longer for 21–22.
- Don't put a committee in the same launch as the Forbidden Fruit pears: one player found it didn't form that way.
- No public source lists committee rewards, so the order rests on tier, age, cost and quest hooks.

Costs come from `docs/research/human-plan-result.json` (weighted nutrient cost, all food crafted). Don't hard-code costs in the app; show the live overview status instead.

### 4. Decide the default baseline rule

`shared/rules.js` defaults to `baselineMode: 'add'` (requirement + baseline, the old site's display). The research found the community calculator uses **max(requirement, baseline)**, and its tested recipes support that (see section 3 of the research report). Suggest switching the default to `'max'` and confirm with the user. `test/rules.test.js` may assert the old default.

### 5. Test in a browser

**Done (2026-10-17):** Playwright journeys run against the built site under the Pages base path (`npm run test:e2e`), including a real beta-save import. Still open: the folder picker on Windows (step 1).

Original notes: Run `npm run build && npm run preview`, then:

- drop `test/fixtures/beta-update6.sav` on the Import page and check the import summary (the beta save has more than 100 memories);
- open a profession and solve it;
- check that the solver worker loads `highs.wasm` under the `/caretaker-planner/` base path.

Also test the prebeta (zlib) fixture.

### 6. Make the repo public

Done: the save files and personal data were removed from the history. Switching the repo to Public and enabling Pages (Settings, then Pages, then Source: GitHub Actions) is up to the user.

### 7. Ship

Merge to `main` (the Pages workflow deploys from `main`), check the Actions run, and open the site at `https://lotarcc.github.io/caretaker-planner/`.

## Gotchas

- **The File System Access API exists only in Chromium browsers** (Chrome, Edge, Opera). Keep drag and drop for everyone else.
- **Permission prompts need a user click.** `requestPermission()` and `showDirectoryPicker()` must run from one. The router's `import/latest` and `import/file` do async IndexedDB work first; Chrome's activation window (~5 s) normally covers it, but keep that in mind.
- **Save extraction needs a lot of memory**: a 175 MB buffer plus the parsed tree. That's why it runs in a throwaway worker.
- **`ooz-wasm` is GPL-3.0**, so publishing the site means distributing it. `package.json` now says `GPL-3.0-or-later`; tell the user.
- **The research planner** (`docs/research/human_plan.py`, PuLP/CBC) is separate from the app's solver (`shared/solver.js`, HiGHS). Its rules match the research: strict "Greater", max baselines, other categories excluded. The app's solver excludes only same-or-higher-tier matches. Consider aligning them.

## Useful facts from the research

- **41 humans are needed:** 40 committee seats, one of each profession, plus 1 for Platform Omega. For Omega, any grown human works; a Maintenance Engineer is the cheapest.
- **The user's beta save as of Oct 11:** one Room Supervisor grown. Plenty of memories for all 41 humans. Short on nutrients:
  - basic (seaweed): ~2100 Protein, ~900 Fat, ~1000 Carbohydrate;
  - advanced (Bio Flesh): 65 Mitochondrial Amplifier, 7 Nanite Nutrient. The user holds only 5 Bio Flesh.
- **Rosters, soft-cap table and recipes:** `docs/research/2026-10-17-human-plan.md`.
