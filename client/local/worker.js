// Heavy work off the main thread: save decoding (175 MB of GVAS for a beta save) and the solver.
import highsWasm from 'highs/runtime?url';

// shared/milp.js reads this when it loads HiGHS, so set it before importing the solver.
globalThis.HIGHS_LOADER_OPTIONS = { locateFile: () => highsWasm };

const solver = import('../../shared/solver.js');
const council = import('../../shared/council.js');
const save = import('../../shared/save/items.js');

self.onmessage = async ({ data: { id, op, args } }) => {
  try {
    let result;
    if (op === 'extract') result = (await save).extractSave(new Uint8Array(args.bytes));
    else if (op === 'overview') result = (await solver).overview(args);
    else if (op === 'solve') result = (await solver).solve(args);
    else if (op === 'council') result = (await council).planCouncil(args);
    else throw new Error(`Unknown op ${op}`);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err?.message ?? String(err) });
  }
};
