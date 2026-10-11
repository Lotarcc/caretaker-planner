import React, { useEffect, useState } from 'react';
import { pretty } from '../../shared/rules.js';
import { api } from '../api.js';
import { Badge, Empty, Spinner, TierBadge, fmt, timeAgo } from '../components/ui.jsx';

export default function Grown({ ctx }) {
  const [log, setLog] = useState(null);
  const load = () => api.get('/api/grown').then(setLog).catch((e) => ctx.notify(e.message, 'bad'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const prof = (id) => ctx.professions.find((p) => p.id === id);
  const itemName = (kind, id) => (kind === 'memory' ? ctx.memories : ctx.foods).find((r) => r.id === id)?.name ?? id;

  const remove = async (entry, restore) => {
    const msg = restore ? 'Undo: delete this entry and put its items back into the inventory?' : 'Delete this entry (inventory unchanged)?';
    if (!window.confirm(msg)) return;
    try {
      const res = await api.del(`/api/grown/${entry.id}${restore ? '?restore=1' : ''}`);
      ctx.setInventory(res.inventory);
      load();
    } catch (e) {
      ctx.notify(e.message, 'bad');
    }
  };

  const humans = ctx.lastImport?.humans ?? [];
  const byInternal = (name) => ctx.professions.find((p) => p.internal_name === name);

  return (
    <div className="page grown-page">
      <h1>Grown humans</h1>
      <section className="panel">
        <div className="panel-head"><h2>Planner log</h2></div>
        {!log ? <Spinner /> : log.length ? (
          <table className="table">
            <thead><tr><th>When</th><th>Profession</th><th>Items used</th><th /></tr></thead>
            <tbody>
              {log.map((e) => {
                const p = prof(e.profession_id);
                return (
                  <tr key={e.id}>
                    <td title={e.created_at}>{timeAgo(e.created_at)}</td>
                    <td>{p ? <a href={`#/p/${p.id}`}><TierBadge tier={p.tier} /> {p.profession}</a> : e.profession_id}</td>
                    <td className="small">{e.items.map((i) => `${i.qty}× ${itemName(i.kind, i.id)}`).join(', ')}</td>
                    <td className="num nowrap">
                      <button className="btn btn-small" onClick={() => remove(e, true)}>Undo</button>{' '}
                      <button className="btn btn-small btn-ghost" onClick={() => remove(e, false)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <Empty>Nothing grown yet. Use <em>Grow</em> on a profession page.</Empty>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>In your last imported save</h2>
          {ctx.lastImport && <span className="muted small">{ctx.lastImport.source?.name}</span>}
        </div>
        {humans.length ? (
          <div className="human-list">
            {humans.map((h) => {
              const profs = h.traits.map(byInternal).filter(Boolean);
              const mutations = h.traits.filter((t) => !byInternal(t)).map((t) => t.replace(/^DA_Mutation_?/, '').replace(/_/g, ' '));
              return (
                <div key={h.id} className="human">
                  <div className="human-head">
                    {profs.length ? profs.map((p) => <a key={p.id} href={`#/p/${p.id}`}><TierBadge tier={p.tier} /> {p.profession}</a>) : <span className="muted">No profession</span>}
                    <Badge tone={h.status === 'Delivered' ? 'good' : h.status === 'Success' ? 'info' : 'muted'}>{h.status}</Badge>
                    {h.timestamp && <span className="muted small">{timeAgo(h.timestamp)}</span>}
                  </div>
                  {mutations.length > 0 && <div className="small">Mutations: {mutations.join(', ')}</div>}
                  <div className="chips">
                    {Object.entries(h.attributes).map(([k, v]) => <span key={k} className="chip">{pretty(k)} {fmt(v)}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <Empty>No grown humans recorded in the imported save.</Empty>}
      </section>
    </div>
  );
}
