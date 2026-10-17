import React, { useEffect, useState } from 'react';
import { pretty } from '../../shared/rules.js';
import { api } from '../api.js';
import { Badge, Empty, Spinner, timeAgo } from '../components/ui.jsx';

export default function ImportPage({ ctx }) {
  const [saves, setSaves] = useState(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    api.get('/api/import/saves').then(setSaves).catch((e) => setSaves({ dirs: [], saves: [], error: e.message }));
  }, [ctx.lastImport]);

  const onFiles = (files) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.sav')) {
      ctx.notify('That is not a .sav file', 'bad');
      return;
    }
    ctx.runImport(() => api.upload(file));
  };

  const last = ctx.lastImport;

  return (
    <div className="page import-page">
      <h1>Import a save</h1>
      <p className="muted">
        Counts memories and foods in your inventory, storage boxes and containers. Loose items lying in the world are left out.
        Importing replaces the planner's inventory.
      </p>

      <label
        className={`dropzone ${drag ? 'drag' : ''} ${ctx.importing ? 'busy' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
      >
        <input type="file" accept=".sav" hidden onChange={(e) => onFiles(e.target.files)} disabled={ctx.importing} />
        {ctx.importing ? <Spinner label="Reading save… (a few seconds)" /> : (
          <>
            <strong>Drop a .sav file here</strong>
            <span className="muted">or click to choose one</span>
            <span className="muted small">Windows: %LOCALAPPDATA%\Voyage\Saved\SaveGames\&lt;steamid&gt;\</span>
          </>
        )}
      </label>

      <section className="panel">
        <div className="panel-head">
          <h2>Saves found on this computer</h2>
          <button className="btn btn-primary" onClick={ctx.importLatest} disabled={ctx.importing || !saves?.saves.length}>Load latest</button>
        </div>
        {!saves ? <Spinner /> : saves.saves.length ? (
          <table className="table">
            <thead><tr><th>File</th><th>Folder</th><th>Modified</th><th /></tr></thead>
            <tbody>
              {saves.saves.slice(0, 15).map((s) => (
                <tr key={s.path}>
                  <td>{s.name}</td>
                  <td className="muted small">{s.folder}</td>
                  <td title={s.modified}>{timeAgo(s.modified)}</td>
                  <td className="num">
                    <button className="btn btn-small" disabled={ctx.importing} onClick={() => ctx.runImport(() => api.post('/api/import/file', { path: s.path }))}>
                      Import
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>
            No saves found{saves.dirs.length ? ` in ${saves.dirs.join(', ')}` : ''}. Set the save folder in{' '}
            <a href="#/data/settings">Data → Settings</a>, or drop a file above.
          </Empty>
        )}
      </section>

      {last && <ImportResult last={last} ctx={ctx} />}
    </div>
  );
}

function ImportResult({ last, ctx }) {
  const unmapped = Object.entries(last.unmapped ?? {});
  const nutrients = Object.entries(last.nutrients ?? {});
  const bySource = {};
  for (const s of last.sources ?? []) {
    const k = s.category === 'player' ? s.name : s.kind === 'Storage box' ? `Storage: ${s.name}` : s.kind;
    bySource[k] = (bySource[k] ?? 0) + s.count;
  }
  const unverified = ctx.memories.filter((m) => m.unverified && ctx.inventory.memory[m.id]);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Last import</h2>
        <span className="muted small">{last.source?.name} · imported {timeAgo(last.importedAt)}</span>
      </div>
      <div className="stats-row">
        <Stat label="Memories" value={last.memories} sub={`${last.memoryTypes} kinds`} />
        <Stat label="Foods" value={last.foods} sub={`${last.foodTypes} kinds`} />
        <Stat label="Game saved" value={timeAgo(last.meta?.savedAt)} sub={last.meta?.savedAt ? new Date(last.meta.savedAt * 1000).toLocaleString() : ''} />
        <Stat label="Build" value={last.meta?.build ?? '?'} sub={`${last.meta?.compressor} · UE ${last.meta?.engine}`} />
      </div>

      {unmapped.length > 0 ? (
        <div className="callout callout-warn">
          <strong>Unknown items in the save</strong> (not in the database, so not counted):
          <ul>{unmapped.map(([n, q]) => <li key={n}><code>{n}</code> ×{q}</li>)}</ul>
          Add them in <a href="#/data/memories">Data</a> with this internal name to count them.
        </div>
      ) : (
        <div className="callout callout-good small">Every memory and food in the save is in the database.</div>
      )}
      {unverified.length > 0 && (
        <div className="callout small">
          You own memories with unverified stats: {unverified.map((m) => m.name).join(', ')}. They're ignored by the solver
          until you <a href="#/data/memories">enter their stats</a>.
        </div>
      )}

      <div className="two-col">
        <div>
          <h3>Where they are</h3>
          <table className="table">
            <tbody>
              {Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <tr key={k}><td>{k}</td><td className="num">{v}</td></tr>
              ))}
            </tbody>
          </table>
          {last.excludedWorldLoot > 0 && (
            <p className="muted small">{last.excludedWorldLoot} memories/foods lying loose in the world were not counted.</p>
          )}
        </div>
        <div>
          <h3>Nutrients in stock</h3>
          {nutrients.length ? (
            <table className="table">
              <tbody>{nutrients.map(([n, q]) => <tr key={n}><td>{pretty(n)}</td><td className="num">{q}</td></tr>)}</tbody>
            </table>
          ) : <p className="muted small">None found.</p>}
        </div>
      </div>
      {last.humans?.length > 0 && (
        <p className="small">
          {last.humans.length} grown human{last.humans.length === 1 ? '' : 's'} recorded in this save. See <a href="#/grown">Grown</a>.{' '}
          <Badge tone="muted">read-only</Badge>
        </p>
      )}
    </section>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="muted small">{sub}</div>}
    </div>
  );
}
