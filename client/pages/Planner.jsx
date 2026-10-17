import React, { useMemo, useState } from 'react';
import {
  ALL_ATTRS, FOOD_ATTRS, MEMORY_ATTRS, NUTRIENTS, evaluate, matchingProfessions, pretty, totals,
} from '../../shared/rules.js';
import {
  ATTR_SHORT, Badge, Bar, Empty, StatChips, StatusBadge, Stepper, Tabs, TierBadge, WeightBar, fmt, effective,
} from '../components/ui.jsx';
import { navigate } from '../App.jsx';

export default function Planner({ ctx }) {
  const [compare, setCompare] = useState('inventory');
  const podEmpty = !Object.values(ctx.pod.memory).some(Boolean) && !Object.values(ctx.pod.food).some(Boolean);
  const hasInventory = Object.keys(ctx.inventory.memory).length + Object.keys(ctx.inventory.food).length > 0;

  return (
    <div className="page planner">
      {!hasInventory && (
        <div className="callout">
          <strong>No inventory yet.</strong> Click <em>Load latest save</em>, drop a <code>.sav</code> on the{' '}
          <a href="#/import">Import</a> page, or add items by hand with the + buttons.
        </div>
      )}
      <div className="planner-grid">
        <InventoryPanel ctx={ctx} />
        <div className="planner-main">
          {!podEmpty && <PodPanel ctx={ctx} />}
          <ProfessionGrid ctx={ctx} compare={podEmpty ? 'inventory' : compare} setCompare={setCompare} podEmpty={podEmpty} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- inventory

function InventoryPanel({ ctx }) {
  const [tab, setTab] = useState('memory');
  const [query, setQuery] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const { inventory, pod, setPod, setQty } = ctx;

  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const tabs = [
    { value: 'memory', label: 'Memories', count: sum(inventory.memory) },
    { value: 'food', label: 'Foods', count: sum(inventory.food) },
    { value: 'nutrient', label: 'Nutrients', count: sum(inventory.nutrient) },
  ];

  const rows = useMemo(() => {
    if (tab === 'nutrient') return [];
    const list = tab === 'memory' ? ctx.memories : ctx.foods;
    const q = query.trim().toLowerCase();
    return list
      .filter((r) => !ownedOnly || inventory[tab][r.id])
      .filter((r) => !q || r.name.toLowerCase().includes(q) || ALL_ATTRS.some((a) => r[a] && pretty(a).toLowerCase().includes(q)))
      .sort((a, b) => (inventory[tab][b.id] ?? 0 ? 1 : 0) - (inventory[tab][a.id] ?? 0 ? 1 : 0) || a.name.localeCompare(b.name));
  }, [tab, query, ownedOnly, ctx.memories, ctx.foods, inventory]);

  const addToPod = (kind, id, delta) => setPod((p) => {
    const next = Math.max(0, (p[kind][id] ?? 0) + delta);
    const k = { ...p[kind] };
    if (next) k[id] = next; else delete k[id];
    return { ...p, [kind]: k };
  });

  return (
    <aside className="panel inventory-panel">
      <div className="panel-head">
        <h2>Inventory</h2>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>
      {tab !== 'nutrient' && (
        <div className="toolbar">
          <input
            className="input grow"
            type="search"
            placeholder={`Search ${tab === 'memory' ? 'memories' : 'foods'} or stats…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="check">
            <input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} /> Owned
          </label>
        </div>
      )}
      <div className="tile-list">
        {tab === 'nutrient' ? (
          NUTRIENTS.map((n) => (
            <div key={n} className={`tile ${inventory.nutrient[n] ? '' : 'tile-empty'}`}>
              <div className="tile-main">
                <div className="tile-name">{pretty(n)}</div>
                <div className="muted small">raw crafting material</div>
              </div>
              <Stepper value={inventory.nutrient[n] ?? 0} onChange={(v) => setQty('nutrient', n, v)} title="Owned" />
            </div>
          ))
        ) : rows.length ? (
          rows.map((r) => {
            const have = inventory[tab][r.id] ?? 0;
            const inPod = pod[tab][r.id] ?? 0;
            return (
              <div key={r.id} className={`tile ${have ? '' : 'tile-empty'}`}>
                <div className="tile-main">
                  <div className="tile-name">
                    {r.name}
                    {r.unverified && <Badge tone="warn" title="Stats not verified in game; edit in Data">unverified</Badge>}
                    {tab === 'food' && <span className="muted small"> · T{r.tier}</span>}
                  </div>
                  <div className="tile-meta">
                    <span className="muted small">{fmt(r.item_weight, 2)} kg</span>
                    <StatChips item={r} attrs={tab === 'memory' ? MEMORY_ATTRS : FOOD_ATTRS} />
                  </div>
                </div>
                <div className="tile-actions">
                  <Stepper value={have} onChange={(v) => setQty(tab, r.id, v)} title="Owned" />
                  <button
                    className={`btn btn-small ${inPod ? 'btn-accent' : ''} ${inPod > have ? 'over' : ''}`}
                    onClick={() => addToPod(tab, r.id, 1)}
                    onContextMenu={(e) => { e.preventDefault(); addToPod(tab, r.id, -1); }}
                    title="Add to pod (right-click to remove one)"
                  >
                    {inPod ? `Pod ×${inPod}` : '+ Pod'}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <Empty>Nothing matches.</Empty>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- pod

function podEntries(ctx) {
  const out = [];
  for (const [kind, rows] of [['memory', ctx.memories], ['food', ctx.foods]]) {
    for (const [id, qty] of Object.entries(ctx.pod[kind])) {
      const item = rows.find((r) => r.id === id);
      if (item && qty) out.push({ kind, item, qty });
    }
  }
  return out;
}

function PodPanel({ ctx }) {
  const entries = podEntries(ctx);
  const t = totals(entries);
  const matches = matchingProfessions(ctx.professions, t.raw, ctx.settings, t.weight);
  const remove = (kind, id) => ctx.setPod((p) => {
    const k = { ...p[kind] };
    delete k[id];
    return { ...p, [kind]: k };
  });
  const over = entries.filter((e) => e.qty > (ctx.inventory[e.kind][e.item.id] ?? 0));

  return (
    <section className="panel pod-panel">
      <div className="panel-head">
        <h2>Pod</h2>
        <span className="muted small">{t.count} items</span>
        <button className="btn btn-small btn-ghost" onClick={() => ctx.setPod({ memory: {}, food: {} })}>Clear</button>
      </div>
      <div className="pod-items">
        {entries.map((e) => (
          <button key={e.kind + e.item.id} className={`pod-chip chip-${e.kind}`} onClick={() => remove(e.kind, e.item.id)} title="Remove">
            {e.item.name} ×{e.qty} <span aria-hidden="true">✕</span>
          </button>
        ))}
      </div>
      {over.length > 0 && (
        <div className="callout callout-warn small">More than you own: {over.map((e) => e.item.name).join(', ')}</div>
      )}
      <WeightBar weight={t.weight} capacity={ctx.settings.podCapacity} />
      <div className="totals-grid">
        {ALL_ATTRS.map((a) => {
          const eff = effective(t.raw[a], ctx.settings);
          return (
            <div key={a} className={`total ${t.raw[a] ? '' : 'zero'}`} title={`${pretty(a)}: raw ${fmt(t.raw[a])}, effective ${fmt(eff)}`}>
              <span className="total-label">{ATTR_SHORT[a]}</span>
              <span className="total-value">{fmt(eff)}</span>
              {t.raw[a] > ctx.settings.drThreshold && <span className="total-raw">raw {fmt(t.raw[a])}</span>}
            </div>
          );
        })}
      </div>
      <div className="pod-matches">
        <span className="muted small">Matches:</span>{' '}
        {matches.length ? matches.map((p) => (
          <a key={p.id} href={`#/p/${p.id}`} className="match-link"><TierBadge tier={p.tier} /> {p.profession}</a>
        )) : <span className="muted small">none yet</span>}
        {matches.length > 1 && (
          <div className="muted small">The pod picks randomly among matches, favouring higher tiers.</div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- professions

function ProfessionGrid({ ctx, compare, setCompare, podEmpty }) {
  const [tier, setTier] = useState(0);
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const categories = [...new Set(ctx.professions.map((p) => p.category))].sort();

  const podTotals = useMemo(() => totals(podEntries(ctx)), [ctx.pod, ctx.memories, ctx.foods]); // eslint-disable-line react-hooks/exhaustive-deps

  const cards = useMemo(() => {
    return ctx.professions.map((p) => {
      if (compare === 'pod') {
        const ev = evaluate(p, podTotals.raw, ctx.settings, podTotals.weight);
        const cov = ev.attrs.map((a) => (a.met ? 1 : Math.min(1, a.required > 0 ? a.effective / a.required : 0)));
        const coverage = cov.reduce((x, y) => x + y, 0) / (cov.length || 1);
        return {
          p,
          status: ev.met ? 'growable' : coverage >= ctx.settings.closeThreshold ? 'close' : 'far',
          coverage,
          bars: ev.attrs.map((a) => ({ attr: a.attr, value: a.effective, target: a.required, met: a.met })),
        };
      }
      const o = ctx.overview?.[p.id];
      return {
        p,
        status: o?.status,
        coverage: o?.coverage ?? 0,
        bars: (o?.attrs ?? []).map((a) => ({ attr: a.attr, value: a.bestRaw, target: a.needRaw, met: a.coverage >= 1 })),
      };
    });
  }, [ctx.professions, ctx.overview, ctx.settings, compare, podTotals]);

  const order = { growable: 0, close: 1, far: 2 };
  const q = query.trim().toLowerCase();
  const visible = cards
    .filter((c) => !tier || c.p.tier === tier)
    .filter((c) => !category || c.p.category === category)
    .filter((c) => !statusFilter || c.status === statusFilter)
    .filter((c) => !q || c.p.profession.toLowerCase().includes(q))
    .sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || b.p.tier - a.p.tier || b.coverage - a.coverage);

  const counts = { growable: 0, close: 0, far: 0 };
  for (const c of cards) if (c.status) counts[c.status]++;

  return (
    <section className="panel">
      <div className="panel-head wrap">
        <h2>Humans</h2>
        <span className="muted small">
          {counts.growable} growable · {counts.close} close · {counts.far} far
          {ctx.overviewBusy && compare === 'inventory' ? ' · updating…' : ''}
        </span>
        {!podEmpty && (
          <Tabs
            tabs={[{ value: 'inventory', label: 'vs inventory' }, { value: 'pod', label: 'vs pod' }]}
            value={compare}
            onChange={setCompare}
          />
        )}
      </div>
      <div className="toolbar wrap">
        <div className="seg">
          {[0, 1, 2, 3, 4].map((t) => (
            <button key={t} className={tier === t ? 'active' : ''} onClick={() => setTier(t)}>{t ? `T${t}` : 'All tiers'}</button>
          ))}
        </div>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Any status</option>
          <option value="growable">Growable</option>
          <option value="close">Close</option>
          <option value="far">Far</option>
        </select>
        <input className="input grow" type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <p className="muted small legend">
        {compare === 'pod'
          ? 'Bars: what the pod gives (effective) vs what is required.'
          : 'Bars: best you could reach for each attribute from your inventory (raw, within the weight limit) vs what is needed. Click a human to see its recipe or what to craft.'}
      </p>
      <div className="card-grid">
        {visible.map(({ p, status, bars }) => (
          <button key={p.id} className={`card status-${status ?? 'loading'}`} onClick={() => navigate(`/p/${p.id}`)}>
            <div className="card-head">
              <TierBadge tier={p.tier} />
              <div className="card-title">
                <div className="card-name">{p.profession}</div>
                <div className="muted small">{p.category}</div>
              </div>
              <StatusBadge status={status} />
            </div>
            <div className="card-bars">
              {bars.map((b) => (
                <Bar
                  key={b.attr}
                  label={ATTR_SHORT[b.attr]}
                  value={b.value}
                  target={b.target || 1}
                  tone={b.met ? 'good' : undefined}
                  right={b.met ? '✓' : `${Math.round(b.target ? (b.value / b.target) * 100 : 0)}%`}
                />
              ))}
            </div>
            {status && status !== 'growable' && compare === 'inventory' && (
              <div className="card-foot">Can't grow from inventory yet · see what you need →</div>
            )}
          </button>
        ))}
        {!visible.length && <Empty>No humans match these filters.</Empty>}
      </div>
    </section>
  );
}
