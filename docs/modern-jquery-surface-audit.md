# Modern ESM jQuery Surface Audit (T-073)

Date: 2026-02-06

## Scope

- Audited direct jQuery usage in the modern ESM runtime (`client/js-esm/**`).
- Focused on direct `jquery` imports and high-risk API patterns (`.bind/.unbind`, heavy selector/event coupling).

## Scan evidence

- `rg -nF "import $ from 'jquery';" client/js-esm`
- `for f in client/js-esm/{app.js,main.js,sprite.js,map.js,gameclient.js,bubble.js}; do rg -oF '$(' "$f" | wc -l; done`
- `for f in client/js-esm/{app.js,main.js,sprite.js,map.js,gameclient.js,bubble.js}; do rg -oF '.bind(' "$f" | wc -l; done`
- `for f in client/js-esm/{app.js,main.js,sprite.js,map.js,gameclient.js,bubble.js}; do rg -oF '.unbind(' "$f" | wc -l; done`

## Initial inventory (T-073 baseline)

| File | Selector calls (`$(`) | Static calls (`$.`) | `.bind` | `.unbind` | Risk | Notes |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `client/js-esm/main.js` | 103 | 0 | 11 | 1 | High | Central UI/input/event wiring and many DOM hooks. |
| `client/js-esm/app.js` | 68 | 0 | 3 | 3 | High | Session/intro UI state and achievement panel interactions. |
| `client/js-esm/bubble.js` | 4 | 0 | 0 | 0 | Medium | Small DOM create/update/remove surface. |
| `client/js-esm/map.js` | 0 | 1 | 0 | 0 | Low | Single `$.get(...)` JSON load call (`client/js-esm/map.js:52`). |
| `client/js-esm/gameclient.js` | 1 | 0 | 0 | 0 | Low | Single selector for connection error class (`client/js-esm/gameclient.js:104`). |
| `client/js-esm/sprite.js` | 0 | 0 | 0 | 0 | Low | Dead jQuery import only (`client/js-esm/sprite.js:2`). |

## Baseline callsite highlights (before T-074..T-078)

- `client/js-esm/sprite.js:2`: `jquery` is imported but no jQuery calls remain.
- `client/js-esm/map.js:52`: uses `$.get(...)` for map JSON load.
- `client/js-esm/gameclient.js:104`: one `$('#container').addClass('error')` call.
- `client/js-esm/bubble.js:21`, `client/js-esm/bubble.js:45`, `client/js-esm/bubble.js:48`, `client/js-esm/bubble.js:49`: small jQuery DOM update/create/remove cluster.
- `client/js-esm/app.js:56`, `client/js-esm/app.js:70`, `client/js-esm/app.js:232`, `client/js-esm/app.js:235`: remaining `.bind/.unbind` migration-risk callsites.
- `client/js-esm/main.js:271`, `client/js-esm/main.js:299`, `client/js-esm/main.js:337`, `client/js-esm/main.js:338`, `client/js-esm/main.js:339`, `client/js-esm/main.js:430`, `client/js-esm/main.js:447`, `client/js-esm/main.js:585`: highest-density `.bind/.unbind` callsites.

## Current remaining surface (after T-083)

- Modern ESM runtime jQuery imports: none (`rg -n "import \\$ from 'jquery';" client/js-esm` has no matches).
- Modern ESM runtime direct jQuery selector calls in `client/js-esm/**/*.js`: none (`rg -nF '$(' client/js-esm` has no matches).
- Legacy AMD runtime remains jQuery-dependent by design and is tracked in `docs/legacy-jquery4-risk-scan.md`.
- Policy guard command: `bun run check:modern-jquery-free` (scans all `client/js-esm/**/*.js`).

## Reduction order and status

1. `T-074` (low-risk quick wins) - `done`
- Removed dead `jquery` import in `client/js-esm/sprite.js`.
- Replaced `client/js-esm/gameclient.js:104` with vanilla DOM class toggle.
- Replaced `client/js-esm/map.js:52` `$.get(...)` with `fetch` + JSON parse path.

2. `T-075` (medium-risk bubble DOM cluster) - `done`
- Replaced `client/js-esm/bubble.js` jQuery create/update/remove operations with DOM APIs while preserving existing selector-string container behavior.

