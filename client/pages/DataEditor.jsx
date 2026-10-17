import React, { useEffect, useRef, useState } from 'react';
import {
  ALL_ATTRS, COMPARE_TYPES, DEFAULT_SETTINGS, FOOD_ATTRS, MEMORY_ATTRS, NUTRIENTS, pretty,
} from '../../shared/rules.js';
import { api } from '../api.js';
import { navigate } from '../App.jsx';
import { Badge, Empty, StatChips, Tabs, TierBadge } from '../components/ui.jsx';

const TABLES = {
  memories: { label: 'Memories', title: 'name', attrs: MEMORY_ATTRS, extra: [] },
  foods: { label: 'Foods', title: 'name', attrs: FOOD_ATTRS, extra: NUTRIENTS },
  professions: { label: 'Professions', title: 'profession', attrs: ALL_ATTRS, extra: [] },
};

export default function DataEditor({ ctx, tab = 'memories' }) {
  const current = TABLES[tab] || tab === 'settings' ? tab : 'memories';
  return (
    <div className="page data-page">
      <div className="page-head">
        <h1>Data</h1>
        <Tabs
          tabs={[...Object.entries(TABLES).map(([value, t]) => ({ value, label: t.label, count: ctx[value].length })), { value: 'settings', label: 'Settings' }]}
          value={current}
          onChange={(v) => navigate(`/data/${v}`)}
        />
      </div>
      {current === 'settings' ? <Settings ctx={ctx} /> : <TableEditor key={current} ctx={ctx} table={current} />}
    </div>
  );
}

function TableEditor({ ctx, table }) {
  const cfg = TABLES[table];
  const rows = ctx[table];
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(rows[0]?.id ?? null);
  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => !q || String(r[cfg.title]).toLowerCase().includes(q) || String(r.internal_name ?? '').toLowerCase().includes(q));
  const row = rows.find((r) => r.id === selected);

  const create = async () => {
    const blank = table === 'professions'
      ? { profession: 'New profession', tier: 1, category: 'Other', requirement_types: {} }
      : { name: `New ${table === 'memories' ? 'memory' : 'food'}`, item_weight: 1, unverified: 1, tier: 1 };
    try {
      const r = await api.post(`/api/${table}`, blank);
      await ctx.reload();
      setSelected(r.id);
    } catch (e) {
      ctx.notify(e.message, 'bad');
    }
  };

  return (
    <div className="editor">
      <div className="panel editor-list">
        <div className="toolbar">
          <input className="input grow" type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn" onClick={create}>+ Add</button>
        </div>
        <ul className="list">
          {visible.map((r) => (
            <li key={r.id}>
              <button className={r.id === selected ? 'active' : ''} onClick={() => setSelected(r.id)}>
                <span className="list-title">
                  {table === 'professions' && <TierBadge tier={r.tier} />} {r[cfg.title]}
                  {r.unverified && <Badge tone="warn">unverified</Badge>}
                </span>
                {table === 'professions'
                  ? <span className="muted small">{r.category}</span>
                  : <StatChips item={r} attrs={cfg.attrs} limit={4} />}
              </button>
            </li>
          ))}
          {!visible.length && <Empty>No rows.</Empty>}
        </ul>
      </div>
      <div className="panel editor-form">
        {row ? <RowForm key={row.id} ctx={ctx} table={table} row={row} onDeleted={() => setSelected(null)} /> : <Empty>Select a row to edit.</Empty>}
      </div>
    </div>
  );
}

