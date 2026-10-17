// Thin adapter around HiGHS (WASM). Takes a model in the object form used by the solver
// ({ optimize, opType, constraints: {row: {min, max}}, variables: {name: {row: coef}}, ints: {name: 1} })
// and returns { feasible, result, values: {name: number}, optimal }.
import highsLoader from 'highs';

// In the browser the app sets HIGHS_LOADER_OPTIONS (e.g. where highs.wasm is served) before importing this.
const loaderOptions = () => globalThis.HIGHS_LOADER_OPTIONS ?? {};
let highs = await highsLoader(loaderOptions());

const num = (v) => {
  if (!Number.isFinite(v)) throw new Error(`Non-finite coefficient ${v}`);
  return Number(v.toPrecision(12)).toString();
};

export function toLp(model) {
  const varNames = Object.keys(model.variables);
  const vid = new Map(varNames.map((n, i) => [n, `x${i}`]));
  const rows = new Map(Object.keys(model.constraints).map((r) => [r, []]));
  const obj = [];
  for (const [name, coefs] of Object.entries(model.variables)) {
    for (const [row, c] of Object.entries(coefs)) {
      if (!c) continue;
      if (row === model.optimize) obj.push([c, vid.get(name)]);
      else if (rows.has(row)) rows.get(row).push([c, vid.get(name)]);
    }
  }
  const expr = (terms) => terms.map(([c, v], i) => `${c < 0 ? '-' : i ? '+' : ''} ${num(Math.abs(c))} ${v}`).join(' ');
  const lines = [model.opType === 'max' ? 'Maximize' : 'Minimize', ` obj: ${obj.length ? expr(obj) : '0 x0'}`, 'Subject To'];
  let k = 0;
  for (const [row, bound] of Object.entries(model.constraints)) {
    const terms = rows.get(row);
    if (!terms.length) {
      // An empty row is only a problem if its bounds exclude 0.
      if ((bound.min ?? -Infinity) > 1e-9 || (bound.max ?? Infinity) < -1e-9) lines.push(` c${k++}: 0 x0 >= 1`);
      continue;
    }
    if (bound.min !== undefined) lines.push(` c${k++}: ${expr(terms)} >= ${num(bound.min)}`);
    if (bound.max !== undefined) lines.push(` c${k++}: ${expr(terms)} <= ${num(bound.max)}`);
  }
  lines.push('Bounds');
  for (const n of varNames) lines.push(` ${vid.get(n)} >= 0`);
  const ints = varNames.filter((n) => model.ints?.[n]);
  if (ints.length) lines.push('General', ` ${ints.map((n) => vid.get(n)).join(' ')}`);
  lines.push('End');
  return { lp: lines.join('\n'), vid };
}

export function solveMilp(model, { timeLimitMs = 2000 } = {}) {
  const { lp, vid } = toLp(model);
  let out;
  try {
    out = highs.solve(lp, { time_limit: timeLimitMs / 1000, output_flag: false, mip_rel_gap: 1e-6 });
  } catch (err) {
    // A failed solve can leave the WASM instance unusable; start a fresh one next time.
    highsLoader(loaderOptions()).then((h) => { highs = h; });
    throw err;
  }
  const status = out.Status;
  const hasSolution = status === 'Optimal' || ((status === 'Time limit reached' || status === 'Interrupted') && out.Columns && Object.values(out.Columns).some((c) => Number.isFinite(c.Primal)));
  const values = {};
  if (hasSolution) for (const [name, id] of vid) values[name] = out.Columns[id]?.Primal ?? 0;
  return { feasible: hasSolution, optimal: status === 'Optimal', status, result: out.ObjectiveValue, values };
}
