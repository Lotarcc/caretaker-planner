// Committees of the Council of Humanity: rosters, the recommended order, their quests, and progress read from an
// imported save. Sources: docs/research/2026-10-17-committees.md (rosters, ages, quests, how forming works) and
// the developer's own save (the HAB_CARE code, quest asset names).
import { aliases } from './rules.js';

/**
 * In the recommended order: Habitat Care because the story requires it, then the two other committees that give
 * quests, then the two with higher minimum ages so their real-time aging starts early, then the rest by cost.
 * `tier` is the committee's own tier (shown on its seats in game), not its members' profession tiers.
 * `saveKey` is the game's code in the save's CommitteeData, where known. `quests[].asset` is the DA_Quest_* name
 * where a save has shown it.
 */
export const COMMITTEES = [
  {
    id: 'habitat-care', name: 'Habitat Care', tier: 1, minAge: 18, saveKey: 'HAB_CARE',
    members: ['Room Supervisor', 'Health Assistant', 'Teacher', 'Lab Technician'],
    why: 'The story requires it first, and it gives three quests.',
    quests: [
      { name: 'Seats of Care', asset: 'DA_Quest_CU3_HabitatCommittee', gives: 'Forms the committee and leads to True Choices' },
      { name: 'True Choices', asset: 'DA_Quest_CU3_TrueChoices_Main', gives: 'Grow and launch the Star Child, or recycle the Gold Standard' },
      { name: 'The Forbidden Fruit', asset: 'DA_Quest_CU5_TheForbiddenFruit', gives: 'Launch pears for Elysium Birch seeds (repeatable)' },
    ],
  },
  {
    id: 'culture-memory', name: 'Culture & Memory', tier: 2, minAge: 18,
    members: ['Visual Technician', 'Sculptor', 'Cultural Archivist', 'Manual Holder'],
    why: 'Gives a quest, is cheap, and needs almost no Bio Flesh.',
    quests: [{ name: 'Before the Archives', asset: null, gives: 'Scan cave paintings and statues, launch the samples for cherry seeds' }],
  },
  {
    id: 'cognitive-resilience', name: 'Cognitive Resilience', tier: 2, minAge: 18,
    members: ['Theoretical Scientist', 'Neuro Specialist', 'Professor', 'Star Analyzer'],
    why: 'Gives a quest and needs no Bio Flesh foods at all.',
    quests: [{ name: 'Echoes for Orbit', asset: null, gives: 'Photodrone HoloMemories, launch the samples for restoration seeds (repeatable)' }],
  },
  {
    id: 'field-continuance', name: 'Field Continuance', tier: 3, minAge: 22,
    members: ['Field Research Scientist', 'Existential Chancellor', 'Station Roamer', 'Doctor'],
    why: 'Minimum age 22, the highest. Three members are cheap, so launch them early and let them age.',
    quests: [],
  },
  {
    id: 'meaning-frontier', name: 'Meaning & Frontier', tier: 3, minAge: 21,
    members: ['Existential Expressionist', 'Frontier Explorer', 'Mission Seeker', 'Colonel of Humanity'],
    why: 'Minimum age 21 and the most expensive. Launch each member as soon as you can afford it.',
    quests: [],
  },
  {
    id: 'deck-operations', name: 'Deck Operations', tier: 1, minAge: 18,
    members: ['Maintenance Engineer', 'Basic Supplier', 'Nutrient Handler', 'Door Jammer'],
    why: 'The cheapest committee. No quests, so it can wait, but its humans make good escorts for quest launches.',
    quests: [],
  },
  {
    id: 'transit-distribution', name: 'Transit & Distribution', tier: 1, minAge: 18,
    members: ['Systems Engineer', 'Distributor', 'Growth Specialist', 'Guard'],
    why: 'Cheap, no quests.',
    quests: [],
  },
  {
    id: 'power-security', name: 'Power & Security', tier: 1, minAge: 18,
    members: ['Energy Engineer', 'Resource Director', 'Station Quartermaster', 'Station Protector'],
    why: 'No quests. A Tier 1 committee, but three of its members are Tier 3 professions.',
    quests: [],
  },
  {
    id: 'governance-logistics', name: 'Governance & Logistics', tier: 2, minAge: 18,
    members: ['Settlement Governor', 'Logistics High Command', 'Biosphere Director', 'Guardian of Humanity'],
    why: 'No quests, and the biggest Bio Flesh sink (18 advanced foods).',
    quests: [],
  },
  {
    id: 'deep-systems', name: 'Deep Systems', tier: 3, minAge: 18,
    members: ['Quantum Engineer', 'Quantum Physicist', 'Neural Architect', 'Sustenance Architect'],
    why: 'No quests, all four are Tier 4 professions, and it is expensive.',
    quests: [],
  },
];

