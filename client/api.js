// The planner runs entirely in the browser: requests go to the in-page API (client/local/server.js).
import { createLocalApi } from './local/server.js';
import { Store } from './local/store.js';
import { compute } from './local/compute.js';
import * as folder from './local/folder.js';

const handle = createLocalApi({ store: new Store(), compute, folder });

async function request(method, url, body) {
  try {
    return await handle(method, url, body);
  } catch (err) {
    // A dismissed folder picker is not an error worth showing.
    if (err?.name === 'AbortError') throw Object.assign(new Error('Cancelled'), { cancelled: true });
    throw err;
  }
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
  upload: (file) => request('UPLOAD', '/api/import/upload', file),
};

export { folderSupported } from './local/folder.js';
