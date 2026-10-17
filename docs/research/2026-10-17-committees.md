# Committees: rosters, quests, forming and order

Research date 2026-10-17. Game: The Last Caretaker, Update 6 "The Jump" public beta (build 0.10.0.653173).
The planner's data lives in `shared/committees.js`; this report says where it came from.

**How reliable the sources are:**
- Rakkun's Steam guide (May 2026) is the most complete list. kosguides reposts it word for word.
- The wiki's Committees page copies the same lists but says age 18 for every committee, which other sources contradict.
- The best in-game evidence is a UE4SS dump of the quest voice-line subtitles (the1killer/LastCaretakerLogDumper,
  updated 2026-10-12).
- Everything else is player reports in Steam threads. The developers haven't answered any of them.
- Reddit and Neoseeker couldn't be read.

## The ten committees

| Committee | Members (profession tier) | Min age | Committee tier | Save code | Gives |
|---|---|---|---|---|---|
| Habitat Care | Room Supervisor 1, Health Assistant 1, Teacher 2, Lab Technician 1 | 18 | 1 | `HAB_CARE` | Seats of Care (the story requires it), then True Choices and The Forbidden Fruit |
| Deck Operations | Maintenance Engineer 1, Basic Supplier 1, Nutrient Handler 1, Door Jammer 1 | 18 | 1 | unknown | nothing |
| Transit & Distribution | Systems Engineer 2, Distributor 2, Growth Specialist 2, Guard 2 | 18 | 1 | unknown | nothing |
| Power & Security | Energy Engineer 3, Resource Director 3, Station Quartermaster 2, Station Protector 3 | 18 | 1 | unknown | nothing |
| Cognitive Resilience | Theoretical Scientist 3, Neuro Specialist 3, Professor 3, Star Analyzer 2 | 18 | 2 | unknown | Echoes for Orbit |
| Culture & Memory | Visual Technician 1, Sculptor 2, Cultural Archivist 3, Manual Holder 1 | 18 | 2 | unknown | Before the Archives |
| Governance & Logistics | Settlement Governor 3, Logistics High Command 4, Biosphere Director 3, Guardian of Humanity 4 | 18 | 2 | unknown | nothing |
| Deep Systems | Quantum Engineer 4, Quantum Physicist 4, Neural Architect 4, Sustenance Architect 4 | 18 | 3 | unknown | nothing |
| Meaning & Frontier | Existential Expressionist 4, Frontier Explorer 4, Mission Seeker 3, Colonel of Humanity 4 | 21 | 3 | unknown | nothing |
| Field Continuance | Field Research Scientist 2, Existential Chancellor 4, Station Roamer 1, Doctor 2 | 22 | 3 | unknown | nothing |

**How sure each column is:**
- **Rosters: high.** The wiki, Rakkun, NCFFCN, gizzmoshifu and another committees.json all agree. Spellings vary
  ("System Engineer", "Star Analyser", "Cognitive Resiliance"), so the planner matches seats by profession asset, not name.
- **Committee tiers: high.** The wiki and Rakkun agree. A committee's tier is not its members' profession tier: a
  Teacher's seat reads "Age 18+ / Tier 1".
- **Minimum ages: medium-high.** 21 and 22 come from Rakkun, and a separate player said "the last two are 21 and 22".
- **Save codes:** none besides `HAB_CARE` are published anywhere: not on GitHub, in NCFFCN or on the wiki. To learn
  the rest, diff a save after each committee forms.

## Quests by committee

| Committee | Quest | What it asks | Reward | Save asset |
|---|---|---|---|---|
| Habitat Care | Seats of Care | Form Habitat Care and fill its four seats | Leads to True Choices | `DA_Quest_CU3_HabitatCommittee` (subtitles `CU3_2`) |
| Habitat Care | True Choices | Find the Gold Standard at the Courier Sieve Node, then grow and launch the Star Child, or recycle it | XP and EP (one source only) | `DA_Quest_CU3_TrueChoices_Main` |
| Habitat Care | The Forbidden Fruit | Launch pears (Child of the Orchard counts) | One Elysium Birch seed per pear; repeatable | `DA_Quest_CU5_TheForbiddenFruit` |
| Cognitive Resilience | Echoes for Orbit | Photodrone a HoloMemory, launch the sample | One restoration seed each; repeatable | not seen yet (subtitles `CU5_2`) |
| Culture & Memory | Before the Archives | Scan cave paintings and statues, launch the samples | Cherry seeds | not seen yet (subtitles `CU5_3`) |
| none | Project Jonah | Put one grown human in the Jonah control socket | A whale that dives for oil | `DA_Quest_CU5_Project_Jonah` |

