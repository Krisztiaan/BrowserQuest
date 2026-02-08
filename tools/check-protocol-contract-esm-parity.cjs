#!/usr/bin/env node

const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const protocolCjs = require(path.join(repoRoot, 'shared/js/protocol-contract.js'));

const NUMERIC_KEYS = [
  'MSG_HELLO',
  'MSG_WELCOME',
  'MSG_SPAWN',
  'MSG_MOVE',
  'MSG_LOOTMOVE',
  'MSG_ATTACK',
  'MSG_HIT',
  'MSG_CHAT',
  'MSG_DAMAGE',
  'MSG_LIST',
  'MSG_WHO',
  'MSG_ZONE',
  'ENTITY_CLOTH_ARMOR',
  'ENTITY_SWORD_1',
];

function fail(message) {
  console.error(`protocol-contract-esm-parity-check: ${message}`);
  process.exit(1);
}

async function main() {
  const protocolEsmModule = await import(path.join(repoRoot, 'shared/js/protocol-contract-esm.mjs'));
  const protocolEsm = protocolEsmModule.default;

  for (const key of NUMERIC_KEYS) {
    if (protocolEsm[key] !== protocolCjs[key]) {
      fail(`numeric key mismatch for ${key}: esm=${String(protocolEsm[key])} cjs=${String(protocolCjs[key])}`);
    }
  }

  if (typeof protocolEsm.parseProtocolActionBatch !== 'function') {
    fail('missing function parseProtocolActionBatch in ESM contract');
  }

  const samples = ['[4,10,20]', '[[4,10,20],[11,"hi"]]', '{"action":"move"}', '{"bad":'];
  for (const sample of samples) {
    const esmResult = protocolEsm.parseProtocolActionBatch(sample);
    const cjsResult = protocolCjs.parseProtocolActionBatch(sample);
    if (JSON.stringify(esmResult) !== JSON.stringify(cjsResult)) {
      fail(`parseProtocolActionBatch mismatch for sample ${JSON.stringify(sample)}`);
    }
  }

  console.log('protocol-contract-esm-parity-check: ok (ESM/CJS contracts aligned).');
}

main().catch((error) => {
  fail(error instanceof Error ? error.stack || error.message : String(error));
});
