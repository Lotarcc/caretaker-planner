// Recipe solver: a mixed-integer program over item quantities, solved with HiGHS (see milp.js).
//
// Variables (per group of interchangeable items, i.e. identical stats and weight):
//   own|*    items taken from inventory   cost ~1 per item, plus a food's nutrient value (what regathering it costs)
//   craft|*  foods crafted                cost per craft + the gathering cost of the nutrients it uses ("plan" only)
//   find|*   memories still to be found   high cost, plus a penalty for stats nobody asked for ("plan" mode only)
// Constraints: per required attribute raw >= inverse-DR(required) (+epsilon for strict), pod weight cap,
// quantity bounds. Optionally, equal-or-higher-tier professions that would also match are excluded with
// big-M binaries, added lazily only for the professions that actually match.
import { solveMilp } from './milp.js';
import {
  ALL_ATTRS, MEMORY_ATTRS, NUTRIENTS, evaluate, inverseEffective, matchingProfessions, requirements, round, totals, withDefaults,
} from './rules.js';

const EPS = 1e-3;
export const FIND_CAP = 5;
// A memory to find costs far more than crafting a food (~5-50) and much more than using an owned item (~1).
export const FIND_BASE_COST = 200;
export const FIND_SPILL_COST = 10;

function itemKey(kind, id) {
  return `${kind}:${id}`;
}

export function catalog(memories, foods) {
  return [
    ...memories.map((row) => ({ kind: 'memory', id: row.id, row })),
    ...foods.map((row) => ({ kind: 'food', id: row.id, row })),
  ];
}

export function owned(inventory, kind, id) {
  return Math.max(0, Math.floor(Number(inventory?.[kind]?.[id] ?? 0)));
}

/** Raw-total bounds [min, max] that satisfy one requirement. */
export function bounds(req, s) {
  const inv = (v) => inverseEffective(Math.max(0, v), s);
  switch (req.type) {
    case 'GreaterOrEqual': return [inv(req.required), Infinity];
    case 'Less': return [-Infinity, inv(req.required)];
    case 'Equal': return [req.required - 0.5 <= 0 ? -Infinity : inv(req.required - 0.5), inv(req.required + 0.5)];
    case 'Greater':
    default: return [inv(req.required) + EPS, Infinity];
  }
}

/** Raw total at or below which a requirement is NOT met (null if it cannot be blocked that way). */
function blockThreshold(req, s) {
  if (req.type === 'Greater') return inverseEffective(req.required, s);
  if (req.type === 'GreaterOrEqual') return inverseEffective(req.required, s) - EPS;
  return null;
}

// Per crafted item (crafting time), on top of the nutrients it consumes.
export const CRAFT_BASE_COST = 5;

// Every nutrient can be gathered again; what it costs is the time to gather it. Stock and owned food are therefore
// valued at that cost, not treated as free: all 41 humans get made eventually, so a unit spent on this human is a
// unit gathered for the next. A stock discount used to make stocked Bio Flesh look nearly free, and the planner put
// Ultimate Genesis into Tier 1 humans that seaweed foods cover.
export function nutrientValue(row, s) {
  return NUTRIENTS.reduce((sum, n) => sum + Number(row[n] ?? 0) * (s.nutrientCost[n] ?? 1), 0);
}

export function hasStats(row) {
  return ALL_ATTRS.some((a) => Number(row[a] ?? 0) !== 0);
}

/**
 * Solves for one profession.
 * @param {object} args
 * @param {object} args.profession target profession row
 * @param {object[]} args.professions all professions (for match warnings / exclusivity)
 * @param {object[]} args.memories
 * @param {object[]} args.foods
 * @param {{memory: Record<string, number>, food: Record<string, number>, nutrient?: Record<string, number>}} args.inventory
 * @param {object} [args.settings]
 * @param {'inventory'|'plan'} [args.mode] 'plan' allows crafting foods and finding memories
 * @param {boolean} [args.exclusive] avoid equal-or-higher-tier professions also matching
 * @param {number} [args.timeout] time limit in ms per MILP solve
 */