// Each seat's profession asset, so a member is found even after its display name is edited in Data.
const SEAT_ASSET = {
  'Basic Supplier': 'DA_Profession_Basic_Supplier',
  'Biosphere Director': 'DA_Profession_Biosphere_Director',
  'Colonel of Humanity': 'DA_Profession_Colonel_of_Humanity',
  'Cultural Archivist': 'DA_Profession_Cultural_Archivist',
  'Distributor': 'DA_Profession_Distributor',
  'Doctor': 'DA_Profession_Doctor',
  'Door Jammer': 'DA_Profession_Door_Jammer',
  'Energy Engineer': 'DA_Profession_Energy_Engineer',
  'Existential Chancellor': 'DA_Profession_Existential_Chancellor',
  'Existential Expressionist': 'DA_Profession_Existential_Expressionist',
  'Field Research Scientist': 'DA_Profession_Field_Research_Scientist',
  'Frontier Explorer': 'DA_Profession_Frontier_Explorer',
  'Growth Specialist': 'DA_Profession_Growth_Specialist',
  'Guard': 'DA_Profession_Guard',
  'Guardian of Humanity': 'DA_Profession_GuardianofHumanity',
  'Health Assistant': 'DA_Profession_Health_Assistant',
  'Lab Technician': 'DA_Profession_Lab_Technician',
  'Logistics High Command': 'DA_Profession_Logistics_High_Command',
  'Maintenance Engineer': 'DA_Profession_Engineer_Maintenance',
  'Manual Holder': 'DA_Profession_Manual_Holder',
  'Mission Seeker': 'DA_Profession_Mission_Seeker',
  'Neural Architect': 'DA_Profession_Neural_Architect',
  'Neuro Specialist': 'DA_Profession_Neuro_Specialist',
  'Nutrient Handler': 'DA_Profession_Nutrient_Handler',
  'Professor': 'DA_Profession_Professor',
  'Quantum Engineer': 'DA_Profession_Quantum_Engineer',
  'Quantum Physicist': 'DA_Profession_Quantum_Physicist',
  'Resource Director': 'DA_Profession_Resource_Director',
  'Room Supervisor': 'DA_Profession_Room_Supervisor',
  'Sculptor': 'DA_Profession_Sculptor',
  'Settlement Governor': 'DA_Profession_Settlement_Governor',
  'Star Analyzer': 'DA_Profession_Star_Analyzer',
  'Station Protector': 'DA_Profession_Station_Protector',
  'Station Quartermaster': 'DA_Profession_Station_Quartermaster',
  'Station Roamer': 'DA_Profession_Station_Roamer',
  'Sustenance Architect': 'DA_Profession_Sustenance_Architect',
  'Systems Engineer': 'DA_Profession_Systems_Engineer',
  'Teacher': 'DA_Profession_Teacher',
  'Theoretical Scientist': 'DA_Profession_Theoretical_Scientist',
  'Visual Technician': 'DA_Profession_Visual_Technician',
};

export const COMMITTEE_NOTES = [
  'A member takes its seat once it has spent at least one real day in space and reaches the minimum age. Aging runs in real time: players report 2–3 weeks to age a few years, and 17 days to fill the whole council.',
  "Members don't have to go up together: anyone in orbit with the right profession and age is seated. When all four seats are filled, form the committee on the committee screen.",
  'Every launch that delivers quest cargo needs at least one human aboard. Keep cheap spare humans for that.',
  "Launch committee members on a different rocket from quest cargo: one player's committee didn't form when it went up with the Forbidden Fruit pears.",
  'Platform Omega (Project Jonah) takes one more grown human of any profession. A Maintenance Engineer is the cheapest.',
  'Only ten Ash Notebooks exist, and Tier 4 humans need them. Save them for those.',
  'Only Habitat Care, Culture & Memory and Cognitive Resilience give quests (as of Update 6). The other committees give nothing yet, so their order follows minimum age and cost.',
];

const QUEST = {
  jonah: 'DA_Quest_CU5_Project_Jonah',
  forbiddenFruit: 'DA_Quest_CU5_TheForbiddenFruit',
  trueChoices: 'DA_Quest_CU3_TrueChoices_Main',
};

// "ops" abbreviates "operations": same first letter, the rest in order.
function abbreviates(token, word) {
  if (token[0] !== word[0]) return false;
  let i = 1;
  for (let j = 1; j < word.length && i < token.length; j++) if (word[j] === token[i]) i++;
  return i === token.length;
}

/**
 * True when a save code ("HAB_CARE", "DECK_OPS") abbreviates the committee name word for word: one token of two or
 * more letters per word, in order. Strict on purpose: a code that fits two committees is shown as unknown instead.
 */
export function matchesSaveKey(key, name) {
  const tokens = String(key).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.length !== words.length || tokens.some((t) => t.length < 2)) return false;
  let w = 0;
  for (const t of tokens) {
    while (w < words.length && !abbreviates(t, words[w])) w++;
    if (w === words.length) return false;
    w++;
  }
  return tokens.length > 0;
}

/**
 * Joins the rosters with the professions table, the planner overview and the last imported save.
 * A member is "delivered" when a human with its profession was launched, "grown" when one is grown but not
 * launched. A committee is done when all its members are delivered: the save's CommitteeData state can't say
 * that, because HAB_CARE turned Active when the Council of Humanity quest finished, days before any launch.
 */
