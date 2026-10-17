// Plans every remaining human at once. The per-profession solver (solver.js) plans one human against the whole
// inventory, so a scarce memory goes to whichever human is planned first; here owned memories and foods are one
// pool shared by all humans, and the program puts each where it saves the most finding and gathering.
//
// One mixed-integer program, per human h and item group g (identical items grouped as in solver.js):
//   own|h|g    from inventory     Σ_h own|h|g <= owned(g)
//   craft|h|g  foods crafted      cost: crafting + gathering the nutrients
//   find|h|g   memories to find   expensive, plus a penalty for stats the human doesn't need
// with each human's requirement and pod-weight rows. Exclusivity (no same-or-higher-tier profession may also
// match) is left out of the joint program to keep it small: humans whose recipe would match one are re-solved
// alone afterwards with the per-profession solver, against what the others left.
import { solveMilp } from './milp.js';
import { ALL_ATTRS, NUTRIENTS, evaluate, matchingProfessions, requirements, round, totals, withDefaults } from './rules.js';
import {
  CRAFT_BASE_COST, FIND_BASE_COST, FIND_CAP, FIND_SPILL_COST, bounds, catalog, hasStats, nutrientValue, owned, solve,
} from './solver.js';

const weightOf = (row) => Number(row.item_weight ?? 0);

function groupItems(items, inventory) {
  const groups = new Map();
  for (const it of items) {
    const key = it.kind === 'food'
      ? `food|${it.id}`
      : `memory|${weightOf(it.row)}|${ALL_ATTRS.map((a) => Number(it.row[a] ?? 0)).join(',')}`;
    if (!groups.has(key)) groups.set(key, { id: `g${groups.size}`, kind: it.kind, row: it.row, members: [], have: 0 });
    const g = groups.get(key);
    g.members.push(it);
    g.have += owned(inventory, it.kind, it.id);
  }
  return [...groups.values()];
}

/** Inventory minus what the given recipes take from it. */
function remaining(inventory, recipes) {
  const left = { memory: { ...inventory.memory }, food: { ...inventory.food }, nutrient: { ...(inventory.nutrient ?? {}) } };
  for (const recipe of recipes) {
    for (const r of recipe) if (r.own) left[r.kind][r.id] = Math.max(0, (left[r.kind][r.id] ?? 0) - r.own);
  }
  return left;
}

/**
 * @param {object} args
 * @param {{key: string, label: string, professionId: string, committee?: string}[]} args.humans  who to plan
 * @param {object[]} args.professions
 * @param {object[]} args.memories
 * @param {object[]} args.foods
 * @param {object} args.inventory
 * @param {object} [args.settings]
 * @param {number} [args.timeout] ms for the joint program
 */
export function planCouncil({ humans, professions, memories, foods, inventory, settings, timeout = 20000 }) {
  const s = withDefaults(settings);
  const started = Date.now();
  const targets = humans
    .map((h) => ({ ...h, profession: professions.find((p) => p.id === h.professionId) }))
    .filter((t) => t.profession);
  const groups = groupItems(catalog(memories, foods).filter((it) => hasStats(it.row)), inventory);

  const variables = {};
  const constraints = {};
  const ints = {};
  const info = {};
  for (const g of groups) if (g.have > 0) constraints[`pool_${g.id}`] = { max: g.have };

  targets.forEach((t, i) => {
    const reqs = requirements(t.profession, s);
    const attrs = reqs.map((r) => r.attr);
    for (const r of reqs) {
      const [lo, hi] = bounds(r, s);
      const c = {};
      if (lo > -Infinity) c.min = lo;
      if (hi < Infinity) c.max = hi;
      constraints[`a${i}_${r.attr}`] = c;
    }
    constraints[`w${i}`] = { max: s.podCapacity };
    const add = (tier, g, cost, cap, extra = {}) => {
      if (cap <= 0) return;
      const name = `${tier}|${i}|${g.id}`;
      const v = { cost, [`w${i}`]: weightOf(g.row), [`cap_${name}`]: 1, ...extra };
      for (const a of attrs) {
        const stat = Number(g.row[a] ?? 0);
        if (stat) v[`a${i}_${a}`] = stat;
      }
      variables[name] = v;
      ints[name] = 1;
      constraints[`cap_${name}`] = { max: cap };
      info[name] = { i, tier, g };
    };
    for (const g of groups) {
      if (!reqs.some((r) => r.type !== 'Less' && Number(g.row[r.attr] ?? 0) > 0)) continue;
      const w = weightOf(g.row);
      const weightCap = w > 0 ? Math.floor(s.podCapacity / w) : 999;
      const value = g.kind === 'food' ? nutrientValue(g.row, s) : 0;
      if (g.have > 0) add('own', g, 1 + value + w / 1000, Math.min(g.have, weightCap), { [`pool_${g.id}`]: 1 });
      if (g.kind === 'food') add('craft', g, CRAFT_BASE_COST + value + w / 1000, weightCap);
      else if (g.members.some((m) => !m.row.unverified)) {
        const spill = ALL_ATTRS.filter((a) => !attrs.includes(a)).reduce((sum, a) => sum + Math.max(0, Number(g.row[a] ?? 0)), 0);
        add('find', g, FIND_BASE_COST + w + FIND_SPILL_COST * spill, Math.min(FIND_CAP, weightCap));
      }
    }
  });

  let method = 'joint';
  let recipes = null;
  if (targets.length) {
    const res = solveMilp({ optimize: 'cost', opType: 'min', constraints, variables, ints }, { timeLimitMs: timeout, gap: 0.01 });
    if (res.feasible) recipes = splitRecipes(res.values, info, targets.length, inventory);
  }

  // A recipe that misses its target (a time-limited solve can leave fractions) or would also make a
  // same-or-higher-tier profession is re-solved alone against what the other humans leave.
  if (!recipes) {
    method = 'one-by-one';
    recipes = targets.map(() => []);
  }
  targets.forEach((t, i) => {
    const r = recipes[i];
    const sum = totals(r.map((x) => ({ item: x.row, qty: x.qty })));
    const met = r.length > 0 && evaluate(t.profession, sum.raw, s, sum.weight).met;
    const risky = met && matchingProfessions(professions, sum.raw, s, sum.weight)
      .some((p) => p.id !== t.profession.id && p.tier >= t.profession.tier);
    if (met && !risky) return;
    const left = remaining(inventory, recipes.filter((_, j) => j !== i));
    const alone = solve({ profession: t.profession, professions, memories, foods, inventory: left, settings: s, mode: 'plan' });
    if (alone.feasible) {
      recipes[i] = alone.recipe.map((x) => ({ ...x, row: catalogRow(x, memories, foods) }));
    } else if (!met) {
      recipes[i] = [];
    }
  });

  const out = targets.map((t, i) => describe(t, recipes[i], professions, s));
  return { method, ms: Date.now() - started, humans: out, totals: summarize(out, recipes, inventory) };
}

