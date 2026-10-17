# Human Plan: Who to Grow and the Cheapest Recipes

Research date 2026-10-17. Game: The Last Caretaker, Update 6 "The Jump" public beta.
Planner: `docs/research/human_plan.py`. Raw result: `docs/research/human-plan-result.json`.

## 1. How many humans, and where

| Where | Humans | Professions | Confidence |
|---|---|---|---|
| Space: Council of Humanity, 10 committees × 4 seats | **40** | One of each of the 40 professions; each profession sits on exactly one committee | High: the wiki, a Steam guide, kosguides and the NCFFCN calculator agree |
| Platform Omega (Project Jonah) | **1** | Any grown human, because it's lost down the ladder. Make the cheapest one, a Maintenance Engineer | High: several guides say any profession works |
| First launch ("Time to Let Go Soon") | 0 extra | The first human you launch can be one of the 40 committee humans | High |
| Star Child | special | Needs the Star Child item, not stats. Guides warn against sending it to Omega | Medium |
| Other places | none found | No Update 6 content (North Bastion, Project Crossing, Transfer Gates) needs a human, as far as public sources show | Low: the beta is new |

**Confirmed total: 41 humans.** You expect more than 60. Nothing public accounts for the other ~20.
The rocket is meant for 4 pods per launch but takes more. Extra humans earn extra capsule rewards but
don't show in the PECO "Space" list. For spares, the cheapest professions are listed in section 5.

### Committee rosters

| Committee | Members | Min age / tier (sources vary) |
|---|---|---|
| Deck Operations | Maintenance Engineer, Basic Supplier, Nutrient Handler, Door Jammer | 18 / T1 |
| Habitat Care | Room Supervisor, Health Assistant, Teacher, Lab Technician | 18 / T1 |
| Transit & Distribution | Systems Engineer, Distributor, Growth Specialist, Guard | 18 / T1 |
| Power & Security | Energy Engineer, Resource Director, Station Quartermaster, Station Protector | 18 / T1 |
| Cognitive Resilience | Theoretical Scientist, Neuro Specialist, Professor, Star Analyzer | 18 / T2 |
| Culture & Memory | Visual Technician, Sculptor, Cultural Archivist, Manual Holder | 18 / T2 |
| Governance & Logistics | Settlement Governor, Logistics High Command, Biosphere Director, Guardian of Humanity | 18 / T2 |
| Deep Systems | Quantum Engineer, Quantum Physicist, Neural Architect, Sustenance Architect | 18 / T3 |
| Meaning & Frontier | Existential Expressionist, Frontier Explorer, Mission Seeker, Colonel of Humanity | 21 / T3 |
| Field Continuance | Field Research Scientist, Existential Chancellor, Station Roamer, Doctor | 18–22 / T3 |

**Timing:** members must reach the minimum age in orbit before a committee forms. Players report 1–2 real days
for 18, and much longer for the last committees. Launch early and in batches. Don't put a committee in the
same launch as the Forbidden Fruit pears: one player found it didn't form that way.

## 2. Your save, what's already done

`test/fixtures/beta-update6.sav` (Oct 11) shows a single profession reference: **Room Supervisor**.
Every other profession is still to make. The save also has a large memory stock: 20–45 of most common memories,
11 Ash Notebooks, 9 Porcine Vocal Interfaces and 3–22 of each cartridge. It also holds 48 High-Fat, 32 Nutri-Core,
15 Physique Fuel and a few higher-tier foods (`docs/research/inventory-beta-update6.json`).
The count covers every item the save records, which may include loose loot you haven't picked up.
If your live save differs, re-scan it and rerun the planner.

## 3. Cost model and rules

- **Cost = nutrients you must craft**, weighted by how hard each is to farm:
  Protein/Fat/Carbohydrate (seaweed) **1**, Calcium/Vitamin D/Omega-3 (slime, crawlers) **3**,
  Bioregulator/Nanite Nutrient/Mitochondrial Amplifier (Bio Flesh from big enemies) **15**.
  Food you already own is free. Each memory consumed costs 1, and Ash Notebook 5, Oath Token 5, Porcine Vocal Interface 3,
  to keep rare items for where they matter. The weights are constants at the top of the script.
