import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import Planner from './pages/Planner.jsx';
import Profession from './pages/Profession.jsx';
import ImportPage from './pages/Import.jsx';
import DataEditor from './pages/DataEditor.jsx';
import Grown from './pages/Grown.jsx';
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
  useEffect(() => { reload(); }, [reload]);

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
      notify(err.message, 'bad');
      return null;
    } finally {
      setImporting(false);
    }
  }, [notify, reload]);

  const importLatest = useCallback(() => runImport(() => api.post('/api/import/latest')), [runImport]);

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
  if (error && !state) page = <div className="page"><div className="callout callout-bad">Can't reach the server: {error}</div></div>;
  else if (!ctx) page = <div className="page"><Spinner label="Loading…" /></div>;
  else if (route.startsWith('/p/')) page = <Profession ctx={ctx} id={decodeURIComponent(route.slice(3))} />;
  else if (route === '/import') page = <ImportPage ctx={ctx} />;
  else if (route.startsWith('/data')) page = <DataEditor ctx={ctx} tab={route.split('/')[2]} />;
  else if (route === '/grown') page = <Grown ctx={ctx} />;
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
          {[['/', 'Planner'], ['/import', 'Import'], ['/data', 'Data'], ['/grown', 'Grown']].map(([to, label]) => (
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
      {toast && (
        <div key={toast.id} className={`toast toast-${toast.tone}`} role="status" onClick={() => setToast(null)}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
