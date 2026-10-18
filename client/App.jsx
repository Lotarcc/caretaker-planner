import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, newestSave } from './api.js';
import Planner from './pages/Planner.jsx';
import Profession from './pages/Profession.jsx';
import ImportPage from './pages/Import.jsx';
import DataEditor from './pages/DataEditor.jsx';
import Grown from './pages/Grown.jsx';
import Committees from './pages/Committees.jsx';
import { Spinner, timeAgo } from './components/ui.jsx';

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/');
  useEffect(() => {
    const on = () => setHash(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export const navigate = (to) => { window.location.hash = to; };

const POD_KEY = 'caretaker.pod';
function loadPod() {
  try { return JSON.parse(localStorage.getItem(POD_KEY)) ?? { memory: {}, food: {} }; } catch { return { memory: {}, food: {} }; }
}

export default function App() {
  const route = useHashRoute();
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [overviewBusy, setOverviewBusy] = useState(false);
  const [pod, setPodState] = useState(loadPod);
  const [toast, setToast] = useState(null);
  const [importing, setImporting] = useState(false);
  const overviewSeq = useRef(0);

  const notify = useCallback((message, tone = 'info') => {
    setToast({ message, tone, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const reload = useCallback(async () => {
    try {
      setState(await api.get('/api/state'));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  // After the first load, pull in the newest save when the browser still grants access to the save folder.
  useEffect(() => {
    reload().then(async () => {
      try {
        const auto = await api.post('/api/import/auto');
        if (!auto.imported) return;
        await reload();
        notify(`Loaded your newest save: ${auto.result.memories} memories and ${auto.result.foods} foods`, 'good');
      } catch (err) {
        notify(`Couldn't load the newest save: ${err.message}`, 'bad');
      }
    });
  }, [reload, notify]);

  // Overview (status per profession) depends on inventory, data and settings; refresh with a short debounce.
  const overviewKey = state ? JSON.stringify([state.inventory, state.settings, state.memories, state.foods, state.professions]) : '';
  useEffect(() => {
    if (!state) return undefined;
    const seq = ++overviewSeq.current;
    setOverviewBusy(true);
    const t = setTimeout(async () => {
      try {
        const data = await api.get('/api/overview');
        if (seq === overviewSeq.current) setOverview(Object.fromEntries(data.map((o) => [o.id, o])));
      } catch (err) {
        notify(err.message, 'bad');
      } finally {
        if (seq === overviewSeq.current) setOverviewBusy(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [overviewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPod = useCallback((next) => {
    setPodState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      try { localStorage.setItem(POD_KEY, JSON.stringify(value)); } catch { /* ignore */ }
      return value;
    });
  }, []);

  const setInventory = useCallback((inventory) => setState((s) => ({ ...s, inventory })), []);

  const setQty = useCallback(async (kind, id, qty) => {
    setState((s) => ({ ...s, inventory: { ...s.inventory, [kind]: { ...s.inventory[kind], [id]: qty } } }));
    try {
      setInventory(await api.put('/api/inventory', { kind, id, qty }));
    } catch (err) {
      notify(err.message, 'bad');
      reload();
    }
  }, [notify, reload, setInventory]);

  const runImport = useCallback(async (fn) => {
    setImporting(true);
    try {
      const result = await fn();
      await reload();
      notify(`Imported ${result.memories} memories and ${result.foods} foods`, 'good');
      return result;
    } catch (err) {
      if (!err.cancelled) notify(err.message, 'bad');
      return null;
    } finally {
      setImporting(false);
    }
  }, [notify, reload]);

  // With a remembered save folder the browser may still read, load its newest save directly. Otherwise ask for the
  // folder with a plain folder picker: Chrome refuses to open %LOCALAPPDATA% through showDirectoryPicker (system
  // folder), and that picker starts in Documents, so the remembered-folder route can't reach the game's saves.
  const folderInput = useRef(null);
  const importLatest = useCallback(async () => {
    let saves = null;
    try { saves = await api.get('/api/import/saves'); } catch { /* fall back to the picker */ }
    // A remembered folder without saves (Documents, picked by mistake) must not stop the picker from showing.
    const usable = saves?.folder && (saves.permission === 'prompt' || (saves.permission === 'granted' && saves.saves.length > 0));
    if (usable) return runImport(() => api.post('/api/import/latest'));
    folderInput.current?.click();
    return null;
  }, [runImport]);
  const onFolderPicked = useCallback((input) => {
    const newest = newestSave(input.files ?? []);
    input.value = '';
    if (newest) runImport(() => api.upload(newest));
    else notify('No game saves in that folder. Choose SaveGames or the numbered folder inside it.', 'bad');
  }, [runImport, notify]);

  const ctx = useMemo(() => state && ({
    ...state,
    overview,
    overviewBusy,
    pod,
    setPod,
    setQty,
    setInventory,
    reload,
    notify,
    runImport,
    importLatest,
    importing,
    setState,
  }), [state, overview, overviewBusy, pod, setPod, setQty, setInventory, reload, notify, runImport, importLatest, importing]);

  let page;
  if (error && !state) page = <div className="page"><div className="callout callout-bad">The planner couldn't start: {error}</div></div>;
  else if (!ctx) page = <div className="page"><Spinner label="Loading…" /></div>;
  else if (route.startsWith('/p/')) page = <Profession ctx={ctx} id={decodeURIComponent(route.slice(3))} />;
  else if (route === '/import') page = <ImportPage ctx={ctx} />;
  else if (route.startsWith('/data')) page = <DataEditor ctx={ctx} tab={route.split('/')[2]} />;
  else if (route === '/grown') page = <Grown ctx={ctx} />;
  else if (route === '/committees') page = <Committees ctx={ctx} />;
  else page = <Planner ctx={ctx} />;

  const section = route.startsWith('/p/') ? '/' : route.startsWith('/data') ? '/data' : route;
  const last = state?.lastImport;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden="true" />
          Caretaker Planner
        </a>
        <nav className="nav">
          {[['/', 'Planner'], ['/committees', 'Committees'], ['/import', 'Import'], ['/data', 'Data'], ['/grown', 'Grown']].map(([to, label]) => (
            <a key={to} href={`#${to}`} className={section === to ? 'active' : ''}>{label}</a>
          ))}
        </nav>
        <div className="topbar-right">
          {last && (
            <span className="muted small hide-sm" title={last.source?.path ?? last.source?.name}>
              {last.source?.name} · saved {timeAgo(last.meta?.savedAt)}
            </span>
          )}
          <button className="btn btn-primary" onClick={importLatest} disabled={importing || !state}>
            {importing ? 'Importing…' : 'Load latest save'}
          </button>
        </div>
      </header>
      <main>{page}</main>
      <input ref={folderInput} type="file" webkitdirectory="" hidden aria-label="Save folder" onChange={(e) => onFolderPicked(e.target)} />
      {toast && (
        <div key={toast.id} className={`toast toast-${toast.tone}`} role="status" onClick={() => setToast(null)}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