- **Memories are a shared, finite pool.** All 41 recipes are optimised together, so scarce memories go where they save the most.
- **Soft cap:** effective = raw up to 200, then 200 + about (raw−200)^0.6, using the community's measured table.
- **Baselines:** Weight 20, Height 30, Life Expectancy 10, applied as max(requirement, baseline), as the community calculator does.
  This replaces the "requirement + baseline" guess in the design spec. Their tested recipes support it.
- **Strict "Greater":** every target stat is at least requirement + 1.
- **No surprise professions:** each recipe misses every other category's professions and every higher tier,
  with a margin, so it holds whether the game compares with > or ≥. A recipe may still match lower tiers of the
  target's own category (unavoidable). The calculator assumes the higher tier wins those.
- **Data conflicts:** our data and the NCFFCN CSV differ on 6 values (Quantum Engineer Str 180/181, Disc 60/61;
  Teacher Patience 12/15; Existential Chancellor Weight 120/48; Logistics High Command Disc 80/82; Quantum Physicist Int 220/221).
  Recipes meet the higher value and avoid the lower one, so they work under either.
- Pod capacity 100 kg.

## 4. Results (all 41 humans)

| | |
|---|---|
| Food to craft | 318 Physique Fuel, 166 Nutri-Core, 129 Mind Surge, 38 Ultimate Genesis, 15 High-Fat, 7 Muscle Fortification, 5 Hyper-Evolution, 3 Nanite Infusion |
| Nutrients to craft | Protein 3135, Fat 1515, Carbohydrate 1338 · Vitamin D 84, Omega-3 14, Calcium 10 · **Mitochondrial Amplifier 195, Nanite Nutrient 65, Bioregulator 43** |
| Owned food used | All 48 High-Fat, 32 Nutri-Core, 15 Physique Fuel, 8 Mind Surge, 7 Immune Boost and most of the rest |
| Memories used | 513 items. Many common memories run out exactly: The Art of War, Where's Tommy, Biology Notes, Stopwatch, Mystery Box, Compass, Meditation, Assembly Instructions, Commander's Log, Small Tree, Plans, Guitar, Guitar Slinger |
| Memories still to find | none |
| Rare items | Only 2 of 11 Ash Notebooks (Neural Architect, Doctor) and 4 of 9 Porcine Vocal Interfaces. Ash Notebooks set every mental stat to 100+, which tends to trigger other professions |

Main takeaways:
- **Ultimate Genesis is the only big advanced-nutrient cost:** 38 crafts = 190 of the 195 Mitochondrial Amplifier.
  Height, Intellect and Life Expectancy above about 150 are where the Bio Flesh goes. Strength and Weight come cheap from Physique Fuel and High-Fat.
- The five most expensive humans are Colonel of Humanity, Logistics High Command, Quantum Physicist, Existential Chancellor and Guardian of Humanity (500–860 each).
  Together they cost about as much as the 20 cheapest.
- Memory is the real limit: the plan uses almost all your common memories.
  If you plan 60+ humans, keep collecting the cheap memories (books, drawings, toys, Guitar) and cartridges.
- "Pod kg" stays at or under 100 for every recipe.

\* *Nutrient cost* = weighted cost if every food in that recipe were crafted.
The plan's real spend is lower because owned food is used first.
Some recipes cost slightly more than their standalone best (for example Guardian +75 and Quantum Engineer +51): the shared optimiser gave those humans different memories because others needed the scarce ones.
The joint solve ran for 10 minutes. CBC reported "Optimal", but PuLP also reports that when it stops at the time limit, so treat it as the best plan found, not a proven minimum.

## 4b. Per-human recipes


### Deck Operations

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Maintenance Engineer | 1 | 1× High-Fat, 1× Nutri-Core, 10× Physique Fuel | 1× Lonelies, 1× Blueprints, 1× Plans | 25.8 | 107 |
| Basic Supplier | 1 | 21× Physique Fuel | 1× Where's Tommy, 2× Assembly Instructions | 44.2 | 168 |
| Nutrient Handler | 1 | 1× Ultimate Genesis, 1× Mind Surge, 22× Physique Fuel | 1× Survival Diagrams, 1× Stopwatch, 1× Music Notes, 1× Basketball | 50.6 | 294 |
| Door Jammer | 1 | 4× Nutri-Core, 10× Physique Fuel | 1× Commander's Log, 2× Crayon | 29.5 | 116 |