function catalogRow(x, memories, foods) {
  return (x.kind === 'memory' ? memories : foods).find((r) => r.id === x.id);
}

/** MILP values -> one recipe per human; owned items are handed out member by member so no item is used twice. */
function splitRecipes(values, info, count, inventory) {
  const left = new Map();
  const avail = (k, it) => {
    if (!left.has(k)) left.set(k, owned(inventory, it.kind, it.id));
    return left.get(k);
  };
  const recipes = Array.from({ length: count }, () => new Map());
  const add = (i, it, tier, q) => {
    const k = `${it.kind}:${it.id}`;
    const m = recipes[i];
    if (!m.has(k)) m.set(k, { kind: it.kind, id: it.id, row: it.row, qty: 0, own: 0, craft: 0, find: 0 });
    const e = m.get(k);
    e[tier] += q;
    e.qty += q;
  };
  for (const [name, { i, tier, g }] of Object.entries(info)) {
    let q = Math.round(Number(values[name] ?? 0));
    if (q <= 0) continue;
    if (tier !== 'own') {
      add(i, g.members[0], tier, q);
      continue;
    }
    const members = [...g.members].sort((a, b) => owned(inventory, b.kind, b.id) - owned(inventory, a.kind, a.id));
    for (const it of members) {
      const k = `${it.kind}:${it.id}`;
      const take = Math.min(q, avail(k, it));
      if (take > 0) {
        add(i, it, 'own', take);
        left.set(k, left.get(k) - take);
        q -= take;
      }
    }
    // Rounding asked for more than the pool holds: craft the rest if it's a food, otherwise leave it short
    // (the recipe then fails its check and is re-solved alone).
    if (q > 0 && g.kind === 'food') add(i, g.members[0], 'craft', q);
  }
  return recipes.map((m) => [...m.values()]);
}

function describe(t, recipe, professions, s) {
  const sum = totals(recipe.map((x) => ({ item: x.row, qty: x.qty })));
  const evaluation = evaluate(t.profession, sum.raw, s, sum.weight);
  const matches = evaluation.met
    ? matchingProfessions(professions, sum.raw, s, sum.weight).filter((p) => p.id !== t.profession.id)
    : [];
  return {
    key: t.key,
    label: t.label,
    committee: t.committee ?? null,
    professionId: t.profession.id,
    profession: t.profession.profession,
    tier: t.profession.tier,
    feasible: evaluation.met,
    weight: sum.weight,
    recipe: recipe
      .map(({ row, ...x }) => ({ ...x, name: row.name }))
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'memory' ? -1 : 1) || b.qty - a.qty || a.name.localeCompare(b.name)),
    otherMatches: matches.map((p) => ({ id: p.id, profession: p.profession, tier: p.tier, risky: p.tier >= t.profession.tier })),
  };
}

function summarize(humans, recipes, inventory) {
  const craftNutrients = Object.fromEntries(NUTRIENTS.map((n) => [n, 0]));
  const crafted = {};
  const found = {};
  const used = {};
  recipes.flat().forEach((x) => {
    if (x.craft) {
      crafted[x.row.name] = (crafted[x.row.name] ?? 0) + x.craft;
      for (const n of NUTRIENTS) craftNutrients[n] += Number(x.row[n] ?? 0) * x.craft;
    }
    if (x.find) found[x.row.name] = (found[x.row.name] ?? 0) + x.find;
    if (x.own) used[x.row.name] = (used[x.row.name] ?? 0) + x.own;
  });
  const stock = inventory.nutrient ?? {};
  const nutrients = NUTRIENTS.filter((n) => craftNutrients[n] > 0).map((n) => ({
    nutrient: n,
    need: round(craftNutrients[n], 1),
    stock: Number(stock[n] ?? 0),
    gather: round(Math.max(0, craftNutrients[n] - Number(stock[n] ?? 0)), 1),
  }));
  const sorted = (o) => Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, qty]) => ({ name, qty }));
  return {
    planned: humans.filter((h) => h.feasible).length,
    impossible: humans.filter((h) => !h.feasible).map((h) => h.label),
    crafts: sorted(crafted),
    find: sorted(found),
    fromInventory: sorted(used),
    nutrients,
  };
}
