# WebSocket Runtime Migration Decision (Archived)

Original decision date: 2026-02-08  
Superseded state date: 2026-02-09

## Current status

The CJS websocket boundary migration work is complete and retired from active operations.

- Active websocket runtime path is ESM-only.
- Active startup/verify lanes no longer include legacy rollback or legacy verify flows.
- Historical CJS migration details are preserved in commit history and `MODERNIZE.md`.

## Active operator references

- Runtime parity runbook: `docs/websocket-runtime-class-boundary-parity.md`
- Escalation template: `docs/websocket-boundary-escalation-template.md`
- Canonical gate: `bun run verify:modern:node22`
