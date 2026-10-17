// Game rules shared by the server and the client.

export const MEMORY_ATTRS = [
  'Logic', 'Focus', 'Discipline', 'Creativity', 'Communication',
  'Empathy', 'Leadership', 'Wisdom', 'Patience', 'Adaptability',
];
export const FOOD_ATTRS = ['Strength', 'Height', 'Weight', 'Intellect', 'Life_Expectancy'];
export const ALL_ATTRS = [...MEMORY_ATTRS, ...FOOD_ATTRS];
export const NUTRIENTS = [
  'Protein', 'Fat', 'Carbohydrate', 'Calcium', 'VitaminD', 'Omega3',
  'Bioregulator', 'Nanite_Nutrient', 'Mitochondrial_Amplifier',
];
export const COMPARE_TYPES = ['Greater', 'GreaterOrEqual', 'Less', 'Equal'];

// Save asset names for raw nutrient materials (used to compare a craft list against stock).
export const NUTRIENT_ASSETS = {
  DA_Material_Food_Protein: 'Protein',
  DA_Material_Food_Fat: 'Fat',
  DA_Material_Food_Carbohydrate: 'Carbohydrate',
  DA_Material_Food_Calcium: 'Calcium',
  DA_Material_Food_Vitamind: 'VitaminD',
  'DA_Material_Food_Omega-3': 'Omega3',
  DA_Material_Food_Bioregulator: 'Bioregulator',
  DA_Material_Food_Nanite_Nutrient: 'Nanite_Nutrient',
  DA_Material_Food_MitochondrialAmplifier: 'Mitochondrial_Amplifier',
};

export const DEFAULT_SETTINGS = {
  drThreshold: 200, // soft cap: raw values above this are diminished
  drPower: 0.6,
  drMin: 0,
  baselines: { Weight: 20, Height: 30, Life_Expectancy: 10 },
  baselineMode: 'add', // 'add': requirement + baseline (old site's display); 'max': max(requirement, baseline)
  podCapacity: 100, // kg
  closeThreshold: 0.8, // coverage at or above this counts as "close"
  // Relative scarcity used to rank craft plans (higher = avoid using).
  nutrientCost: {
    Protein: 1, Fat: 1, Carbohydrate: 1, Calcium: 2, VitaminD: 2, Omega3: 2,
    Bioregulator: 6, Nanite_Nutrient: 6, Mitochondrial_Amplifier: 6,
  },
};

export function withDefaults(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    baselines: { ...DEFAULT_SETTINGS.baselines, ...(settings.baselines ?? {}) },
    nutrientCost: { ...DEFAULT_SETTINGS.nutrientCost, ...(settings.nutrientCost ?? {}) },
  };
}

export const pretty = (attr) => attr.replace(/_/g, ' ');

/** Raw total -> effective value (soft cap with diminishing returns). */
export function effective(raw, s = DEFAULT_SETTINGS) {
  const t = s.drThreshold;
  const v = raw <= t ? raw : t + Math.pow(raw - t, s.drPower);
  return Math.max(s.drMin ?? 0, v);
}

/** Effective value -> smallest raw total that reaches it. */
export function inverseEffective(eff, s = DEFAULT_SETTINGS) {
  const t = s.drThreshold;
  return eff <= t ? eff : t + Math.pow(eff - t, 1 / s.drPower);
}

export function compare(eff, req, type = 'Greater') {
  switch (type) {
    case 'GreaterOrEqual': return eff >= req;
    case 'Less': return eff <= req;
    case 'Equal': return Math.abs(eff - req) <= 0.5;
    case 'Greater':
    default: return eff > req;
  }
}

export const compareSymbol = (type) => ({ Greater: '>', GreaterOrEqual: '≥', Less: '≤', Equal: '≈' })[type] ?? '>';

/**
 * The requirement list for a profession: every attribute with a non-zero value or an explicit compare type,
 * plus the always-required baselines.
 */
export function requirements(profession, settings = DEFAULT_SETTINGS) {
  const s = withDefaults(settings);
  const types = profession.requirement_types ?? {};
  const out = [];
  for (const attr of ALL_ATTRS) {
    const base = s.baselines[attr] ?? 0;
    const value = Number(profession[attr] ?? 0);
    const listed = value !== 0 || attr in types;
    if (!listed && !base) continue;
    const required = !listed ? base : s.baselineMode === 'max' ? Math.max(value, base) : value + base;
    out.push({ attr, value, baseline: base, required, type: types[attr] ?? 'Greater', listed });
  }
  return out;
}

/** Sums stats, weight and nutrient cost over [{ item, qty }]. */
export function totals(entries) {
  const raw = Object.fromEntries(ALL_ATTRS.map((a) => [a, 0]));
  const nutrients = Object.fromEntries(NUTRIENTS.map((n) => [n, 0]));
  let weight = 0;
  let count = 0;
  for (const { item, qty } of entries) {
    if (!qty) continue;
    for (const a of ALL_ATTRS) raw[a] += Number(item[a] ?? 0) * qty;
    for (const n of NUTRIENTS) nutrients[n] += Number(item[n] ?? 0) * qty;
    weight += Number(item.item_weight ?? 0) * qty;
    count += qty;
  }
  return { raw, nutrients, weight: round(weight, 3), count };
}

export function round(v, digits = 2) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** Checks a profession against raw totals. */
export function evaluate(profession, raw, settings = DEFAULT_SETTINGS, weight = 0) {
  const s = withDefaults(settings);
  const attrs = requirements(profession, s).map((r) => {
    const value = raw[r.attr] ?? 0;
    const eff = effective(value, s);
    return { ...r, raw: value, effective: round(eff, 2), met: compare(eff, r.required, r.type) };
  });
  const weightOk = weight <= s.podCapacity + 1e-9;
  return { attrs, weightOk, met: weightOk && attrs.every((a) => a.met) };
}

/** All professions whose requirements the totals satisfy, highest tier first. */
export function matchingProfessions(professions, raw, settings = DEFAULT_SETTINGS, weight = 0) {
  return professions
    .filter((p) => evaluate(p, raw, settings, weight).met)
    .sort((a, b) => b.tier - a.tier || a.profession.localeCompare(b.profession));
}

/** Parses the comma-separated internal_name aliases of a DB row. */
export function aliases(row) {
  return String(row.internal_name ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
