# Websocket Boundary Escalation Template

Use this template when websocket boundary drill checks fail or runtime-mode signals are inconsistent.

## 1) Incident header

- Date/time (UTC):
- Reporter:
- Environment (local/CI run link):
- Severity: `advisory` | `blocking`

## 2) Owner and handoff

- Primary owner (server-runtime maintainer):
- Secondary owner:
- Handoff trigger hit:
  - `test:ws:runtime:decision` failed
  - handshake/protocol smoke failed
  - runtime-mode signal mismatch/missing

## 3) Signal snapshot

- `server.esm.ws_runtime_mode` status/event payload:
- `server.esm.ws_bridge_probe` status/event payload:
- Boundary drill summary artifact path:
  - `ws-boundary-drill-summary-<run_id>/artifacts/ws-boundary-drill-summary.json`

## 4) Failing checks

- Failed command(s):
- Exit code(s):
- Last relevant log lines:

## 5) Rollback command block

```bash
bun run test:ws:runtime:drill
bun run verify:modern:node22
bun run verify:legacy:node22
```

## 6) Resolution notes

- Decision taken:
- Rollback applied: `yes|no`
- Follow-up ticket:
