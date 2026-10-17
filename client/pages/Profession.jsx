import React, { useEffect, useState } from 'react';
import { NUTRIENTS, compareSymbol, pretty, requirements } from '../../shared/rules.js';
import { api } from '../api.js';
import { navigate } from '../App.jsx';
import {
  Badge, Bar, Empty, RequirementBars, Spinner, StatusBadge, TierBadge, WeightBar, fmt,
} from '../components/ui.jsx';

export default function Profession({ ctx, id }) {
  const profession = ctx.professions.find((p) => p.id === id);
  const [exclusive, setExclusive] = useState(true);
  const [inv, setInv] = useState(null);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [growing, setGrowing] = useState(false);

  const key = JSON.stringify([id, exclusive, ctx.inventory, ctx.settings, ctx.memories, ctx.foods, ctx.professions]);
  useEffect(() => {
    if (!profession) return undefined;
    let live = true;
    setInv(null);
    setPlan(null);
    setError(null);
    const body = { professionId: id, exclusive };
    api.post('/api/solve', { ...body, mode: 'inventory' })
      .then((r) => live && setInv(r))
      .catch((e) => live && setError(e.message));
    api.post('/api/solve', { ...body, mode: 'plan' })
      .then((r) => live && setPlan(r))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profession) return <div className="page"><Empty>Unknown profession. <a href="#/">Back</a></Empty></div>;

  const status = ctx.overview?.[id]?.status;
  const canGrow = inv?.feasible;

  const loadIntoPod = (result) => {
    const pod = { memory: {}, food: {} };
    for (const r of result.recipe) pod[r.kind][r.id] = r.qty;
    ctx.setPod(pod);
    navigate('/');
    ctx.notify('Recipe loaded into the pod', 'good');
  };

  const grow = async () => {
    const items = inv.recipe.filter((r) => r.own > 0).map((r) => ({ kind: r.kind, id: r.id, qty: r.own }));
    if (!window.confirm(`Grow a ${profession.profession}? This removes ${items.reduce((a, i) => a + i.qty, 0)} items from your inventory and logs the human.`)) return;
    setGrowing(true);
    try {
      const res = await api.post('/api/grow', { professionId: id, items });
      ctx.setInventory(res.inventory);
      ctx.notify(`${profession.profession} logged. Items removed from inventory.`, 'good');
    } catch (e) {
      ctx.notify(e.message, 'bad');
    } finally {
      setGrowing(false);
    }
  };

  return (
    <div className="page detail">
      <a href="#/" className="back">← All humans</a>
      <header className="detail-head">
        <TierBadge tier={profession.tier} />
        <div>
          <h1>{profession.profession}</h1>
          <div className="muted">{profession.category} · Tier {profession.tier}</div>
        </div>
        <StatusBadge status={canGrow ? 'growable' : inv ? (status === 'growable' ? 'close' : status) : status} />
        <label className="check push-right" title="Try to keep professions of the same or a higher tier from also matching (the pod picks randomly among matches, favouring higher tiers).">
          <input type="checkbox" checked={exclusive} onChange={(e) => setExclusive(e.target.checked)} />
          Avoid other same/higher-tier matches
        </label>
      </header>

      {error && <div className="callout callout-bad">{error}</div>}

      <div className="detail-grid">
        <div className="detail-main">
          {!inv ? (
            <section className="panel"><Spinner label="Solving from your inventory…" /></section>
          ) : canGrow ? (
            <RecipePanel
              title="You can grow this now"
              tone="good"
              result={inv}
              ctx={ctx}
              actions={(
                <>
                  <button className="btn btn-primary" onClick={grow} disabled={growing}>{growing ? 'Growing…' : 'Grow (remove items)'}</button>
                  <button className="btn" onClick={() => loadIntoPod(inv)}>Load into pod</button>
                </>
              )}
            />
          ) : (
            <NeedPanel ctx={ctx} inv={inv} plan={plan} onLoad={() => plan && loadIntoPod(plan)} />
          )}

          {canGrow && plan?.feasible && plan.craft.count > 0 && (
            <details className="panel">
              <summary>Alternative with crafting ({plan.totals.count} items instead of {inv.totals.count})</summary>
              <PlanBody result={plan} ctx={ctx} />
            </details>
          )}
        </div>

        <aside className="detail-side">
          <RequirementsPanel profession={profession} ctx={ctx} />
        </aside>
      </div>
    </div>
  );
}

function RequirementsPanel({ profession, ctx }) {
  const reqs = requirements(profession, ctx.settings);
  const best = ctx.overview?.[profession.id]?.attrs ?? [];
  return (
    <section className="panel">
      <h2>Requirements</h2>
      <table className="table">
        <thead>
          <tr><th>Attribute</th><th className="num">Needed</th><th className="num" title="Best raw total reachable from inventory">Best</th></tr>
        </thead>
        <tbody>
          {reqs.map((r) => {
            const b = best.find((x) => x.attr === r.attr);
            return (
              <tr key={r.attr}>
                <td>{pretty(r.attr)}</td>
                <td className="num" title={r.baseline ? `${fmt(r.value)} + baseline ${r.baseline}` : ''}>
                  {compareSymbol(r.type)} {fmt(r.required)}
                  {r.baseline > 0 && r.listed && <span className="muted small"> ({fmt(r.value)}+{r.baseline})</span>}
                  {!r.listed && <span className="muted small"> baseline</span>}
                </td>
                <td className={`num ${b && b.coverage >= 1 ? 'good' : 'bad'}`}>{b ? fmt(b.bestRaw) : '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">
        Values above {ctx.settings.drThreshold} have diminishing returns, so the raw total needed is higher.
        Baselines are {ctx.settings.baselineMode === 'max' ? 'a minimum' : 'added to the requirement'} (change in Data → Settings).
      </p>
    </section>
  );
}

function NeedPanel({ ctx, inv, plan, onLoad }) {
  const missing = (inv.shortfall ?? []).filter((s) => !s.ok);
  return (
    <section className="panel need-panel">
      <div className="panel-head">
        <h2>What you need to grow this</h2>
      </div>
      <div className="callout callout-warn">
        <strong>Can't grow from your inventory yet.</strong>{' '}
        {missing.length > 0 ? (
          <>Not enough {missing.map((s) => pretty(s.attr)).join(', ')} even using your best items.</>
        ) : (
          <>Each attribute is reachable alone, but not all together within {ctx.settings.podCapacity} kg.</>
        )}
      </div>
      {missing.length > 0 && (
        <div className="shortfall">
          {missing.map((s) => (
            <Bar key={s.attr} label={pretty(s.attr)} value={s.bestRaw} target={s.needRaw} right={`${fmt(s.bestRaw)} / ${fmt(s.needRaw)} raw`} />
          ))}
        </div>
      )}
      {!plan ? (
        <Spinner label="Planning what to craft and find…" />
      ) : plan.feasible ? (
        <>
          <PlanSummary plan={plan} />
          <PlanBody result={plan} ctx={ctx} />
          <div className="actions">
            <button className="btn" onClick={onLoad}>Load plan into pod</button>
            <span className="muted small">Craft the foods in game, then re-import your save to grow it.</span>
          </div>
        </>
      ) : (
        <div className="callout callout-bad">
          Even with crafting and finding memories this doesn't fit in {ctx.settings.podCapacity} kg with the current data.
          {plan.shortfall && (
            <ul>{plan.shortfall.filter((s) => !s.ok).map((s) => <li key={s.attr}>{pretty(s.attr)}: best {fmt(s.bestRaw)} of {fmt(s.needRaw)} raw</li>)}</ul>
          )}
        </div>
      )}
    </section>
  );
}

function PlanSummary({ plan }) {
  const own = plan.recipe.reduce((a, r) => a + r.own, 0);
  const findCount = plan.find.reduce((a, f) => a + f.qty, 0);
  const steps = [];
  if (plan.craft.count) steps.push(<span key="c"><strong>craft {plan.craft.count}</strong> food{plan.craft.count === 1 ? '' : 's'}</span>);
  if (findCount) steps.push(<span key="f"><strong>find {findCount}</strong> memor{findCount === 1 ? 'y' : 'ies'}</span>);
  steps.push(<span key="o">use <strong>{own}</strong> item{own === 1 ? '' : 's'} you own</span>);
  return <p className="plan-summary">To grow it: {steps.reduce((acc, s, i) => (i ? [...acc, i === steps.length - 1 ? ' and ' : ', ', s] : [s]), [])}.</p>;
}

function PlanBody({ result, ctx }) {
  const crafted = result.recipe.filter((r) => r.craft > 0);
  const owned = result.recipe.filter((r) => r.own > 0);
  const nutrientsUsed = NUTRIENTS.filter((n) => result.craft.nutrients[n] > 0);
  return (
    <div className="plan">
      {crafted.length > 0 && (
        <div className="plan-block">
          <h3>Craft</h3>
          <ul className="item-list">
            {crafted.map((r) => (
              <li key={r.id}><span className="qty">{r.craft}×</span> {r.name}</li>
            ))}
          </ul>
          <table className="table nutrients">
            <thead><tr><th>Nutrient</th><th className="num">Needed</th><th className="num">You have</th><th className="num">Missing</th></tr></thead>
            <tbody>
              {nutrientsUsed.map((n) => {
                const have = Number(result.craft.stock?.[n] ?? 0);
                const miss = result.craft.shortfall[n] ?? 0;
                return (
                  <tr key={n}>
                    <td>{pretty(n)}</td>
                    <td className="num">{fmt(result.craft.nutrients[n])}</td>
                    <td className="num">{fmt(have)}</td>
                    <td className={`num ${miss ? 'bad' : 'good'}`}>{miss ? fmt(miss) : '✓'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {result.find.length > 0 && (
        <div className="plan-block">
          <h3>Find these memories</h3>
          <ul className="item-list">
            {result.find.map((f) => (
              <li key={f.id}>
                <span className="qty">{f.qty}×</span> {f.name}
                {f.alternatives?.length > 0 && (
                  <div className="muted small alt" title={f.alternatives.join(', ')}>
                    or any with the same stats: {f.alternatives.slice(0, 4).join(', ')}{f.alternatives.length > 4 ? ` +${f.alternatives.length - 4} more` : ''}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {owned.length > 0 && (
        <div className="plan-block">
          <h3>From your inventory</h3>
          <ul className="item-list">
            {owned.map((r) => <li key={r.kind + r.id}><span className="qty">{r.own}×</span> {r.name}</li>)}
          </ul>
        </div>
      )}
      <ResultTotals result={result} ctx={ctx} />
    </div>
  );
}

function RecipePanel({ title, tone, result, ctx, actions }) {
  return (
    <section className={`panel recipe-panel tone-${tone}`}>
      <div className="panel-head">
        <h2>{title}</h2>
        <span className="muted small">{result.totals.count} items · {fmt(result.totals.weight, 2)} kg</span>
      </div>
      <table className="table">
        <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Have</th><th className="num">kg</th></tr></thead>
        <tbody>
          {result.recipe.map((r) => (
            <tr key={r.kind + r.id}>
              <td>{r.name} <span className="muted small">{r.kind}</span></td>
              <td className="num">{r.qty}</td>
              <td className="num muted">{ctx.inventory[r.kind]?.[r.id] ?? 0}</td>
              <td className="num muted">{fmt(r.weight * r.qty, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ResultTotals result={result} ctx={ctx} />
      <div className="actions">{actions}</div>
    </section>
  );
}

function ResultTotals({ result, ctx }) {
  return (
    <div className="result-totals">
      <RequirementBars attrs={result.evaluation.attrs} />
      <WeightBar weight={result.totals.weight} capacity={ctx.settings.podCapacity} />
      <OtherMatches result={result} />
    </div>
  );
}

function OtherMatches({ result }) {
  if (!result.otherMatches?.length) {
    return <div className="callout callout-good small">Only this profession matches this recipe.</div>;
  }
  const risky = result.otherMatches.filter((m) => m.risky);
  return (
    <div className={`callout small ${risky.length ? 'callout-warn' : ''}`}>
      {risky.length ? <strong>Also matches a same/higher tier: </strong> : <span>Also matches lower tiers: </span>}
      {result.otherMatches.map((m, i) => (
        <span key={m.id}>
          {i > 0 && ', '}
          <a href={`#/p/${m.id}`}>{m.profession}</a> <Badge tone={m.risky ? 'warn' : 'muted'}>T{m.tier}</Badge>
        </span>
      ))}
      <div className="muted">
        {risky.length
          ? 'The pod may grow one of these instead. Nothing in your options rules them out.'
          : 'The pod favours higher tiers, so this one is the likely result.'}
      </div>
    </div>
  );
}
