#!/usr/bin/env node
import { observeRpc, reconcileObservations } from './verify.mjs';

function argsOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || !argv[i + 1]) throw new Error('Expected --key value');
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

async function main() {
  const options = argsOf(process.argv.slice(2));
  for (const name of ['rpc', 'genesis', 'program', 'receipt', 'config', 'vault', 'mint', 'scope']) {
    if (!options[name]) throw new Error(`Missing --${name}`);
  }
  const expected = Object.fromEntries(['program', 'receipt', 'config', 'vault', 'mint', 'scope'].map(k => [k, options[k]]));
  const first = await observeRpc({ rpcUrl: options.rpc, expected, genesisHash: options.genesis });
  const evidence = options.rpc2
    ? reconcileObservations(first, await observeRpc({ rpcUrl: options.rpc2, expected, genesisHash: options.genesis }))
    : first;
  console.log(JSON.stringify(evidence, null, 2));
  console.error('OBSERVATION ONLY: every receipt is refundable and creditEligible is false.');
}
main().catch(e => { console.error(`FAIL CLOSED: ${e.message}`); process.exitCode = 1; });
