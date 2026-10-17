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
  Food you already own is free, and nutrients in stock cost 5% of full price. Each memory consumed costs 1, and Ash Notebook 5, Oath Token 5, Porcine Vocal Interface 3,
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

## 4. Results (all 41 humans), and whether your stock covers them

The plan is optimised against the save's nutrient stock: nutrients you already hold are nearly free.
That's why it leans on your big Omega-3 surplus (88 Neuro-Boost for Intellect and Life Expectancy) instead of Mind Surge, which needs a lot of Protein.

| Nutrient | Plan needs | In stock | **To gather** |
|---|---|---|---|
| Protein | 2264 | 137 | **2127** |
| Fat | 1274 | 364 | **910** |
| Carbohydrate | 1172 | 159 | **1013** |
| Calcium | 282 | 205 | **77** |
| Vitamin D | 363 | 218 | **145** |
| Omega-3 | 898 | 886 | **12** |
| Bioregulator | 43 | 66 | enough |
| Nanite Nutrient | 71 | 64 | **7** |
| Mitochondrial Amplifier | 135 | 70 | **65** |

| | |
|---|---|
| Food to craft | 303 Physique Fuel, 144 Nutri-Core, 88 Neuro-Boost, 54 Mind Surge, 23 Ultimate Genesis, 16 High-Fat, 14 Hyper-Evolution, 8 Muscle Fortification, 3 Mitochondrial Surge, 1 Bone-Fortify |
| Owned food used | All of it |
| Memories | 461 used, **none missing**. Many common ones run out exactly (The Art of War, Where's Tommy, Biology Notes, Stopwatch, Compass, Meditation, Assembly Instructions, Cards, Commander's Log, Small Tree, Plans) |
| Rare items | 2 of 11 Ash Notebooks, 5 of 9 Porcine Vocal Interfaces |
| Raw materials in the save | Bio Seaweed 605, Bio Organic 3376, Bio Dark 714, Bio Light 194, **Bio Flesh 5** |

**Verdict:** you have enough memories, but not enough nutrients. The big gap is basic Protein/Fat/Carbohydrate (about 4,000 units, all from seaweed),
plus 65 Mitochondrial Amplifier and 7 Nanite Nutrient from Bio Flesh. You hold only 5 Bio Flesh, so hunt big enemies.
Calcium and Vitamin D gaps are small. Conversion rates from raw materials aren't reliably documented, so check one Soilforge batch in game:
one guide gives 200 g of seaweed giving 0.2 kg Protein and 0.2 kg Carbohydrate per batch.

Takeaways:
- Ultimate Genesis and Hyper-Evolution are the only real Bio Flesh costs. They cover Height, Intellect and Life Expectancy above about 150.
- The most expensive humans are Colonel of Humanity, Quantum Physicist, Logistics High Command, Existential Chancellor and Theoretical Scientist.
  Together they cost more than the 20 cheapest. If you're short, make them last.
- Pod weight stays at or under 100 kg for every recipe.

\* *Nutrient cost* = weighted cost if every food in that recipe were crafted, a rough measure of how expensive each human is.
The joint solve ran for 10 minutes. CBC reported "Optimal", but PuLP also reports that when it stops at the time limit, so treat it as the best plan found, not a proven minimum.

## 4b. Per-human recipes


### Deck Operations

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Maintenance Engineer | 1 | 7× Nutri-Core, 6× Physique Fuel | 1× Encyclopedia, 1× Plans, 1× Crayon, 1× Guitar | 30.25 | 111 |
| Basic Supplier | 1 | 21× Physique Fuel | 2× Assembly Instructions, 2× Guitar | 47.2 | 168 |
| Nutrient Handler | 1 | 1× Ultimate Genesis, 23× Physique Fuel | 2× Mystery Box, 1× Maps, 1× Crayon | 52.25 | 289 |
| Door Jammer | 1 | 4× Nutri-Core, 10× Physique Fuel | 1× Commander's Log, 1× Guitar | 31 | 116 |

