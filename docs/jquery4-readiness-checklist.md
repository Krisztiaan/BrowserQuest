# jQuery 4 Readiness Checklist

Date: 2026-02-06

Status: completed (upgrade landed on 2026-02-06)

## Goal

Define pass/fail criteria before attempting a `jquery@4` dependency bump.

## Required pre-trial baseline

- `bun run test:modern-browser` is green.
- `bun run verify:modern` is green.
- `bun run verify:legacy` is green.
- No uncaught browser `pageerror` in modern Playwright tests.

## UI behavior lock checks (must stay green in trial)

- Play entry and first session start:
  - `body.started` set and live websocket handshake completes.
- Chat controls:
  - `#chatbutton` toggles active state.
  - `#chatbox` toggles active state.
- Population panel:
  - `#playercount` toggles `#population.visible`.
- In-game scroll controls:
  - `#helpbutton` toggles `body.about` and `#parchment.about`.
  - `#toggle-legal` toggles `body.legal` and `#parchment.legal`.
  - `#toggle-credits` toggles `body.credits` and `#parchment.credits`.
- Protocol parity:
  - Browser protocol tests stay green for `HELLO`, `CHAT`, `MOVE`, `ZONE`, reconnect, `ATTACK`, `HIT`, and `LOOTMOVE`.

## Trial procedure

1. Create a scoped branch for the jQuery bump.
2. Upgrade only jQuery dependency.
3. Run:
   - `bun install`
   - `bun run test:modern-browser`
   - `bun run verify:modern`
   - `bun run verify:legacy`
4. Record all breakages by selector + stack + reproduction step.
5. Decide:
   - proceed with compatibility patches and retain `jquery@4`, or
   - rollback to `3.7.1` and schedule jQuery-surface reduction first.

## Trial result (2026-02-06)

- Outcome: `jquery@4.0.0` retained.
- Gate results:
  - `bun run test:modern-browser`: pass
  - `bun run verify:modern`: pass
  - `bun run verify:legacy`: pass
