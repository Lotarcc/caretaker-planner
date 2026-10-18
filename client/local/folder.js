// Save folder access via the File System Access API (Chrome, Edge, Opera).
// The folder the user picks once is remembered in IndexedDB. Later visits reuse it: if the browser
// still grants read access ("Allow on every visit"), the newest save loads without any prompt;
// otherwise one click re-grants access.

const DB_NAME = 'caretaker-planner';
const STORE = 'handles';
const KEY = 'saveDir';

// World saves are <steamid>_<slot>.sav or <steamid>_AutoSave_<n>.sav. The same folder holds
// EnhancedInputUserSettings.sav (key bindings), which is newest whenever controls were changed.
export const isGameSave = (name) => /^\d+_(?:AutoSave_)?\d+\.sav$/i.test(name);

/** The most recently modified world save among picked files, or null. */
export function newestSave(files) {
  return [...files].filter((f) => isGameSave(f.name)).sort((a, b) => b.lastModified - a.lastModified)[0] ?? null;
}

export const folderSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => { open.result.close(); resolve(req?.result); };
      tx.onerror = () => { open.result.close(); reject(tx.error); };
    };
  });
}

export async function getSavedFolder() {
  if (!folderSupported()) return null;
  try { return (await idb('readonly', (s) => s.get(KEY))) ?? null; } catch { return null; }
}

export async function forgetFolder() {
  try { await idb('readwrite', (s) => s.delete(KEY)); } catch { /* ignore */ }
}

/** 'granted' | 'prompt' | 'denied' */
export async function folderPermission(handle, { request = false } = {}) {
  const opts = { mode: 'read' };
  let state = await handle.queryPermission(opts);
  if (state === 'prompt' && request) state = await handle.requestPermission(opts);
  return state;
}

/** Must be called from a user gesture (click). */
export async function pickFolder() {
  const handle = await window.showDirectoryPicker({ id: 'caretaker-saves', mode: 'read', startIn: 'documents' });
  await idb('readwrite', (s) => s.put(handle, KEY));
  return handle;
}

/** All world saves in the folder or one level down (the game keeps them in <steamid>/), newest first. */
export async function listSaves(dir) {
  const out = [];
  const scan = async (d, depth, folder) => {
    for await (const entry of d.values()) {
      if (entry.kind === 'directory' && depth > 0) await scan(entry, depth - 1, entry.name);
      else if (entry.kind === 'file' && isGameSave(entry.name)) {
        const file = await entry.getFile();
        out.push({ path: folder ? `${folder}/${entry.name}` : entry.name, name: entry.name, folder: folder ?? dir.name,
          size: file.size, modified: new Date(file.lastModified).toISOString(), file });
      }
    }
  };
  await scan(dir, 1, null);
  out.sort((a, b) => b.modified.localeCompare(a.modified));
  return out;
}