export function solve({
  profession, professions = [], memories, foods, inventory, settings, mode = 'inventory', exclusive = true, timeout = 1500,
}) {
  const s = withDefaults(settings);
  const reqs = requirements(profession, s);
  const items = catalog(memories, foods).filter((it) => hasStats(it.row));
  const attrRows = reqs.map((r) => r.attr);

  // Only items that help a "more is better" requirement are worth considering.
  const helpful = items.filter((it) =>
    reqs.some((r) => r.type !== 'Less' && Number(it.row[r.attr] ?? 0) > 0));

  const variables = {};
  const ints = {};
  const constraints = {};
  const varInfo = {};

  for (const r of reqs) {
    const [lo, hi] = bounds(r, s);
    const c = {};
    if (lo > -Infinity) c.min = lo;
    if (hi < Infinity) c.max = hi;
    constraints[`a_${r.attr}`] = c;
  }
  constraints.weight = { max: s.podCapacity };

  const addVar = (name, it, cost, cap) => {
    if (cap <= 0) return;
    const v = { cost, weight: Number(it.row.item_weight ?? 0), [`cap_${name}`]: 1 };
    for (const a of attrRows) {
      const stat = Number(it.row[a] ?? 0);
      if (stat) v[`a_${a}`] = stat;
    }
    variables[name] = v;
    ints[name] = 1;
    constraints[`cap_${name}`] = { max: cap };
    varInfo[name] = it;
  };

  // Items with identical stats and weight are interchangeable: one variable per group keeps the integer
  // program small and free of symmetric branches (e.g. the many cartridges that share the same stats).
  const groups = new Map();
  for (const it of helpful) {
    const key = it.kind === 'food'
      ? `food|${it.id}`
      : `memory|${Number(it.row.item_weight ?? 0)}|${ALL_ATTRS.map((a) => Number(it.row[a] ?? 0)).join(',')}`;
    if (!groups.has(key)) groups.set(key, { kind: it.kind, row: it.row, members: [] });
    groups.get(key).members.push(it);
  }

  const findCandidates = [];
  let groupIndex = 0;
  for (const g of groups.values()) {
    const id = `g${groupIndex++}`;
    const w = Number(g.row.item_weight ?? 0);
    const weightCap = w > 0 ? Math.floor(s.podCapacity / w) : 999;
    const have = g.members.reduce((n, it) => n + owned(inventory, it.kind, it.id), 0);
    const value = g.kind === 'food' ? nutrientValue(g.row, s) : 0;
    addVar(`own|${id}`, g, 1 + value + w / 1000, Math.min(have, weightCap));
    if (mode !== 'plan') continue;
    if (g.kind === 'food') addVar(`craft|${id}`, g, CRAFT_BASE_COST + value + w / 1000, weightCap);
    else if (g.members.some((it) => !it.row.unverified)) {
      // Prefer memories whose stats go where they are needed: spillover into other attributes makes other
      // professions match too (and "all stats" memories are rare finds).
      const spill = ALL_ATTRS.filter((a) => !attrRows.includes(a)).reduce((sum, a) => sum + Math.max(0, Number(g.row[a] ?? 0)), 0);
      findCandidates.push({ id, g, w, cost: FIND_BASE_COST + w + FIND_SPILL_COST * spill, cap: Math.min(FIND_CAP, weightCap) });
    }
  }
  // Drop memories to find that another candidate beats on every needed attribute, weight and cost.
  const needed = reqs.filter((r) => r.type !== 'Less' && MEMORY_ATTRS.includes(r.attr)).map((r) => r.attr);
  const stat = (c, a) => Number(c.g.row[a] ?? 0);
  const dominates = (d, c) => d.cost <= c.cost && d.w <= c.w && needed.every((a) => stat(d, a) >= stat(c, a));
  findCandidates.forEach((c, i) => {
    const beaten = findCandidates.some((d, j) => j !== i && dominates(d, c) && (!dominates(c, d) || j < i));
    if (!beaten) addVar(`find|${c.id}`, c.g, c.cost, c.cap);
  });

  const others = professions.filter((p) => p.id !== profession.id);
  const blocked = new Set();
  const unavoidable = [];
  const caps = {
    own: (it) => owned(inventory, it.kind, it.id),
    find: () => FIND_CAP,
    craft: () => Infinity,
  };

  // Turns a MILP result into a recipe that really satisfies the target. A solve stopped by the time limit can
  // hand back a slightly fractional solution; rounding up usually repairs it, otherwise the result is rejected.
  const accept = (res) => {
    if (!res.feasible) return null;
    for (const toInt of [Math.round, (v) => Math.ceil(v - 1e-6)]) {
      const recipe = toRecipe(res.values, varInfo, inventory, toInt);
      if (recipe.some((r) => r.own > caps.own(r) || r.find > caps.find())) continue;
      const t = totals(recipe.map((r) => ({ item: r.row, qty: r.qty })));
      if (evaluate(profession, t.raw, s, t.weight).met) return recipe;
    }
    return null;
  };

  let recipe = null;
  let status = 'infeasible';

  // Lazy exclusivity: solve, find equal/higher-tier matches, forbid them, re-solve. If forbidding makes the
  // model infeasible, the previous (non-exclusive) recipe is kept.
  const started = Date.now();
  for (let pass = 0; pass < 6; pass++) {
    if (pass > 0 && Date.now() - started > timeout * 2) {
      status = 'ok-not-exclusive';
      break;
    }
    const model = { optimize: 'cost', opType: 'min', constraints, variables, ints };
    const next = accept(solveMilp(model, { timeLimitMs: timeout }));
    if (!next) {
      if (recipe) status = 'ok-not-exclusive';
      break;
    }
    recipe = next;
    status = 'ok';
    if (!exclusive) break;

    const t = totals(recipe.map((r) => ({ item: r.row, qty: r.qty })));
    const risky = others.filter((p) =>
      p.tier >= profession.tier && !blocked.has(p.id) && evaluate(p, t.raw, s, t.weight).met);
    if (!risky.length) break;

    let added = 0;
    for (const p of risky) {
      blocked.add(p.id);
      const options = requirements(p, s)
        .map((r) => ({ r, thr: blockThreshold(r, s) }))
        .filter(({ r, thr }) => {
          if (thr === null) return false;
          const own = constraints[`a_${r.attr}`];
          return !(own && own.min !== undefined && own.min > thr); // cannot go below what our target needs
        });
      if (!options.length) { unavoidable.push(p.id); continue; }
      const anyRow = `ex_${p.id}`;
      constraints[anyRow] = { min: 1 };
      for (const { r, thr } of options) {
        const y = `y|${p.id}|${r.attr}`;
        const row = `ex_${p.id}_${r.attr}`;
        // Tight big-M: the most this attribute could reach given every variable's bound.
        let reach = 0;
        for (const [name, v] of Object.entries(variables)) {
          if (!varInfo[name]) continue;
          const stat = Number(varInfo[name].row[r.attr] ?? 0);
          if (!stat) continue;
          v[row] = stat;
          if (stat > 0) reach += stat * constraints[`cap_${name}`].max;
        }
        const bigM = Math.max(1, reach - thr);
        constraints[row] = { max: thr + bigM };
        variables[y] = { cost: 0, [row]: bigM, [anyRow]: 1, [`cap_${y}`]: 1 };
        constraints[`cap_${y}`] = { max: 1 };
        ints[y] = 1;
      }
      added++;
    }
    if (!added) break;
  }

  if (!recipe) {
    return {
      feasible: false, status, mode, profession: profession.id,
      shortfall: shortfall(reqs, helpful, inventory, mode, s),
    };
  }

  const entries = recipe.map((r) => ({ item: r.row, qty: r.qty }));
  const t = totals(entries);
  const evaluation = evaluate(profession, t.raw, s, t.weight);
  const matches = matchingProfessions(professions, t.raw, s, t.weight).filter((p) => p.id !== profession.id);

  const craftEntries = recipe.filter((r) => r.craft > 0).map((r) => ({ item: r.row, qty: r.craft }));
  const craftNutrients = totals(craftEntries).nutrients;
  const stock = inventory?.nutrient ?? {};
  const nutrientShortfall = {};
  for (const n of NUTRIENTS) {
    const missing = craftNutrients[n] - Number(stock[n] ?? 0);
    if (craftNutrients[n] > 0 && missing > 0) nutrientShortfall[n] = round(missing, 2);
  }

  return {
    feasible: evaluation.met,
    status,
    mode,
    profession: profession.id,
    recipe: recipe.map(({ row, ...r }) => ({ ...r, name: row.name, weight: Number(row.item_weight ?? 0) })),
    totals: t,
    evaluation,
    craft: {
      count: craftEntries.reduce((a, e) => a + e.qty, 0),
      nutrients: craftNutrients,
      stock,
      shortfall: nutrientShortfall,
    },
    find: recipe.filter((r) => r.find > 0).map((r) => ({ id: r.id, name: r.row.name, qty: r.find, alternatives: r.alternatives ?? [] })),
    otherMatches: matches.map((p) => ({
      id: p.id, profession: p.profession, tier: p.tier, category: p.category, risky: p.tier >= profession.tier,
    })),
    exclusive: exclusive && !matches.some((p) => p.tier >= profession.tier),
    unavoidable,
  };
}