### Habitat Care

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Room Supervisor | 1 | 10× Nutri-Core, 2× Mind Surge | 1× The Art of War, 1× Small Human Art | 26 | 116 |
| Health Assistant | 1 | 4× High-Fat, 6× Nutri-Core, 2× Physique Fuel | 2× Teddy Bear, 1× Love Letters, 1× Small Tree | 27.3 | 142 |
| Teacher | 2 | 12× Nutri-Core, 25× Physique Fuel | 2× Biology Notes, 3× Stopwatch, 2× Plans, 1× Basketball | 80.6 | 308 |
| Lab Technician | 1 | 1× Ultimate Genesis, 2× Endura-Growth, 2× Nutri-Core, 1× Physique Fuel | 1× Poushki, 1× Programming Manual, 1× Encyclopedia | 14.3 | 197 |

### Transit & Distribution

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Systems Engineer | 2 | 1× High-Fat, 14× Physique Fuel | 1× Starshine, 3× Assembly Instructions, 1× Small Tree | 33.6 | 130 |
| Distributor | 2 | 3× Ultimate Genesis, 3× Physique Fuel | 1× Lonelies, 2× Blueprints, 1× Assembly Instructions, 1× Small Tree, 1× Plans | 16.4 | 339 |
| Growth Specialist | 2 | 1× Ultimate Genesis, 27× Physique Fuel | 2× The Art of War, 3× Mystery Box, 4× Music Notes, 1× Basketball | 65.1 | 321 |
| Guard | 2 | 25× Physique Fuel | 1× The Art of War, 1× Commander's Log, 2× Small Tree, 2× Crayon, 3× Guitar | 61.5 | 200 |

### Power & Security

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Energy Engineer | 3 | 2× Muscle Fortification, 19× Physique Fuel | 3× Where's Tommy, 4× Assembly Instructions, 2× Small Tree, 2× Plans, 2× Crayon, 4× Guitar | 60.9 | 242 |
| Resource Director | 3 | 3× Ultimate Genesis, 1× Nanite Infusion, 2× Nutri-Core, 2× Physique Fuel | 1× Where's Tommy, 11× Compass, 4× Assembly Instructions, 4× Commander's Log, 1× Guitar | 36.4 | 413 |
| Station Quartermaster | 2 | 8× Nutri-Core, 8× Mind Surge | 2× The Art of War, 2× Small Human Art, 1× Cards | 37 | 176 |
| Station Protector | 3 | 1× Immune Boost, 35× Physique Fuel | 6× Commander's Log, 3× Crayon, 10× Guitar | 98.75 | 313 |

### Cognitive Resilience

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Theoretical Scientist | 3 | 3× Ultimate Genesis, 1× Mind Surge, 1× Neuro-Boost | 1× Programming Manual, 3× Mystery Box, 5× Encyclopedia, 3× Small Tree, 1× Basketball | 25.6 | 376 |
| Neuro Specialist | 3 | 13× High-Fat, 6× Nutri-Core | 3× Biology Notes, 9× Small Human Art, 7× Stopwatch, 1× Encyclopedia, 1× Basketball | 57.1 | 288 |
| Professor | 3 | 1× High-Fat, 12× Nutri-Core, 4× Immune Boost, 24× Physique Fuel | 3× The Art of War, 1× Love Letters, 6× Biology Notes, 6× Small Tree, 1× Plans, 1× Basketball | 99.6 | 450 |
| Star Analyzer | 2 | 17× Nutri-Core, 10× Physique Fuel | 1× Poushki | 54.3 | 233 |

### Culture & Memory

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Visual Technician | 1 | 9× Nutri-Core, 4× Mind Surge | 1× Music Notes, 1× Cards | 27.5 | 133 |
| Sculptor | 2 | 7× Nutri-Core, 10× Mind Surge | 1× Porcine Vocal Interface | 35.5 | 193 |
| Cultural Archivist | 3 | 3× Nutri-Core, 22× Mind Surge | 1× Porcine Vocal Interface | 51.5 | 313 |
| Manual Holder | 1 | 9× Nutri-Core, 15× Physique Fuel | 2× Love Letters, 2× Mystery Box, 2× Camera, 1× Bowling Pin | 56.5 | 201 |