3. `T-076` (high-risk app/main event surface) - `done`
- Migrated remaining jQuery `.bind/.unbind` callsites in `client/js-esm/{app,main}.js` to `.on/.off`.
- Preserved browser parity after migration with full Node 22 verification gates.

4. `T-077` (high-risk selector/event decoupling) - `done`
- Reduced repeated jQuery selector coupling in `client/js-esm/main.js` hot paths:
  - population display updates now use cached DOM references and `textContent` updates.
  - body class updates for death/respawn use `document.body.classList`.
  - intro field reset path kept legacy-safe attribute semantics for `#nameinput`.
- Preserved behavior with browser parity and verify gates after regression fix.

5. `T-078` (high-risk app shell selector decoupling) - `done`
- Reduced high-frequency jQuery selector usage in `client/js-esm/app.js` with DOM helper seams:
  - `showChat` / `hideChat`
  - `toggleButton`
  - `initHealthBar` / `blinkHealthBar`
  - `hideIntro`
  - `togglePopulationInfo`
- Preserved behavior with browser parity and verify gates after changes.

6. `T-079` (remaining app/main selector debt) - `done`
- Reduced selector churn in `client/js-esm/app.js` around overlay/parchment/achievement/message state wiring:
  - achievement/instruction toggles and reset-page transition handling.
  - in-game overlay close/open paths and parchment animation/message animation state.
  - achievement notification/unlock counters with DOM nodes and text updates.
- Preserved behavior with Node 22 browser and verify gates.

7. `T-080` (main runtime event/input selector debt) - `done`
- Reduced selector/event churn in `client/js-esm/main.js`:
  - converted chat input key/focus handlers to DOM event listeners and value/placeholder updates.
  - converted name input tooltip/focus/keypress wiring to DOM event listeners.
  - converted mute/respawn handlers and gameplay body click parchment checks to DOM APIs.
  - replaced focus-state checks (`:focus` + `.size()`) with `document.activeElement`.
- Preserved behavior with Node 22 browser and verify gates.

8. `T-081` (main boot/runtime handler normalization) - `done`
- Normalized remaining selector-heavy boot/runtime clusters in `client/js-esm/main.js`:
  - bar/help/achievement/social/paging handlers now use DOM listeners.
  - boot parchment checks and legal/privacy label toggles now use cached DOM nodes/classList.
  - resized/state boot wiring (`playername`, `playerimage`, `resize-check`) now uses DOM APIs.
- Preserved behavior with Node 22 browser and verify gates.

9. `T-082` (final modern jQuery runtime extraction) - `done`
- Removed residual jQuery runtime usage from `client/js-esm/main.js` and dropped the `jquery` import there.
- Deferred `client/js-esm/app.js` cleanup to T-083 to avoid behavior drift during staged extraction.
- Preserved behavior with Node 22 browser and verify gates.

10. `T-083` (app final jQuery extraction or explicit defer)
- Status: `done`
- Scope: resolve remaining `client/js-esm/app.js` jQuery callsites and finalize modern runtime extraction.
- Outcome:
  - migrated play-button loading watcher to DOM helpers with explicit start-state guard.
  - migrated container offset math to `getBoundingClientRect` + scroll offsets.
  - migrated achievement template/list wiring to DOM clone/event APIs.
  - removed remaining jQuery usage from modern `app.js`.
- Verification: `bun run test:browser:modern:node22` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

11. `T-084` (jQuery-free policy lock)
- Status: `done`
- Scope: codify and guard modern ESM jQuery-free policy (docs + static checks) while preserving legacy AMD compatibility.
- Acceptance criteria: modern runtime no-jQuery expectation is documented and test-guarded.
- Verification: static import/selector scans + modern/legacy verify gates.
- Outcome:
  - added `tools/check-modern-jquery-free.cjs` and wired it into `verify:modern`.
  - expanded static guard coverage from `app/main` only to all modern ESM modules (`client/js-esm/**/*.js`).
  - refreshed support docs to reflect modern runtime jQuery-free policy and gate behavior.

## Regression guards for every batch

- `bun run test:browser:modern:node22`
- `bun run test:browser:legacy:node22`
- `bun run verify:modern:node22`
- `bun run verify:legacy:node22`
