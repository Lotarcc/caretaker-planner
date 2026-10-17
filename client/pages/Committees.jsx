import React, { useEffect, useMemo, useState } from 'react';
import { COMMITTEE_NOTES, adviceFromSave, committeeProgress } from '../../shared/committees.js';
import { pretty } from '../../shared/rules.js';
import { api } from '../api.js';
import { Badge, Spinner, StatusBadge, TierBadge, fmt, timeAgo } from '../components/ui.jsx';

// The ten committees in the recommended order, with what the last imported save says is already done.
export default function Committees({ ctx }) {
  const progress = useMemo(
    () => committeeProgress({ professions: ctx.professions, overview: ctx.overview, lastImport: ctx.lastImport }),
    [ctx.professions, ctx.overview, ctx.lastImport],
  );
  const advice = useMemo(() => adviceFromSave(ctx.lastImport, progress), [ctx.lastImport, progress]);
  const next = progress.committees.find((c) => c.next);

  return (
    <div className="page committees-page">
      <div className="page-head">
        <h1>Committees</h1>
        <span className="muted">
          {progress.doneCount} of {progress.committees.length} launched
          {next && <> · next: <strong>{next.name}</strong></>}
        </span>
      </div>

      {!ctx.lastImport ? (
        <div className="callout">
          Import a save to see which committees are already launched. Until then every committee shows as not started.
        </div>
      ) : (
        <p className="muted small">
          From <span title={ctx.lastImport.source?.path}>{ctx.lastImport.source?.name}</span>, saved{' '}
          {timeAgo(ctx.lastImport.meta?.savedAt)}. A member counts as launched when the save has a delivered human with
          that profession.
        </p>
      )}

      {advice.length > 0 && (
        <section className="panel" aria-label="Advice from your save">
          <div className="panel-head"><h2>From your save</h2></div>
          <ul>{advice.map((a) => <li key={a}>{a}</li>)}</ul>
        </section>
      )}

      <CouncilPlan ctx={ctx} />

      <ol className="committee-list">
        {progress.committees.map((c) => <CommitteeRow key={c.id} c={c} />)}
      </ol>

      {progress.unknownSaveStates.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Other committee states in the save</h2></div>
          <p className="muted small">The save names these committees by codes the planner doesn't know yet.</p>
          <ul>{progress.unknownSaveStates.map((s) => <li key={s.key}><code>{s.key}</code>: {s.state}</li>)}</ul>
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h2>Notes</h2></div>
        <ul>{COMMITTEE_NOTES.map((n) => <li key={n}>{n}</li>)}</ul>
      </section>
    </div>
  );
}

const QUEST_STATUS = { Completed: 'Done', InProgress: 'In progress' };

function CommitteeRow({ c }) {
  const state = c.done
    ? <Badge tone="good">Launched</Badge>
    : c.started
      ? <Badge tone="info">{c.delivered + c.grown} of 4 started</Badge>
      : null;
  return (
    <li aria-label={c.name} className={`panel committee ${c.done ? 'committee-done' : ''} ${c.next ? 'committee-next' : ''}`}>
      <div className="committee-head">
        <span className="committee-order" aria-hidden="true">{c.order}</span>
        <h2>{c.name}</h2>
        <span className="muted small" title="The committee's own tier, shown on its seats in game">committee tier {c.tier} · age {c.minAge}+</span>
        {c.next && <Badge tone="warn">Do next</Badge>}
        {state}
        {c.saveState && <span className="muted small" title="Committee state recorded in the save">game: {c.saveState}</span>}
        {!c.done && <span className="muted small push-right">{c.ready} of {c.members.length - c.delivered - c.grown} left growable now</span>}
      </div>
      <p className="muted small committee-why">{c.why}</p>
      {c.quests.length > 0 && (
        <ul className="committee-quests" aria-label={`${c.name} quests`}>
          {c.quests.map((q) => (
            <li key={q.name}>
              <strong>{q.name}</strong> <span className="muted">{q.gives}</span>
              {q.status && <Badge tone={q.status === 'Completed' ? 'good' : 'info'}>{QUEST_STATUS[q.status] ?? q.status}</Badge>}
            </li>
          ))}
        </ul>
      )}
      <ul className="committee-members">
        {c.members.map((m) => (
          <li key={m.name}>
            {m.id ? <a href={`#/p/${m.id}`}>{m.tier && <TierBadge tier={m.tier} />} {m.name}</a> : <span>{m.name}</span>}
            {m.fate === 'delivered' ? <Badge tone="good">In orbit</Badge>
              : m.fate === 'grown' ? <Badge tone="info">Grown</Badge>
                : <StatusBadge status={m.status} />}
          </li>
        ))}
      </ul>
    </li>
  );
}

// One plan for every human still to make, so scarce memories and owned food go where they save the most.
function CouncilPlan({ ctx }) {
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  // A plan is only good for the inventory, settings and save it was made from.
  const basis = JSON.stringify([ctx.inventory, ctx.settings, ctx.lastImport?.importedAt, ctx.memories, ctx.foods, ctx.professions]);
  useEffect(() => setPlan(null), [basis]);

  const run = async () => {
    setBusy(true);
    try {
      setPlan(await api.post('/api/council'));
    } catch (e) {
      ctx.notify(`Couldn't plan the council: ${e.message}`, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const t = plan?.totals;
  return (
    <section className="panel council-plan" aria-label="Plan for every remaining human">
      <div className="panel-head">
        <h2>Plan every remaining human</h2>
        <div className="head-actions">
          <button className="btn btn-primary" type="button" onClick={run} disabled={busy}>
            {busy ? 'Planning…' : plan ? 'Plan again' : 'Plan them all'}
          </button>
        </div>
      </div>
      <p className="muted small">
        Plans every seat without a launched human, plus one for Platform Omega, in one go. Your memories and foods are
        shared out where they save the most; the rest is crafted or found, at the gathering costs in Data → Settings.
      </p>
      {busy && <Spinner label="Planning every human…" />}
      {t && (
        <>
          <p className="plan-summary">
            <strong>{t.planned} of {plan.humans.length}</strong> humans planned
            <span className="muted small"> · {plan.method === 'joint' ? 'planned together' : 'planned one by one'}, {fmt(plan.ms / 1000)} s</span>
          </p>
          {t.impossible.length > 0 && (
            <div className="callout callout-bad small">No recipe found for: {t.impossible.join(', ')}.</div>
          )}
          <div className="council-grid">
            <div>
              <h3>Nutrients to gather</h3>
              <table className="table nutrients" aria-label="Nutrients to gather">
                <thead><tr><th>Nutrient</th><th className="num">Need</th><th className="num">In stock</th><th className="num">To gather</th></tr></thead>
                <tbody>
                  {t.nutrients.map((n) => (
                    <tr key={n.nutrient}>
                      <td>{pretty(n.nutrient)}</td>
                      <td className="num">{fmt(n.need)}</td>
                      <td className="num">{fmt(n.stock)}</td>
                      <td className={`num ${n.gather > 0 ? '' : 'good'}`}><strong>{fmt(n.gather)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3>Foods to craft</h3>
              <ul className="item-list" aria-label="Foods to craft">
                {t.crafts.map((x) => <li key={x.name}><span className="qty">{x.qty}×</span> {x.name}</li>)}
              </ul>
            </div>
            <div>
              <h3>Memories to find</h3>
              {t.find.length ? (
                <ul className="item-list" aria-label="Memories to find">
                  {t.find.map((x) => <li key={x.name}><span className="qty">{x.qty}×</span> {x.name}</li>)}
                </ul>
              ) : <p className="muted small">None: your memories cover every human.</p>}
            </div>
          </div>
          <h3>Per human</h3>
          <div className="council-humans">
            {plan.humans.map((h) => (
              <details key={h.key} className="council-human">
                <summary>
                  <TierBadge tier={h.tier} /> {h.label}
                  {h.committee && <span className="muted small"> · {h.committee}</span>}
                  <span className="muted small"> · {fmt(h.weight, 2)} kg</span>
                  {!h.feasible && <Badge tone="bad">No recipe</Badge>}
                  {h.otherMatches.some((m) => m.risky) && <Badge tone="warn" title="The pod may pick another profession">May match others</Badge>}
                </summary>
                <ul className="item-list">
                  {h.recipe.map((r) => (
                    <li key={`${r.kind}:${r.id}`}>
                      <span className="qty">{r.qty}×</span> {r.name}{' '}
                      <span className="muted small">
                        {[r.own && `${r.own} owned`, r.craft && `${r.craft} to craft`, r.find && `${r.find} to find`].filter(Boolean).join(', ')}
                      </span>
                    </li>
                  ))}
                </ul>
                <a href={`#/p/${h.professionId}`} className="small">Open {h.profession}</a>
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