### Governance & Logistics

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Settlement Governor | 3 | 6× Nutri-Core, 14× Mind Surge | 5× The Art of War, 4× Small Human Art, 3× Cards | 52 | 236 |
| Logistics High Command | 4 | 2× Ultimate Genesis, 6× Hyper-Evolution, 3× Nanite Infusion | 13× Where's Tommy, 11× Programming Manual, 11× Compass, 2× Assembly Instructions, 13× Small Tree, 2× Plans, 1× Guitar | 81.7 | 852 |
| Biosphere Director | 3 | 4× Ultimate Genesis | 3× PECO Athletics - Triple Jump, 4× The Art of War | 12.9 | 420 |
| Guardian of Humanity | 4 | 1× Ultimate Genesis, 2× Immune Boost, 2× Muscle Fortification, 30× Physique Fuel | 2× Where's Tommy, 22× Meditation, 15× Commander's Log, 1× Guitar | 100 | 501 |

### Deep Systems

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Quantum Engineer | 4 | 2× Bone-Fortify, 1× Mitochondrial Surge, 1× Nutri-Core, 5× Muscle Fortification, 10× Physique Fuel | 9× Sudoku Book, 9× Plans, 14× Crayon, 18× Guitar | 95.5 | 494 |
| Quantum Physicist | 4 | 7× Ultimate Genesis, 3× Mind Surge | 16× Mystery Box, 11× Encyclopedia, 7× Sudoku Book, 1× Basketball | 62.6 | 774 |
| Neural Architect | 4 | 24× High-Fat, 3× Nutri-Core | 1× Ash Notebook, 1× Teddy Bear, 3× Love Letters | 58.4 | 459 |
| Sustenance Architect | 4 | 4× Ultimate Genesis, 1× Nutri-Core, 3× Mind Surge | 6× Guitar Slinger, 2× PECO Athletics - Javelin, 11× Survival Diagrams, 1× Basketball | 24.5 | 468 |

### Meaning & Frontier

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Existential Expressionist | 4 | 1× Nutri-Core, 33× Mind Surge | 1× PECO Athletics - Javelin, 2× Porcine Vocal Interface | 71.3 | 438 |
| Frontier Explorer | 4 | 39× Nutri-Core, 4× Mind Surge | 5× Keys to Imagination, 1× Travel Journal | 88.5 | 403 |
| Mission Seeker | 3 | 27× Nutri-Core, 1× Mind Surge, 4× Physique Fuel | 3× Turbulence | 64.9 | 288 |
| Colonel of Humanity | 4 | 4× Ultimate Genesis, 1× Endura-Growth, 31× Mind Surge | 13× The Art of War, 7× Teddy Bear, 12× Cards | 99.8 | 856 |

### Field Continuance

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Field Research Scientist | 2 | 2× Ultimate Genesis, 1× Endura-Growth | 1× Starshine, 2× Encyclopedia | 8.3 | 243 |
| Existential Chancellor | 4 | 10× High-Fat, 3× Ultimate Genesis, 1× Nanite Infusion, 2× Nutri-Core, 2× Physique Fuel | 13× Biology Notes, 12× Stopwatch, 4× Mystery Box, 21× Camera, 1× Bowling Pin | 83 | 593 |
| Station Roamer | 1 | 4× Nutri-Core, 10× Physique Fuel | 1× Travel Journal, 2× Crayon | 29.5 | 116 |
| Doctor | 2 | 8× High-Fat, 5× Nutri-Core, 2× Physique Fuel | 1× Ash Notebook | 31 | 205 |

### Platform Omega (Project Jonah)

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Maintenance Engineer | 1 | 1× High-Fat, 1× Nutri-Core, 10× Physique Fuel | 1× Second Reality, 1× Assembly Instructions, 1× Small Tree | 26.4 | 107 |


## 5. Spares and extra humans

Cheapest professions on their own (all food crafted, plenty of memories). Use these for Omega, extra launches and spares:

| Profession | Cost | Profession | Cost |
|---|---|---|---|
| Maintenance Engineer (T1) | 107 | Visual Technician (T1) | 133 |
| Station Roamer (T1) | 116 | Health Assistant (T1) | 142 |
| Door Jammer (T1) | 116 | Basic Supplier (T1) | 168 |
| Room Supervisor (T1) | 116 | Station Quartermaster (T2) | 176 |
| Systems Engineer (T2) | 130 | Lab Technician (T1) | 183 |

Each spare needs only 2–4 basic memories, but after the 41-human plan most of those are used up, so collect more first.
The capsule reward reportedly scales with human "quality". Cheap spares may give smaller rewards: that's the trade-off.

## 6. Open questions to check in game

1. **Baselines.** Does a Manual Holder need Height > 100 (assumed) or > 130? One cheap test grow settles it.
2. **Same-category lower tier.** Does a Guard recipe ever roll Door Jammer? The plan assumes the higher tier wins, as the community calculator does.
3. **The 6 data conflicts** in section 3. Recipes are safe under both values, but fixing the data would make some cheaper.
4. **Memories with unknown stats**, left out of the plan: Last Bastions and Manifest Chant cartridges, Life Jacket, Shoes,
   Star Child Memory, Recyclable Memory and A Future Without Him. The last appears in our data but not in your save.
5. **Where the other ~20 humans go.** If you find a new sink in game, add it to `humans` in `main()` and rerun.

## Rerun

```
pip install pulp==2.9.0
python3 docs/research/human_plan.py --json out.json            # uses docs/research/inventory-beta-update6.json
python3 docs/research/human_plan.py --no-inventory              # pure crafting cost, unlimited memories
python3 docs/research/human_plan.py --omega "Door Jammer"       # pick the Omega profession
```

## Sources

- [Committees, The Last Caretaker Wiki](https://thelastcaretaker.wiki.gg/wiki/Committees) · [Humans](https://thelastcaretaker.wiki.gg/wiki/Humans) · [Platform Omega](https://thelastcaretaker.wiki.gg/wiki/Platform_Omega) · [The Council of Humanity](https://thelastcaretaker.wiki.gg/wiki/The_Council_of_Humanity) · [Exodus Station](https://thelastcaretaker.wiki.gg/wiki/Exodus_Station) · [The Forbidden Fruit](https://thelastcaretaker.wiki.gg/wiki/The_Forbidden_Fruit) · [Food Material](https://thelastcaretaker.wiki.gg/wiki/Food_Material)
- [NCFFCN/The_Last_Caretaker_Human_Calculator](https://github.com/NCFFCN/The_Last_Caretaker_Human_Calculator): committee rosters, soft-cap table, exclusion rule, profession CSV
- [kosguides: All Committees List](https://kosguides.com/18043-the-last-caretaker-all-committees-list/) · [Steam guide: Council of Humanity](https://steamcommunity.com/sharedfiles/filedetails/?id=3720214488) · [GizzmoShifu committee recipes](https://gizzmoshifu.uk/the-last-caretaker-committee-recipes/)
- [Project Jonah walkthrough (allthings.how)](https://allthings.how/the-last-caretaker-project-jonah-mission-walkthrough/) · [Steam: Omega Facility / Project Jonah](https://steamcommunity.com/app/1783560/discussions/0/572668324079616593/)
- [Steam: Forbidden Fruit quest needs tweaking](https://steamcommunity.com/app/1783560/discussions/0/581677784229788829/) · [Steam: Orbital Representative](https://steamcommunity.com/app/1783560/discussions/0/844006106470684898/)
- [Nanite Nutrient and Mitochondrial Amplifier (allthings.how)](https://allthings.how/the-last-caretaker-nanite-nutrient-and-mitochondrial-amplifier-location/) · [How to grow humans (allthings.how)](https://allthings.how/how-to-grow-humans-in-the-last-caretakers-lazarus-complex/)
- [Exodus launch guide (whisperofthehouse)](https://www.whisperofthehouse.com/the-last-caretaker/exodus-launch-guide)

The wiki pages could not be fetched directly from this environment (network policy), so the facts above come from search-result summaries cross-checked across several sources.