**Notes on these quests:**
- You pick a quest up at the committee-room terminal. It can take real time to appear: one player waited more than
  two days for Before the Archives.
- Since 5.0, True Choices can reappear under Habitat Care and can't be accepted. This is a bug.
- None of the other seven committees give a quest, as of Update 6.

## How a committee forms

- **Who gets a seat:** any human in orbit with the right profession and age. Members don't have to launch together;
  one player's committee filled itself from humans sent up long before.
- **Time in orbit:** a human needs at least one real day in space. Moving the system clock forward works, but
  setting it back loses the committee.
- **Aging is real time and slow.** About 9 days in space reached ages 19–20. Players call 2–3 weeks normal, and one
  needed 17 days to fill the whole council.
- **Forming it:** players mention a "form committee" button on the committee screen. 5.0 and 5.5 each fixed a bug
  where the quest stayed on "form Habitat Care" after the seats were full.
- **Pears:** in one careful retest (July 2026), a committee launched with pears didn't form, and formed once it was
  launched separately. Another player saw no effect. Launch members apart from quest cargo to be safe.
- **What the save's committee state means:** only `Active` has been seen. In the developer's save `HAB_CARE` turned
  Active when the Council of Humanity quest finished, days before any member was launched. The planner therefore
  counts a committee as done when all four members have been delivered.

## Other humans you need

- **Every quest-delivery launch needs a human aboard:** Forbidden Fruit, Echoes and Archives. These quests repeat, so
  they keep using humans.
- **Platform Omega (Project Jonah)** takes one grown human of any profession.
- **The True Choices grow route** needs the Star Child.
- **Four pods per launch.** Extra pods earn rewards but don't appear in the Space list.
- **Ash Notebooks**, which Tier 4 humans need, exist exactly ten times (jimbkim's solver README).

## Recommended order (used by the planner)

1. **Habitat Care.** The story requires it, and it gives three quests.
2. **Culture & Memory, then Cognitive Resilience.** They are the only other committees that give quests, and their
   seeds feed Project Eden. Both are cheap and need little or no Bio Flesh.
3. **Field Continuance (22), then Meaning & Frontier (21).** Real-time aging is the bottleneck, so start those clocks
   early. Launch Meaning & Frontier members one at a time as you can afford them: they are expensive.
4. **Deck Operations, Transit & Distribution, Power & Security, Governance & Logistics, Deep Systems.** None of them
   gives anything yet, so they go in order of cost. Deck Operations humans also make good escorts for quest launches.

## Still unknown

- The save codes of the other nine committees, and the other committee states.
- The exact aging rate, and whether it changed in 5.x or 6.
- The asset names for Echoes for Orbit and Before the Archives.
- Whether the pears caveat still applies on 6.0.
- What a committee's "Value" does.
- What `DA_Quest_CU5_Dumpster` is.

## Sources

- **Rakkun's committee guide:** https://steamcommunity.com/sharedfiles/filedetails/?id=3720214488 (repost:
  https://kosguides.com/18043-the-last-caretaker-all-committees-list/)
- **Wiki:** https://thelastcaretaker.wiki.gg/wiki/Committees
- **turvarya, "Quests from Councils":** https://steamcommunity.com/sharedfiles/filedetails/?id=3757435860
- **Subtitle dump:** https://github.com/the1killer/LastCaretakerLogDumper/blob/main/voyage_quest_subtitles_dump.json
- **NCFFCN profession tiers:** https://github.com/NCFFCN/The_Last_Caretaker_Human_Calculator/blob/main/Data/Human.csv
- **Update 6 beta notes:** https://steamcommunity.com/app/1783560/discussions/0/581684470096299946/
- **Steam threads:**
  - Seats and committee value: https://steamcommunity.com/app/1783560/discussions/0/802343027768122041/
  - Aging: https://steamcommunity.com/app/1783560/discussions/0/661611313945021851/
  - Days in space: https://steamcommunity.com/app/1783560/discussions/0/802342466057601936/
  - Seats filling from humans already in orbit: https://steamcommunity.com/app/1783560/discussions/0/802342772998865952/
  - The pears caveat: https://steamcommunity.com/app/1783560/discussions/0/581677784229788829/
  - A human on every launch: https://steamcommunity.com/app/1783560/discussions/0/581684930426213596/
  - Project Jonah: https://steamcommunity.com/app/1783560/discussions/0/572668324079616593/
  - The form-committee bug: https://steamcommunity.com/app/1783560/discussions/0/581684714276072950/
