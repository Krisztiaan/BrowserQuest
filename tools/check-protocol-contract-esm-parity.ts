import * as path from 'node:path';
import { PROTOCOL_CONTRACT_NUMERIC_KEYS } from '../shared/js/protocol-contract-types';

const repoRoot = path.resolve(import.meta.dir, '..');

function fail(message) {
  console.error(`protocol-contract-esm-parity-check: ${message}`);
  process.exit(1);
}

async function main() {
  const protocolCjsModule = await import(path.join(repoRoot, 'shared/js/protocol-contract'));
  const protocolCjs = (protocolCjsModule.default || protocolCjsModule) as Record<string, unknown>;
  const protocolEsmModule = await import(path.join(repoRoot, 'shared/js/protocol-contract-esm.ts'));
  const protocolEsm = protocolEsmModule.default;

  for (const key of PROTOCOL_CONTRACT_NUMERIC_KEYS) {
    const esmValue = (protocolEsm as Record<string, unknown>)[key];
    const cjsValue = protocolCjs[key];
    if (esmValue !== cjsValue) {
      fail(`numeric key mismatch for ${key}: esm=${String(esmValue)} cjs=${String(cjsValue)}`);
    }
  }

  if (typeof (protocolEsm as Record<string, unknown>).parseProtocolActionBatch !== 'function') {
    fail('missing function parseProtocolActionBatch in ESM contract');
  }
  const parseProtocolActionBatchEsm = (protocolEsm as Record<string, unknown>)
    .parseProtocolActionBatch as (payload: string) => unknown;
  const parseProtocolActionBatchCjs = protocolCjs.parseProtocolActionBatch as (payload: string) => unknown;

  const samples = ['[4,10,20]', '[[4,10,20],[11,"hi"]]', '{"action":"move"}', '{"bad":'];
  for (const sample of samples) {
    const esmResult = parseProtocolActionBatchEsm(sample);
    const cjsResult = parseProtocolActionBatchCjs(sample);
    if (JSON.stringify(esmResult) !== JSON.stringify(cjsResult)) {
      fail(`parseProtocolActionBatch mismatch for sample ${JSON.stringify(sample)}`);
    }
  }

  console.log('protocol-contract-esm-parity-check: ok (ESM/CJS contracts aligned).');
}

main().catch((error) => {
  fail(error instanceof Error ? error.stack || error.message : String(error));
});