function toRecipe(res, varInfo, inventory, toInt = Math.round) {
  const byItem = new Map();
  const add = (it, tier, q, alternatives) => {
    const key = itemKey(it.kind, it.id);
    if (!byItem.has(key)) byItem.set(key, { kind: it.kind, id: it.id, row: it.row, qty: 0, own: 0, craft: 0, find: 0 });
    const e = byItem.get(key);
    e[tier] += q;
    e.qty += q;
    if (alternatives?.length) e.alternatives = alternatives;
  };
  for (const [name, g] of Object.entries(varInfo)) {
    let q = toInt(Number(res[name] ?? 0));
    if (q <= 0) continue;
    const [tier] = name.split('|');
    if (tier === 'own') {
      // Spread over the interchangeable items you own, most plentiful first.
      const have = (it) => owned(inventory, it.kind, it.id);
      const members = [...g.members].sort((a, b) => have(b) - have(a));
      for (const it of members) {
        const take = Math.min(q, have(it));
        if (take > 0) { add(it, 'own', take); q -= take; }
      }
      if (q > 0) add(members[0], 'own', q); // more than owned; rejected by validation
    } else {
      add(g.members[0], tier, q, tier === 'find' ? g.members.slice(1).map((m) => m.row.name) : undefined);
    }
  }
  return [...byItem.values()].sort((a, b) =>
    (a.kind === b.kind ? 0 : a.kind === 'memory' ? -1 : 1) || b.qty - a.qty || a.row.name.localeCompare(b.row.name));
}