export function committeeProgress({ professions, overview = null, lastImport = null }) {
  const byName = new Map(professions.map((p) => [p.profession, p]));
  const byInternal = new Map(professions.flatMap((p) => aliases(p).map((a) => [a, p])));
  const seat = (name) => byInternal.get(SEAT_ASSET[name]) ?? byName.get(name);

  // Profession id -> 'delivered' | 'grown'; delivered wins when the save has both. Only the two statuses seen
  // in saves count; anything else (a failed grow, say) is ignored rather than guessed at.
  const fate = new Map();
  const waiting = [];
  let professionless = 0;
  for (const h of lastImport?.humans ?? []) {
    const profs = h.traits.map((t) => byInternal.get(t)).filter(Boolean);
    if (!profs.length) professionless++;
    if (h.status === 'Success') waiting.push(...profs.map((p) => p.profession));
    for (const p of profs) {
      if (h.status === 'Delivered') fate.set(p.id, 'delivered');
      else if (h.status === 'Success' && fate.get(p.id) !== 'delivered') fate.set(p.id, 'grown');
    }
  }

  const saveStates = lastImport?.committees ?? [];
  const questStatus = new Map((lastImport?.quests ?? []).map((q) => [q.id, q.status]));
  // A known code, or an unknown one that abbreviates exactly one committee name.
  const owner = (s) => {
    const known = COMMITTEES.find((c) => c.saveKey === s.key);
    if (known) return known.id;
    const guesses = COMMITTEES.filter((c) => !c.saveKey && matchesSaveKey(s.key, c.name));
    return guesses.length === 1 ? guesses[0].id : null;
  };
  const claimed = new Set();
  const rows = COMMITTEES.map((c, i) => {
    const save = saveStates.find((s) => owner(s) === c.id);
    if (save) claimed.add(save.key);
    const members = c.members.map((name) => {
      const p = seat(name);
      return {
        name,
        id: p?.id ?? null,
        tier: p?.tier ?? null,
        status: p ? overview?.[p.id]?.status ?? null : null,
        fate: p ? fate.get(p.id) ?? null : null,
      };
    });
    const delivered = members.filter((m) => m.fate === 'delivered').length;
    const grown = members.filter((m) => m.fate === 'grown').length;
    const ready = members.filter((m) => !m.fate && m.status === 'growable').length;
    const done = delivered === members.length;
    return {
      ...c,
      order: i + 1,
      members,
      delivered,
      grown,
      ready,
      done,
      started: delivered + grown > 0,
      saveState: save?.state ?? null,
      quests: c.quests.map((q) => ({ ...q, status: q.asset ? questStatus.get(q.asset) ?? null : null })),
    };
  });

  // Members needn't launch together, so a started committee doesn't jump the queue: follow the order.
  const next = rows.find((r) => !r.done) ?? null;
  if (next) next.next = true;

  return {
    committees: rows,
    next: next?.id ?? null,
    doneCount: rows.filter((r) => r.done).length,
    professionless,
    waiting,
    unknownSaveStates: saveStates.filter((s) => !claimed.has(s.key)),
  };
}

/**
 * The humans still to make, in committee order: every seat without a launched or grown human, plus one for
 * Platform Omega while Project Jonah isn't completed (a Maintenance Engineer, the cheapest profession).
 */
export function humansToPlan(progress, lastImport) {
  const out = progress.committees.flatMap((c) => c.members
    .filter((m) => m.id && !m.fate)
    .map((m) => ({ key: `${c.id}:${m.id}`, label: m.name, committee: c.name, professionId: m.id })));
  const jonah = (lastImport?.quests ?? []).find((q) => q.id === QUEST.jonah)?.status;
  const engineer = progress.committees.flatMap((c) => c.members).find((m) => m.name === 'Maintenance Engineer');
  if (jonah !== 'Completed' && engineer?.id) {
    out.push({ key: 'omega', label: 'Platform Omega (Maintenance Engineer)', committee: null, professionId: engineer.id });
  }
  return out;
}

/** Advice that depends on what the save says, beyond the committee order. */
export function adviceFromSave(lastImport, progress) {
  if (!lastImport) return [];
  const quest = (id) => (lastImport.quests ?? []).find((q) => q.id === id)?.status ?? null;
  const out = [];
  if (progress.waiting.length) {
    out.push(`Grown but not launched yet: ${progress.waiting.join(', ')}. Launch them so they start aging in orbit.`);
  }
  if (quest(QUEST.forbiddenFruit) === 'InProgress') {
    out.push('The Forbidden Fruit is in progress: send the pears on a rocket without committee members, with one spare human aboard (the launch needs one).');
  }
  if (quest(QUEST.trueChoices) === 'InProgress') {
    out.push('True Choices is in progress: grow and launch the Star Child, or recycle the Gold Standard.');
  }
  if (quest(QUEST.jonah) === 'InProgress') {
    out.push('Project Jonah is in progress: Platform Omega needs one extra grown human of any profession. A Maintenance Engineer is the cheapest.');
  }
  return out;
}
