// Runs solver and save-decoding jobs in Web Workers.
// The solver worker stays alive; each save extraction gets its own worker, which is then
// terminated to give back the memory a large save needs.

function spawn() {
  return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}

function rpc(worker) {
  let seq = 0;
  const pending = new Map();
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id);
    if (!p) return;
    pending.delete(data.id);
    if (data.error) p.reject(new Error(data.error));
    else p.resolve(data.result);
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'Worker failed'));
    pending.clear();
  };
  return (op, args, transfer = []) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, op, args }, transfer);
  });
}

let solverCall = null;
const solverWorker = () => (solverCall ??= rpc(spawn()));

export const compute = {
  overview: (input) => solverWorker()('overview', input),
  solve: (input) => solverWorker()('solve', input),
  council: (input) => solverWorker()('council', input),
  async extract(bytes) {
    const worker = spawn();
    try {
      return await rpc(worker)('extract', { bytes }, [bytes]);
    } finally {
      worker.terminate();
    }
  },
};