/** Per-attribute best achievable raw (fractional knapsack under the weight cap) vs what is needed. */
function shortfall(reqs, items, inventory, mode, s) {
  return reqs.map((r) => {
    const best = bestRaw(r.attr, items, inventory, s, mode);
    const [lo] = bounds(r, s);
    return { attr: r.attr, required: r.required, type: r.type, needRaw: round(lo, 2), bestRaw: round(best, 2), ok: best >= lo };
  });
}

function bestRaw(attr, items, inventory, s, mode = 'inventory') {
  const cands = items
    .map((it) => {
      const stat = Number(it.row[attr] ?? 0);
      const w = Math.max(Number(it.row.item_weight ?? 0), 1e-6);
      const avail = mode === 'plan' && it.kind === 'food' ? Infinity : owned(inventory, it.kind, it.id);
      return { stat, w, avail };
    })
    .filter((c) => c.stat > 0 && c.avail > 0)
    .sort((a, b) => b.stat / b.w - a.stat / a.w);
  let cap = s.podCapacity;
  let total = 0;
  for (const c of cands) {
    if (cap <= 0) break;
    const q = Math.min(c.avail, cap / c.w);
    total += q * c.stat;
    cap -= q * c.w;
  }
  return total;
}

/**
 * Quick overview for the profession grid: per-attribute upper bounds from inventory, a coverage score,
 * and an exact feasibility check (inventory only) for professions that pass the bound test.
 */
export function overview({ professions, memories, foods, inventory, settings, timeout = 400 }) {
  const s = withDefaults(settings);
  const items = catalog(memories, foods).filter((it) => hasStats(it.row));
  return professions.map((p) => {
    const reqs = requirements(p, s);
    const attrs = reqs.map((r) => {
      const best = bestRaw(r.attr, items, inventory, s);
      const [lo, hi] = bounds(r, s);
      const coverage = r.type === 'Less' ? 1 : lo <= 0 ? 1 : Math.min(1, best / lo);
      return { attr: r.attr, required: r.required, type: r.type, bestRaw: round(best, 1), needRaw: round(lo, 1), maxRaw: hi, coverage };
    });
    const coverage = attrs.length ? attrs.reduce((a, x) => a + x.coverage, 0) / attrs.length : 1;
    const minCoverage = Math.min(...attrs.map((a) => a.coverage));
    let feasible = false;
    if (minCoverage >= 1) {
      const res = solve({ profession: p, professions: [], memories, foods, inventory, settings: s, exclusive: false, timeout });
      feasible = res.feasible;
    }
    const status = feasible ? 'growable' : coverage >= s.closeThreshold ? 'close' : 'far';
    return { id: p.id, status, coverage: round(coverage, 3), attrs };
  });
}