function RowForm({ ctx, table, row, onDeleted }) {
  const cfg = TABLES[table];
  const [draft, setDraft] = useState(row);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(row), [row]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(row);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setType = (attr, type) => setDraft((d) => {
    const types = { ...(d.requirement_types ?? {}) };
    if (type) types[attr] = type; else delete types[attr];
    return { ...d, requirement_types: types };
  });

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/api/${table}/${row.id}`, draft);
      await ctx.reload();
      ctx.notify('Saved', 'good');
    } catch (e) {
      ctx.notify(e.message, 'bad');
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${row[cfg.title]}?`)) return;
    try {
      await api.del(`/api/${table}/${row.id}`);
      onDeleted();
      await ctx.reload();
    } catch (e) {
      ctx.notify(e.message, 'bad');
    }
  };

  const num = (k, step = 1) => (
    <input className="input" type="number" step={step} value={draft[k] ?? 0} onChange={(e) => set(k, e.target.value === '' ? 0 : Number(e.target.value))} />
  );

  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="form-grid">
        <label className="field wide">
          <span>{table === 'professions' ? 'Profession' : 'Name'}</span>
          <input className="input" value={draft[cfg.title] ?? ''} onChange={(e) => set(cfg.title, e.target.value)} />
        </label>
        <label className="field wide">
          <span>Internal name(s) <span className="muted small">comma-separated save names, e.g. DA_Memory_Toy</span></span>
          <input className="input mono" value={draft.internal_name ?? ''} onChange={(e) => set('internal_name', e.target.value)} />
        </label>
        {table !== 'professions' && <label className="field"><span>Weight (kg)</span>{num('item_weight', 0.05)}</label>}
        {table !== 'memories' && <label className="field"><span>Tier</span>{num('tier')}</label>}
        {table === 'professions' && (
          <label className="field"><span>Category</span><input className="input" value={draft.category ?? ''} onChange={(e) => set('category', e.target.value)} /></label>
        )}
        {table !== 'professions' && (
          <label className="field check-field">
            <input type="checkbox" checked={Boolean(draft.unverified)} onChange={(e) => set('unverified', e.target.checked)} />
            <span>Unverified stats (solver ignores it while all stats are 0)</span>
          </label>
        )}
      </div>

      <h3>{table === 'professions' ? 'Requirements' : 'Stats'}</h3>
      <div className="attr-grid">
        {cfg.attrs.map((a) => (
          <label key={a} className="field">
            <span>{pretty(a)}</span>
            {num(a, 0.5)}
            {table === 'professions' && (
              <select className="input" value={draft.requirement_types?.[a] ?? ''} onChange={(e) => setType(a, e.target.value)}>
                <option value="">{Number(draft[a]) ? 'Greater (default)' : 'not required'}</option>
                {COMPARE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </label>
        ))}
      </div>
      {cfg.extra.length > 0 && (
        <>
          <h3>Nutrient cost to craft</h3>
          <div className="attr-grid">
            {cfg.extra.map((a) => <label key={a} className="field"><span>{pretty(a)}</span>{num(a, 0.5)}</label>)}
          </div>
        </>
      )}
      {table !== 'professions' && (
        <label className="field wide">
          <span>Description</span>
          <textarea className="input" rows={2} value={draft.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </label>
      )}
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="btn" type="button" disabled={!dirty} onClick={() => setDraft(row)}>Revert</button>
        <button className="btn btn-danger push-right" type="button" onClick={remove}>Delete</button>
      </div>
    </form>
  );
}

function Settings({ ctx }) {
  const initial = ctx.settings;
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setIn = (group, k, v) => setDraft((d) => ({ ...d, [group]: { ...d[group], [k]: v } }));

  const save = async () => {
    try {
      await api.put('/api/settings', draft);
      await ctx.reload();
      ctx.notify('Settings saved', 'good');
    } catch (e) {
      ctx.notify(e.message, 'bad');
    }
  };
  const resetSettings = async () => {
    if (!window.confirm('Reset rule settings to defaults?')) return;
    await api.del('/api/settings');
    await ctx.reload();
  };
  const resetData = async () => {
    if (!window.confirm('Reload memories, foods and professions from data/source? Your edits to them will be lost. Inventory and the grown log are kept.')) return;
    await api.post('/api/reset-data');
    await ctx.reload();
    ctx.notify('Data reloaded from source', 'good');
  };
  const n = (v) => (v === '' ? 0 : Number(v));
  const fileInput = useRef(null);
  // Everything lives in this browser's storage, so a backup file is the only way to move or keep it.
  const exportBackup = async () => {
    try {
      const doc = await api.get('/api/backup');
      const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `caretaker-planner-${new Date().toISOString().slice(0, 10)}.json` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      ctx.notify(`Couldn't export a backup: ${e.message}`, 'bad');
    }
  };
  const importBackup = async (file) => {
    if (!file) return;
    try {
      if (!window.confirm(`Replace everything in the planner with "${file.name}"?`)) return;
      await api.post('/api/backup', JSON.parse(await file.text()));
      await ctx.reload();
      ctx.notify('Backup restored', 'good');
    } catch (e) {
      ctx.notify(`Couldn't restore the backup: ${e.message}`, 'bad');
    } finally {
      fileInput.current.value = '';
    }
  };

  return (
    <div className="panel settings">
      <form className="form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <h3>Diminishing returns</h3>
        <p className="muted small">Effective value = raw if raw ≤ threshold, else threshold + (raw − threshold)^power.</p>
        <div className="form-grid">
          <label className="field"><span>Soft cap threshold</span><input className="input" type="number" value={draft.drThreshold} onChange={(e) => set('drThreshold', n(e.target.value))} /></label>
          <label className="field"><span>Power</span><input className="input" type="number" step="0.05" value={draft.drPower} onChange={(e) => set('drPower', n(e.target.value))} /></label>
          <label className="field"><span>Minimum</span><input className="input" type="number" value={draft.drMin} onChange={(e) => set('drMin', n(e.target.value))} /></label>
        </div>

        <h3>Baselines</h3>
        <p className="muted small">Always required. "Add" matches the old site's cards (requirement + baseline); "max" matches its solver. Not yet verified in game.</p>
        <div className="form-grid">
          {Object.keys(DEFAULT_SETTINGS.baselines).map((a) => (
            <label key={a} className="field"><span>{pretty(a)}</span><input className="input" type="number" value={draft.baselines[a]} onChange={(e) => setIn('baselines', a, n(e.target.value))} /></label>
          ))}
          <label className="field">
            <span>Mode</span>
            <select className="input" value={draft.baselineMode} onChange={(e) => set('baselineMode', e.target.value)}>
              <option value="add">Add (requirement + baseline)</option>
              <option value="max">Max (larger of the two)</option>
            </select>
          </label>
        </div>

        <h3>Pod & planner</h3>
        <div className="form-grid">
          <label className="field"><span>Pod capacity (kg)</span><input className="input" type="number" value={draft.podCapacity} onChange={(e) => set('podCapacity', n(e.target.value))} /></label>
          <label className="field"><span>"Close" when coverage ≥</span><input className="input" type="number" step="0.05" min="0" max="1" value={draft.closeThreshold} onChange={(e) => set('closeThreshold', n(e.target.value))} /></label>
        </div>

        <h3>Gathering cost</h3>
        <p className="muted small">Time to gather one unit of each nutrient, relative to seaweed. Everything can be gathered again, so the craft planner picks the foods that take the least gathering in total. Nutrients in stock and foods you own count at the same cost, so they aren't spent on humans that cheaper foods cover.</p>
        <div className="attr-grid">
          {NUTRIENTS.map((k) => (
            <label key={k} className="field"><span>{pretty(k)}</span><input className="input" type="number" step="0.5" value={draft.nutrientCost[k]} onChange={(e) => setIn('nutrientCost', k, n(e.target.value))} /></label>
          ))}
        </div>

        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={!dirty}>Save settings</button>
          <button className="btn" type="button" onClick={resetSettings}>Defaults</button>
          <button className="btn btn-danger push-right" type="button" onClick={resetData}>Reload game data from source</button>
        </div>
      </form>

      <h3>Backup</h3>
      <p className="muted small">The planner keeps your data, edits and grown log in this browser only. Export a backup to keep it or move it to another browser.</p>
      <div className="actions">
        <button className="btn" type="button" onClick={exportBackup}>Export backup</button>
        <button className="btn" type="button" onClick={() => fileInput.current.click()}>Import backup…</button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden aria-label="Backup file" onChange={(e) => importBackup(e.target.files[0])} />
      </div>
    </div>
  );
}