### Habitat Care

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Room Supervisor | 1 | 1× Endura-Growth, 6× Nutri-Core, 2× Mind Surge, 3× Physique Fuel | 1× The Art of War, 1× Small Human Art | 26 | 137 |
| Health Assistant | 1 | 3× High-Fat, 10× Nutri-Core | 2× Tommy, 1× Love Letters, 1× Stopwatch | 30 | 144 |
| Teacher | 2 | 4× High-Fat, 2× Ultimate Genesis, 2× Hyper-Evolution, 1× Nutri-Core | 1× Poushki, 2× Biology Notes, 4× Camera | 23.3 | 441 |
| Lab Technician | 1 | 1× Endura-Growth, 8× Nutri-Core, 3× Neuro-Boost | 2× Mystery Box, 2× Encyclopedia | 29 | 249 |

### Transit & Distribution

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Systems Engineer | 2 | 1× High-Fat, 14× Physique Fuel | 1× PECO Athletics - Javelin, 2× Assembly Instructions, 1× Plans | 32.5 | 130 |
| Distributor | 2 | 3× Ultimate Genesis, 1× Nutri-Core, 2× Physique Fuel | 2× Programming Manual, 2× Commander's Log, 2× Crayon, 4× Guitar | 24.5 | 340 |
| Growth Specialist | 2 | 1× Ultimate Genesis, 1× Nutri-Core, 26× Physique Fuel | 1× The Art of War, 3× Mystery Box, 4× Music Notes, 1× Maps, 1× Basketball | 65.1 | 322 |
| Guard | 2 | 25× Physique Fuel | 1× Where's Tommy, 3× Compass, 1× Commander's Log, 2× Small Tree | 58 | 200 |

### Power & Security

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Energy Engineer | 3 | 1× High-Fat, 3× Bone-Fortify, 4× Muscle Fortification, 4× Physique Fuel | 2× Turbulence, 1× Programming Manual, 3× Assembly Instructions, 5× Small Tree | 34.9 | 365 |
| Resource Director | 3 | 3× Ultimate Genesis, 1× Hyper-Evolution, 1× Nutri-Core, 2× Physique Fuel | 2× Angerkoski, 1× Programming Manual, 3× Assembly Instructions, 6× Small Tree | 26.4 | 415 |
| Station Quartermaster | 2 | 1× Ultimate Genesis, 2× Nutri-Core, 1× Mind Surge, 2× Neuro-Boost | 2× The Art of War, 3× Cards | 17 | 232 |
| Station Protector | 3 | 37× Physique Fuel | 1× Where's Tommy, 9× Compass, 1× Meditation, 1× Commander's Log, 7× Small Tree | 96 | 296 |

### Cognitive Resilience

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Theoretical Scientist | 3 | 2× Nutri-Core, 1× Physique Fuel, 11× Neuro-Boost | 2× PECO Athletics - 100m Dash, 1× Love Letters, 4× Encyclopedia, 1× Sudoku Book | 34.6 | 554 |
| Neuro Specialist | 3 | 13× High-Fat, 6× Nutri-Core | 2× Fluctuations, 1× Porcine Vocal Interface, 4× Love Letters | 44.1 | 288 |
| Professor | 3 | 13× Nutri-Core, 5× Immune Boost, 23× Physique Fuel | 7× Biology Notes, 6× Stopwatch, 5× Camera, 1× Basketball | 97.1 | 466 |
| Star Analyzer | 2 | 17× Nutri-Core, 10× Physique Fuel | 1× Chiptropolis Cartridge | 54.3 | 233 |

### Culture & Memory

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Visual Technician | 1 | 1× Ultimate Genesis, 4× Nutri-Core | 1× Music Notes, 1× Cards | 11.5 | 141 |
| Sculptor | 2 | 1× Ultimate Genesis, 1× Endura-Growth, 1× Nutri-Core, 3× Neuro-Boost | 1× Porcine Vocal Interface | 13.5 | 291 |
| Cultural Archivist | 3 | 5× Nutri-Core, 16× Mind Surge, 3× Neuro-Boost | 1× Porcine Vocal Interface | 49.5 | 397 |
| Manual Holder | 1 | 9× Nutri-Core, 15× Physique Fuel | 2× Biology Notes, 3× Mystery Box, 2× Camera | 55.5 | 201 |

### Governance & Logistics

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Settlement Governor | 3 | 1× Ultimate Genesis, 7× Mind Surge, 2× Neuro-Boost | 4× The Art of War, 1× Survival Diagrams, 7× Cards | 31.5 | 292 |
| Logistics High Command | 4 | 1× Ultimate Genesis, 10× Hyper-Evolution, 1× Physique Fuel | 4× Meditation, 3× Assembly Instructions, 8× Commander's Log, 10× Sudoku Book, 3× Plans, 3× Crayon, 25× Guitar | 99.55 | 863 |
| Biosphere Director | 3 | 3× Ultimate Genesis, 9× Physique Fuel | 3× The Art of War, 9× Mystery Box, 6× Music Notes, 1× Maps | 44.5 | 387 |
| Guardian of Humanity | 4 | 3× Mitochondrial Surge, 29× Physique Fuel | 2× Where's Tommy, 9× Compass, 17× Meditation, 13× Commander's Log, 2× Small Tree | 99.5 | 502 |

### Deep Systems

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Quantum Engineer | 4 | 1× Mitochondrial Surge, 6× Muscle Fortification, 13× Physique Fuel | 16× Where's Tommy, 5× Programming Manual, 1× Compass, 4× Assembly Instructions, 8× Small Tree, 2× Plans | 78.4 | 464 |
| Quantum Physicist | 4 | 25× Neuro-Boost | 4× PECO Athletics - Javelin, 11× Encyclopedia, 7× Sudoku Book, 1× Basketball | 69.8 | 1200 |
| Neural Architect | 4 | 24× High-Fat, 3× Nutri-Core | 1× Ash Notebook, 1× Teddy Bear, 3× Love Letters | 58.4 | 459 |
| Sustenance Architect | 4 | 4× Ultimate Genesis, 1× Nutri-Core, 2× Neuro-Boost | 9× Starshine, 5× The Art of War, 1× Survival Diagrams | 22.2 | 525 |

### Meaning & Frontier

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Existential Expressionist | 4 | 5× Nutri-Core, 31× Mind Surge | 1× Second Reality, 2× Porcine Vocal Interface | 75.3 | 448 |
| Frontier Explorer | 4 | 23× Nutri-Core, 4× Mind Surge, 8× Physique Fuel, 4× Neuro-Boost | 2× PECO Athletics - Triple Jump, 4× Breakdown Cartridge | 79.8 | 515 |
| Mission Seeker | 3 | 27× Nutri-Core, 1× Mind Surge, 4× Physique Fuel | 3× Keys to Imagination | 64.9 | 288 |
| Colonel of Humanity | 4 | 1× Ultimate Genesis, 1× Endura-Growth, 2× Nutri-Core, 30× Neuro-Boost | 12× The Art of War, 1× Survival Diagrams, 17× Cards | 97.5 | 1596 |

### Field Continuance

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Field Research Scientist | 2 | 1× Ultimate Genesis, 1× Nutri-Core, 4× Neuro-Boost | 1× Programming Manual, 3× Mystery Box, 1× Encyclopedia | 18.5 | 306 |
| Existential Chancellor | 4 | 9× High-Fat, 2× Hyper-Evolution, 2× Nanite Infusion, 5× Nutri-Core, 2× Immune Boost, 11× Physique Fuel | 3× The Art of War, 13× Biology Notes, 16× Stopwatch, 11× Plans, 1× Basketball | 99.1 | 639 |
| Station Roamer | 1 | 4× Nutri-Core, 10× Physique Fuel | 1× PECO Athletics - Triple Jump | 28.3 | 116 |
| Doctor | 2 | 8× High-Fat, 5× Nutri-Core, 2× Physique Fuel | 1× Ash Notebook | 31 | 205 |

### Platform Omega (Project Jonah)

| Profession | T | Food | Memories | Pod kg | Nutrient cost* |
|---|---|---|---|---|---|
| Maintenance Engineer | 1 | 1× High-Fat, 2× Nutri-Core, 9× Physique Fuel | 1× Blueprints, 1× Commander's Log, 1× Crayon, 1× Guitar | 27.75 | 108 |


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
