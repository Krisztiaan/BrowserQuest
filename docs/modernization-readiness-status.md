# Modernization Readiness Status (2026-02-08)

## Delta Update (2026-02-08 client protocol payload TypeScript promotion slice)

### Ticket status

- `T-307.1` Promote client protocol payload helper from JSDoc-typed JS to native TypeScript and keep modern runtime lanes green: `done`
- `T-307.2` Promote low-risk core client modules (`config`, `exceptions`, `timer`) to native TypeScript: `done`
- `T-307.3` Promote low-risk client utility/UI modules (`bubble`, `storage`, `home`) to native TypeScript: `done`
- `T-307.4` Promote rendering-adjacent client modules (`tile`, `camera`, `infomanager`) to native TypeScript: `done`
- `T-307.5` Promote client entity wrapper/data modules (`item`, `items`, `mob`, `mobs`, `npcs`) to native TypeScript: `done`
- `T-307.6` Promote client actor wrappers (`npc`, `warrior`) to native TypeScript with safer NPC dialog fallback: `done`
- `T-307.7` Promote core actor dependency chain (`entity`, `character`, `player`) to native TypeScript with compatibility-safe typing: `done`
- `T-307.8` Promote sprite metadata/render helper modules (`sprite`, `sprites`) to native TypeScript: `done`
- `T-307.9` Promote startup worker/preflight shadow-source modules (`bootstrap`, `preflight`, `mapworker`) to TypeScript while preserving JS runtime entry compatibility: `done`
- `T-307.10` Promote runtime dependency helpers (`entityfactory`, `audio`) to native TypeScript: `done`

### Live progress log

- `2026-02-08T18:10Z` `in_progress` Selected low-risk boundary module conversion to begin full client TypeScriptification.
  - Scope:
    - `client/js-esm/protocol-payload.js` -> `client/js-esm/protocol-payload.ts`
    - Vite bare-import resolver support for `.ts` modules
    - Typecheck lane config updates
  - Out of scope:
    - gameplay loop rewrites
    - broad client module renames in this slice
  - Acceptance criteria:
    - protocol payload helper is native TS.
    - bare import `protocol-payload` resolves in Vite runtime.
    - typecheck/test/build lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client.json`
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:16Z` `done` Completed TS promotion + resolver/config updates and verified all target lanes.
  - Evidence:
    - file promotion: `client/js-esm/protocol-payload.ts`
    - removed JS source: `client/js-esm/protocol-payload.js`
    - updated resolver: `vite.config.ts` now resolves bare `.ts` and `index.ts`
    - updated configs:
      - `tsconfig.typecheck-client.json`
      - `tsconfig.typecheck-client-runtime.json`
      - `tsconfig.typecheck-runtime.json`
    - updated unit import: `tests/unit/client-boundary-types.test.ts`
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass
- `2026-02-08T18:22Z` `done` Completed second low-risk client TS promotion slice and kept runtime/test/build lanes green.
  - Evidence:
    - file promotions:
      - `client/js-esm/config.ts`
      - `client/js-esm/exceptions.ts`
      - `client/js-esm/timer.ts`
    - removed JS sources:
      - `client/js-esm/config.js`
      - `client/js-esm/exceptions.js`
      - `client/js-esm/timer.js`
    - alias/config updates:
      - `tsconfig.typecheck-client-runtime.json` (`config`, `exceptions`, `timer`, `protocol-payload` path updates)
      - `tsconfig.typecheck-runtime.json` (`protocol-payload.ts` include)
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
    - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
    - `bun run build:vite` -> pass
- `2026-02-08T18:24Z` `in_progress` Started third low-risk client TS promotion slice for utility/UI modules with minimal gameplay coupling.
  - Scope:
    - `client/js-esm/bubble.js` -> `client/js-esm/bubble.ts`
    - `client/js-esm/storage.js` -> `client/js-esm/storage.ts`
    - `client/js-esm/home.js` -> `client/js-esm/home.ts`
    - runtime alias/include updates in `tsconfig.typecheck-client-runtime.json`
    - modern entrypoint update in `client/modern.html`
  - Out of scope:
    - gameplay behavior changes
    - server runtime changes
  - Acceptance criteria:
    - selected modules are native TypeScript.
    - runtime/client typecheck lanes remain green.
    - full test/build lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:28Z` `done` Completed third TS promotion slice and verified full modern lane integrity.
  - Evidence:
    - file promotions:
      - `client/js-esm/bubble.ts`
      - `client/js-esm/storage.ts`
      - `client/js-esm/home.ts`
    - removed JS sources:
      - `client/js-esm/bubble.js`
      - `client/js-esm/storage.js`
      - `client/js-esm/home.js`
    - runtime updates:
      - `tsconfig.typecheck-client-runtime.json` path aliases now target `bubble.ts` and `storage.ts`
      - `tsconfig.typecheck-client-runtime.json` include now targets `home.ts`
      - `client/modern.html` module entry now targets `js-esm/home.ts`
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
    - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
    - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
    - `bun run build:vite` -> pass
- `2026-02-08T18:29Z` `in_progress` Started rendering-adjacent TS promotion slice with direct gameplay loop dependencies and runtime callsite validation.
  - Scope:
    - `client/js-esm/tile.js` -> `client/js-esm/tile.ts`
    - `client/js-esm/camera.js` -> `client/js-esm/camera.ts`
    - `client/js-esm/infomanager.js` -> `client/js-esm/infomanager.ts`
    - runtime alias updates in `tsconfig.typecheck-client-runtime.json`
  - Out of scope:
    - protocol changes
    - server runtime changes
  - Acceptance criteria:
    - selected modules are native TypeScript.
    - client-runtime typecheck catches and resolves any callsite type mismatches.
    - full modern verification lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:30Z` `done` Completed rendering-adjacent TS promotion slice and resolved one real runtime-signature mismatch surfaced by stricter typing.
  - Evidence:
    - file promotions:
      - `client/js-esm/tile.ts`
      - `client/js-esm/camera.ts`
      - `client/js-esm/infomanager.ts`
    - removed JS sources:
      - `client/js-esm/tile.js`
      - `client/js-esm/camera.js`
      - `client/js-esm/infomanager.js`
    - runtime updates:
      - `tsconfig.typecheck-client-runtime.json` path aliases now target `tile.ts`, `camera.ts`, `infomanager.ts`
    - type mismatch resolved:
      - widened `InfoManager.addDamageInfo` value shape to `number | string` for existing healed-text callsite usage in `client/js-esm/game.js`.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
    - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
    - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
    - `bun run build:vite` -> pass
- `2026-02-08T18:31Z` `in_progress` Started client entity wrapper/data TS promotion slice focused on low-coupling constructors and loot/mob registries.
  - Scope:
    - `client/js-esm/item.js` -> `client/js-esm/item.ts`
    - `client/js-esm/items.js` -> `client/js-esm/items.ts`
    - `client/js-esm/mob.js` -> `client/js-esm/mob.ts`
    - `client/js-esm/mobs.js` -> `client/js-esm/mobs.ts`
    - `client/js-esm/npcs.js` -> `client/js-esm/npcs.ts`
    - runtime alias updates in `tsconfig.typecheck-client-runtime.json`
  - Out of scope:
    - combat logic rewrites
    - server/runtime protocol changes
  - Acceptance criteria:
    - selected modules are native TypeScript with explicit constructor/method signatures.
    - stricter typing catches and resolves any inheritance/field declaration mismatches.
    - full modern verification lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:32Z` `done` Completed entity wrapper/data TS promotion slice and resolved type-level inheritance/field issues.
  - Evidence:
    - file promotions:
      - `client/js-esm/item.ts`
      - `client/js-esm/items.ts`
      - `client/js-esm/mob.ts`
      - `client/js-esm/mobs.ts`
      - `client/js-esm/npcs.ts`
    - removed JS sources:
      - `client/js-esm/item.js`
      - `client/js-esm/items.js`
      - `client/js-esm/mob.js`
      - `client/js-esm/mobs.js`
      - `client/js-esm/npcs.js`
    - runtime updates:
      - `tsconfig.typecheck-client-runtime.json` path aliases now target promoted TS modules
    - mismatch fixes from stricter typing:
      - aligned `FirePotion.onLoot` override with base `Item.onLoot` contract.
      - declared `Boss.atkRate` class field for explicit TS field safety.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
    - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
    - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
    - `bun run build:vite` -> pass
- `2026-02-08T18:33Z` `in_progress` Started actor-wrapper TS promotion slice for `npc` and `warrior`.
  - Scope:
    - `client/js-esm/npc.js` -> `client/js-esm/npc.ts`
    - `client/js-esm/warrior.js` -> `client/js-esm/warrior.ts`
    - runtime alias updates in `tsconfig.typecheck-client-runtime.json`
    - guard unknown NPC talk keys with typed fallback list
  - Out of scope:
    - player/game loop logic rewrites
    - protocol/server changes
  - Acceptance criteria:
    - `npc` and `warrior` are native TypeScript.
    - NPC dialog lookup is type-safe and resilient for unknown keys.
    - full modern verification lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:34Z` `done` Completed actor-wrapper TS promotion slice with safe NPC dialog fallback and green modern verification lanes.
  - Evidence:
    - file promotions:
      - `client/js-esm/npc.ts`
      - `client/js-esm/warrior.ts`
    - removed JS sources:
      - `client/js-esm/npc.js`
      - `client/js-esm/warrior.js`
    - runtime updates:
      - `tsconfig.typecheck-client-runtime.json` path aliases now target `npc.ts` and `warrior.ts`
    - behavior hardening:
      - `Npc` now resolves dialog lines through a typed helper with `othernpc` fallback when kind mapping is unknown.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass

- `2026-02-08T18:36Z` `in_progress` Started core actor dependency chain TS slice for `entity`, `character`, and `player`.
  - Scope:
    - `client/js-esm/entity.js` -> `client/js-esm/entity.ts`
    - `client/js-esm/character.js` -> `client/js-esm/character.ts`
    - `client/js-esm/player.js` -> `client/js-esm/player.ts`
    - runtime alias updates in `tsconfig.typecheck-client-runtime.json`
  - Out of scope:
    - gameplay mechanic rewrites
    - server/runtime protocol changes
  - Acceptance criteria:
    - core actor dependency chain modules are native TypeScript.
    - conversion preserves existing runtime behavior while keeping typecheck lanes green.
    - full test/build lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:38Z` `done` Completed core actor dependency chain TS slice and validated full modern lanes.
  - Evidence:
    - file promotions:
      - `client/js-esm/entity.ts`
      - `client/js-esm/character.ts`
      - `client/js-esm/player.ts`
    - removed JS sources:
      - `client/js-esm/entity.js`
      - `client/js-esm/character.js`
      - `client/js-esm/player.js`
    - runtime updates:
      - `tsconfig.typecheck-client-runtime.json` aliases now target `entity.ts`, `character.ts`, `player.ts`
    - compatibility hardening from typecheck feedback:
      - widened combat-link surfaces (`target`, attacker graph callbacks) to preserve existing dynamic gameplay contracts consumed by `game.js`.
      - fixed weapon/armor switch timer declaration safety in `player.ts`.
      - typed checkpoint shape in `player.ts` to match runtime `checkpoint.id` usage.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass
- `2026-02-08T18:40Z` `in_progress` Started sprite-layer TS slice for metadata and image processing helpers.
  - Scope:
    - `client/js-esm/sprite.js` -> `client/js-esm/sprite.ts`
    - `client/js-esm/sprites.js` -> `client/js-esm/sprites.ts`
    - runtime alias updates in `tsconfig.typecheck-client-runtime.json`
  - Out of scope:
    - renderer/gameplay orchestration changes
    - map/render loop rewrites
  - Acceptance criteria:
    - sprite helper modules are native TS.
    - image-processing paths remain runtime-compatible.
    - typecheck/test/build lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:43Z` `done` Completed sprite-layer TS slice and startup helper TS slice with JS runtime compatibility guardrails.
  - Evidence:
    - file promotions:
      - `client/js-esm/sprite.ts`
      - `client/js-esm/sprites.ts`
      - `client/js-esm/bootstrap.ts`
      - `client/js-esm/preflight.ts`
      - `client/js-esm/mapworker.ts`
    - runtime alias/config updates:
      - `tsconfig.typecheck-client-runtime.json` aliases now target `sprite.ts` and `sprites.ts`
      - `tsconfig.typecheck-client-runtime.json` includes target promoted startup helper TS files
    - compatibility adjustments:
      - restored JS runtime entry artifacts for static/direct serving:
        - `client/js-esm/bootstrap.js`
        - `client/js-esm/preflight.js`
        - `client/js-esm/mapworker.js`
      - restored runtime references to JS entry artifacts:
        - `client/modern.html` uses `js-esm/preflight.js`
        - `client/js-esm/home.ts` imports `./bootstrap.js`
        - `client/js-esm/map.js` worker URL targets `./mapworker.js`
      - smoke regression fixed:
        - `tests/smoke/static-server-entry-default.test.ts` passes after restoring JS preflight entry contract.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass
- `2026-02-08T18:44Z` `in_progress` Started runtime dependency helper TS slice for entity construction and audio orchestration.
  - Scope:
    - `client/js-esm/entityfactory.js` -> `client/js-esm/entityfactory.ts`
    - `client/js-esm/audio.js` -> `client/js-esm/audio.ts`
    - runtime alias/include updates in `tsconfig.typecheck-client-runtime.json`
  - Out of scope:
    - renderer/game loop migration
    - websocket protocol/runtime changes
  - Acceptance criteria:
    - selected runtime helper modules are native TypeScript.
    - entity construction and audio behavior remain parity-safe.
    - full typecheck/test/build lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:45Z` `done` Completed runtime helper TS slice with parity-safe fixes and green verification lanes.
  - Evidence:
    - file promotions:
      - `client/js-esm/entityfactory.ts`
      - `client/js-esm/audio.ts`
    - removed JS sources:
      - `client/js-esm/entityfactory.js`
      - `client/js-esm/audio.js`
    - runtime updates:
      - `tsconfig.typecheck-client-runtime.json` aliases now target `entityfactory.ts` and `audio.ts`
      - `tsconfig.typecheck-client-runtime.json` include now targets `entityfactory.ts`
    - compatibility fixes:
      - aligned chest factory constructor call (`new Chest(id, Types.Entities.CHEST)`) with current class signature.
      - preserved dynamic audio runtime behavior while adding typed fade interval guards.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass

## Delta Update (2026-02-08 asset restoration slice)

### Ticket status

- `T-308.1` Restore missing music assets from BrowserQuestKit source snapshot and verify runtime build integrity: `done`

### Live progress log

- `2026-02-08T18:18Z` `in_progress` Pulled source assets from `tnantoka/BrowserQuestKit` at commit `5bd49fe2a99c4bcb49466fb03095191fee14db6b` and audited available media folders.
  - Evidence:
    - `/tmp/BrowserQuestKit/BrowserQuestKit/Assets/music/*.mp3` present
    - `/tmp/BrowserQuestKit/BrowserQuestKit/Assets/sounds/*.mp3` present
  - Next action: copy missing music into local runtime asset tree.
- `2026-02-08T18:19Z` `done` Restored music assets and verified build.
  - Evidence:
    - added files under `client/audio/music/`:
      - `village.mp3`, `beach.mp3`, `forest.mp3`, `cave.mp3`, `desert.mp3`, `lavaland.mp3`, `boss.mp3`
    - `bun run build:vite` -> pass
    - post-copy asset audit: all configured sound effects and mp3 music tracks present; only optional `client/audio/music/*.ogg` fallbacks remain absent (upstream snapshot provides mp3 only).

## Delta Update (2026-02-08 CJS runtime header idioms slice)

### Ticket status

- `T-306.2` Modernize authored CJS TypeScript shadow-source headers from legacy multi-`var` require chains to idiomatic `const` imports: `done`
- `T-306.3` Add regression guard to prevent `var ... = require(...)` reintroduction in authored `*.cts` runtime sources: `done`

### Live progress log

- `2026-02-08T16:14Z` `in_progress` Selected runtime lane modules with remaining pre-ES2015 header idioms and low behavior risk.
  - Scope:
    - `server/js/player.cts`
    - `server/js/ws.cts`
    - `server/js/worldserver.cts`
  - Out of scope:
    - gameplay logic changes
    - protocol/transport behavior changes
  - Acceptance criteria:
    - headers use per-module `const require(...)` declarations (no comma-chained multi-`var` import block).
    - generated runtime artifacts stay in sync.
    - full modern verification lane remains green.
  - Verification plan:
    - `bun run build:player`
    - `bun run build:ws-module`
    - `bun run build:worldserver`
    - `bun run verify:modern:node22`
- `2026-02-08T16:17Z` `done` Completed header modernization for selected modules and verified runtime parity.
  - Evidence:
    - updated source headers:
      - `server/js/player.cts`
      - `server/js/ws.cts`
      - `server/js/worldserver.cts`
    - regenerated artifacts:
      - `server/js/player.js`
      - `server/js/ws.js`
      - `server/js/worldserver.js`
    - verification:
      - `bun run build:player` -> pass
      - `bun run build:ws-module` -> pass
      - `bun run build:worldserver` -> pass
      - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass)
- `2026-02-08T16:19Z` `done` Added and enforced `*.cts` require-style guard in default modern verification lane.
  - Evidence:
    - added `tools/check-cts-require-const.cjs`
    - updated `package.json`:
      - new script: `check:cts-require-const`
      - `verify:modern` now runs `check:cts-require-const`
    - `bun run check:cts-require-const` -> pass
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass)

## Delta Update (2026-02-08 startup asset pressure reduction slice)

### Ticket status

- `T-306.1` Reduce startup sprite pressure by loading only the active scale at boot and loading other scales on demand: `done`

### Live progress log

- `2026-02-08T15:58Z` `in_progress` Investigated startup asset pressure report (`~15k`) in modern client boot lane.
  - Evidence:
    - `rg -n "loadSprites|loadMap|loadAudio|new Image\\(|drawImage\\(" client/js-esm -g '*.js'`
    - `sed -n '330,760p' client/js-esm/game.js`
    - `sed -n '1,240p' client/js-esm/map.js`
    - `sed -n '1,220p' client/js-esm/audio.js`
  - Findings:
    - startup boot loads all `67` sprites for multiple scales on desktop (`img/2` + `img/3`), map tileset(s), and audio.
    - perceived `15k` is not literal asset file count; render/decode work and tile draw loops can dominate startup traces.
  - Next action: reduce eager sprite scale fan-out during boot.
- `2026-02-08T16:13Z` `done` Implemented active-scale sprite boot loading with on-demand scale loading in `setSpriteScale`.
  - Evidence:
    - updated `client/js-esm/game.js`:
      - added `loadSpriteForScale(name, scale)` and `loadSpriteScale(scale)`.
      - `loadSprites()` now loads only `renderer.scale` (or `1` in upscaled mode) at boot.
      - `setSpriteScale(scale)` ensures requested scale is loaded lazily before rebinding sprites.
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass).

## Delta Update (2026-02-08 ESM bridge de-require slice)

### Ticket status

- `T-304.1` Remove `createRequire` shims from runtime ESM bridge modules where CJS interop import is sufficient: `done`

### Live progress log

- `2026-02-08T08:03Z` `in_progress` Audited ESM runtime bridge modules and selected low-risk bridge modernization slice.
  - Evidence: `rg -n "createRequire\\(" server/js/*.mjs shared/js/*.mjs`
  - Next action: replace `createRequire` bridge shims with interop-safe ESM imports.
- `2026-02-08T08:10Z` `in_progress` Implemented bridge updates and adjusted ESM parity tests to assert contract shape instead of cross-loader identity.
  - Evidence: focused suite run over `server-main-runtime-esm`, `server-metrics-esm`, protocol/ws-close-code mirrors.
  - Next action: clear strict `typecheck:server-esm` failures from CJS namespace typing.
- `2026-02-08T08:17Z` `done` Added explicit JSDoc contract casts for interop fallbacks and completed full modern verification.
  - Evidence:
    - `bun run typecheck:server-esm` -> pass
    - `bun test tests/unit/server-utils-esm.test.ts tests/unit/protocol-contract-module.test.ts tests/unit/ws-close-codes-contract.test.ts tests/unit/server-main-runtime-esm.test.ts tests/unit/server-metrics-esm.test.ts tests/unit/ws-runtime-class-factory.test.ts tests/unit/server-ws-esm.test.ts --timeout 20000` -> pass
    - `bun run verify:modern:node22` -> pass

### Implemented in this slice

- Removed `createRequire` shims from selected ESM bridge modules and replaced with explicit interop imports:
  - `shared/js/gametypes-esm.mjs`
  - `shared/js/protocol-contract-esm.mjs`
  - `shared/js/ws-close-codes-esm.mjs`
  - `server/js/main-runtime-esm.mjs`
  - `server/js/metrics-esm.mjs`
  - `server/js/metrics-runtime-esm.mjs`
  - `server/js/ws-runtime-class-factory.mjs`
- Promoted `server/js/utils-esm.mjs` to import shared gametypes through the ESM bridge (`shared/js/gametypes-esm.mjs`) instead of direct CJS `require`.
- Updated ESM mirror parity tests to validate API contract consistency across loader boundaries instead of strict object identity:
  - `tests/unit/server-main-runtime-esm.test.ts`
  - `tests/unit/server-metrics-esm.test.ts`

## Delta Update (2026-02-08 doc-policy cleanup slice)

### Ticket status

- `T-305.1` Remove stale active guidance for retired legacy lanes in operator-facing docs: `done`

### Live progress log

- `2026-02-08T08:23Z` `in_progress` Audited `docs/client-build-support.md` for active instructions that still treated retired legacy lanes as current.
  - Evidence: `rg -n "verify:legacy|test:browser:legacy|build:client|build:vite:legacy|verify-legacy" docs/client-build-support.md`
  - Next action: rewrite operational sections to modern-primary posture and explicit retirement notes.
- `2026-02-08T08:27Z` `done` Updated support matrix/CI mapping/change policy wording to align with retired legacy command lanes.
  - Evidence:
    - `rg -n "verify:legacy|test:browser:legacy|build:client|build:vite:legacy|verify-legacy|verify-legacy-browser" README.md docs/runtime-preflight.md docs/client-build-support.md`
    - `docs/client-build-support.md` now marks legacy build/verify/browser lanes as retired instead of active default guidance.

## Delta Update (2026-02-08 ESM startup seam async-import slice)

### Ticket status

- `T-304.2` Remove final `createRequire` usage from `main-esm` startup seam by promoting async CJS interop import contract: `done`

### Live progress log

- `2026-02-08T08:31Z` `in_progress` Traced `main-esm` startup seam (`main-esm` -> startup-runner -> bridge-probe) and identified sync `requireWsCjs` callback as remaining `createRequire` dependency.
  - Evidence: `rg -n "requireWsCjs|createRequire" server/js tests/unit`
  - Next action: promote seam contract to async `importWsCjs`.
- `2026-02-08T08:36Z` `done` Updated startup seam to async import and removed `createRequire` from `server/js/main-esm.mjs`.
  - Evidence:
    - Updated files: `server/js/main-esm.mjs`, `server/js/main-esm-startup-runner.mjs`, `server/js/main-esm-bridge-probe.mjs`.
    - Updated tests: `tests/unit/server-main-esm-startup-runner.test.ts`, `tests/unit/server-main-esm-bridge-probe.test.ts`.
    - `bun test tests/unit/server-main-esm-bridge-probe.test.ts tests/unit/server-main-esm-startup-runner.test.ts tests/unit/server-main-esm-runtime-options.test.ts tests/unit/server-main-esm-boot-envelope.test.ts --timeout 20000` -> pass.
    - `bun run verify:modern:node22` -> pass.
    - `rg -n "createRequire\\(" server/js/*.mjs shared/js/*.mjs` -> no matches.

## Delta Update (2026-02-08 regression guard slice)

### Ticket status

- `T-304.3` Add runtime ESM bridge regression guard against `createRequire` reintroduction: `done`

### Live progress log

- `2026-02-08T08:42Z` `in_progress` Added dedicated guard command for runtime `.mjs` bridge modules.
  - Evidence: `tools/check-runtime-esm-require-free.cjs`.
  - Next action: enforce guard in `verify:modern`.
- `2026-02-08T08:45Z` `done` Wired guard into `verify:modern` and re-verified full modern lane.
  - Evidence:
    - `package.json`: `check:runtime-esm-require-free` added and included in `verify:modern`.
    - `bun run check:runtime-esm-require-free` -> pass.
    - `bun run verify:modern:node22` -> pass.

## Delta Update (2026-02-08 ESM probe decoupling slice)

### Ticket status

- `T-304.4` Remove CJS websocket module import dependency from ESM startup probe seam: `done`

### Live progress log

- `2026-02-08T08:51Z` `in_progress` Refactored startup probe seam to drop `importWsCjs` contract and validate against shared close-code contract.
  - Evidence: updated `server/js/main-esm-bridge-probe.mjs`, `server/js/main-esm-startup-runner.mjs`, `server/js/main-esm.mjs`.
  - Next action: update seam unit tests and rerun startup/bridge smoke coverage.
- `2026-02-08T08:55Z` `done` Updated tests and verified full modern lane.
  - Evidence:
    - `bun test tests/unit/server-main-esm-bridge-probe.test.ts tests/unit/server-main-esm-startup-runner.test.ts tests/unit/server-main-esm-runtime-options.test.ts tests/unit/server-main-esm-boot-envelope.test.ts --timeout 20000` -> pass.
    - `bun test tests/smoke/server-handshake-esm-ws-bridge.test.ts --timeout 20000` -> pass.
    - `bun run verify:modern:node22` -> pass.

## Delta Update (2026-02-08 websocket factory ESM promotion slice)

### Ticket status

- `T-304.5` Promote websocket runtime class factory from CJS-backed ESM wrapper to native ESM implementation: `done`

### Live progress log

- `2026-02-08T09:01Z` `in_progress` Replaced `server/js/ws-runtime-class-factory.mjs` with native ESM implementation (no CJS delegation).
  - Evidence: `server/js/ws-runtime-class-factory.mjs` now exports runtime classes directly.
  - Next action: update boundary decision assertion from cross-loader identity to contract parity.
- `2026-02-08T09:04Z` `done` Updated websocket boundary test posture and re-verified targeted + full modern lanes.
  - Evidence:
    - `tests/unit/ws-runtime-boundary-decision.test.ts` now checks CJS/ESM contract compatibility instead of strict function identity.
    - `bun test tests/unit/ws-runtime-class-factory.test.ts tests/unit/ws-runtime-boundary-decision.test.ts tests/unit/ws-runtime-parity.test.ts tests/unit/server-ws-esm.test.ts tests/smoke/server-handshake-esm-ws-runtime.test.ts tests/smoke/server-handshake-esm-ws-bridge.test.ts --timeout 20000` -> pass.
    - `bun run verify:modern:node22` -> pass.

## Delta Update (2026-02-08 shared-bridge ESM promotion slice)

### Ticket status

- `T-304.6` Promote shared gametypes and ws-close-codes ESM bridges to native ESM contracts: `done`

### Live progress log

- `2026-02-08T09:10Z` `in_progress` Replaced CJS-backed ESM bridges:
  - `shared/js/gametypes-esm.mjs` now sources native ESM contract from `shared/js/gametypes-browser.mjs`.
  - `shared/js/ws-close-codes-esm.mjs` now exports a native ESM close-code contract object.
  - Next action: adjust unit assertions from cross-loader identity to value-contract parity.
- `2026-02-08T09:13Z` `done` Updated parity assertions and re-verified full modern lane.
  - Evidence:
    - Updated tests: `tests/unit/gametypes-contract.test.ts`, `tests/unit/ws-close-codes-contract.test.ts`.
    - `bun test tests/unit/gametypes-contract.test.ts tests/unit/protocol-support-contract.test.ts tests/unit/ws-close-codes-contract.test.ts tests/unit/protocol-contract-module.test.ts tests/smoke/server-payload-guards.test.ts --timeout 20000` -> pass.
    - `bun run verify:modern:node22` -> pass.

## Delta Update (2026-02-08 protocol ESM bridge promotion + guard slice)

### Ticket status

- `T-304.7` Promote `shared/js/protocol-contract-esm.mjs` to native ESM implementation: `done`
- `T-304.8` Add protocol ESM/CJS parity guard and enforce it in `verify:modern`: `done`

### Live progress log

- `2026-02-08T09:19Z` `in_progress` Replaced protocol ESM bridge CJS import with native ESM implementation sourced from `gametypes-esm`.
  - Evidence: `shared/js/protocol-contract-esm.mjs` rewritten with native parser/constant contract.
  - Next action: update protocol type inventory test from function identity to behavior parity.
- `2026-02-08T09:22Z` `in_progress` Added parity guard command and wired into verify lane.
  - Evidence:
    - added `tools/check-protocol-contract-esm-parity.cjs`.
    - `package.json` includes `check:protocol-contract-esm-parity` and `verify:modern` now runs it.
  - Blocker handled:
    - initial `node` runner failed due to CJS-style generated contract file under `"type": "module"`.
    - resolved by running the guard with `bun` (`bun tools/check-protocol-contract-esm-parity.cjs`).
- `2026-02-08T09:26Z` `done` Protocol bridge + guard fully verified.
  - Evidence:
    - `bun test tests/unit/protocol-contract-types.test.ts tests/unit/protocol-contract-module.test.ts tests/unit/protocol-support-contract.test.ts tests/unit/ws-runtime-parity.test.ts tests/unit/ws-connection-esm.test.ts tests/smoke/server-payload-guards.test.ts --timeout 20000` -> pass.
    - `bun run check:protocol-contract-esm-parity` -> pass.
    - `bun run verify:modern:node22` -> pass.

## Delta Update (2026-02-08 legacy deactivation follow-through)

### Ticket status

- `T-301` Remove static-server legacy root entry toggle: `done`
- `T-302` Convert protocol invariant browser gate to modern-only entry coverage: `done`
- `T-303` Align readiness document evidence with retired legacy lane: `done`

### Live progress log

- `2026-02-08T07:32Z` `in_progress` Started re-audit of active runtime legacy paths.
  - Evidence: `rg -n "BQ_CLIENT_DEFAULT_ENTRY|/client/index.html|verify:legacy" ...`
  - Next action: remove remaining legacy default-entry toggle.
- `2026-02-08T07:35Z` `in_progress` Removed `BQ_CLIENT_DEFAULT_ENTRY` runtime branch and legacy opt-in smoke.
  - Evidence: `bun run test:static-entry` -> pass (`1 pass`, `0 fail`).
  - Next action: de-couple protocol invariant browser suite from `client/index.html`.
- `2026-02-08T07:38Z` `in_progress` Migrated protocol-invariant Playwright test to modern-only assertions.
  - Evidence: `bun run test:browser:protocol-invariant:node22` -> pass (`1 passed`).
  - Next action: refresh modernization readiness evidence + run full modern verify.
- `2026-02-08T07:40Z` `done` Documentation/evidence alignment complete.
  - Evidence: this delta section + command outcomes listed below.

## Delta Update (2026-02-08 audit remediation pass)

### Ticket status

- `M-02` Remove ESM compat global writes: `done`
- `M-06` Remove obsolete browser branches (MozWebSocket/vendor transition/RAF): `done`
- `M-03` Tighten boundary type seams: `done`
- `M-04` Reduce modern-path ESM/CJS bridge usage: `done`
- `M-01` Legacy runtime retirement policy enforcement: `done`

### Implemented in this pass

- Removed compat global writes from:
  - `client/js-esm/compat/log.js`
  - `client/js-esm/compat/detect.js`
  - `client/js-esm/compat/features.js`
  - `client/js-esm/compat/util.js`
- Removed obsolete browser compatibility branches from modern ESM path:
  - `MozWebSocket` fallback removed (`client/js-esm/gameclient.js`)
  - vendor transition listeners removed (`client/js-esm/main.js`)
  - vendor-prefixed RAF branches removed (`client/js-esm/compat/util.js`)
- Modernized Safari image helper to `fetch` + `Blob` URL flow in `client/js-esm/compat/util.js`.
- Tightened explicit client boundary contracts without `any`:
  - `client/js-esm/client-boundary-types.ts`
  - `client/js-esm/main.js` dynamic-import constructor seam typing
  - `client/js-esm/app.js` runtime config seam typing
- Removed remaining server runtime `any` seam escape hatches by typing dynamic class surfaces:
  - `server/js/player.cts`
  - `server/js/worldserver.cts`
- Introduced browser-native shared gametypes module and moved modern client compat import to it:
  - `shared/js/gametypes-browser.mjs`
  - `client/js-esm/compat/gametypes.js`
- Added default modern verification entrypoint:
  - `package.json` script: `"verify": "bun run verify:modern"`
- Retired active legacy command lanes with explicit guardrails:
  - `build:client`, `build:vite:legacy`, `verify:legacy`, `verify:legacy:node22`
  - `test:legacy-browser` + legacy browser aliases
  - `tools/legacy-retired.cjs`
- Simplified Vite to modern-only build input/output:
  - removed legacy build input toggle and legacy runtime asset copy plugin (`vite.config.ts`)
- Removed legacy CI workflow gates:
  - `.github/workflows/verify-legacy.yml`
  - `.github/workflows/verify-legacy-browser.yml`

### Verification evidence for this pass

- `bun run typecheck` passed.
- `bun run build:vite` passed.
- `bun test tests/unit/client-boundary-types.test.ts --timeout 20000` passed.
- `bun test tests/unit/gametypes-contract.test.ts tests/unit/client-gametypes-compat.test.ts --timeout 20000` passed.
- `bun run test` passed (`136 pass`, `1 skip`, `0 fail`).
- `bun run build:worldserver` passed (runtime artifact synced from typed `.cts` source).
- `bun run verify:modern:node22` passed (modern-only verification path).

## Summary

The in-repository modernization execution track is complete and green.

Technical implementation, type hardening, sync determinism, and runtime parity gates are passing on Node 22.

## Completed Technical State

- Server shadow-source hardening is complete:
  - `server/js/*.cts` has no `@ts-nocheck`.
  - Runtime artifacts are generated deterministically from `.cts` sources.
- Verification gates now include hardening regression checks:
  - `check:server-shadow-hardening` is part of `verify:modern`.
- Shared protocol contract is now TypeScript-authored shadow source:
  - `shared/js/protocol-contract.cts` -> generated `shared/js/protocol-contract.js`.
  - `check:protocol-contract-sync` is part of `verify:modern`.
- Node 22 runner is modernization-aligned:
  - `tools/node22-run.sh` now prefers local Node 22 and falls back to explicit `npm exec --package=node@22` only when required.
  - no `npx` references remain in project `package.json` + `tools` command surfaces.
- Direct dependency drift enforcement is Bun-native:
  - `check:deps:drift` now runs `tools/check-dependency-drift.cjs` (no `npm outdated` dependency).
  - CI dependency drift snapshot workflow consumes the same checker with report output mode.
- Websocket/runtime boundary parity checks remain green (`check:ws:runbooks`, protocol browser suite).
- First-party runtime/test surfaces are free of TS suppression pragmas (`@ts-expect-error`, `@ts-ignore`, `@ts-nocheck`).
- Direct dependency drift is clean (`bun outdated`, `check:deps:drift`).

## Verification Evidence

Executed successfully on 2026-02-08:

- `bun run check:server-shadow-hardening`
- `bun run check:protocol-contract-sync`
- `bun run check:deps:drift` (no direct dependency drift)
- `bun outdated` (no direct dependency updates)
- `bun run typecheck`
- `bun run verify:modern:node22`
- `bun run verify:legacy:node22` (intentionally retired; expected to fail via `tools/legacy-retired.cjs`)
- `bun run test:static-entry`
- `bun run test:browser:protocol-invariant:node22`
- `bun run test:browser:protocol:node22`
- `bun run check:ws:runbooks`
- `bun run check:legacy-signoff:report:json` (machine-readable external blocker inventory)
- `bun run check:legacy-signoff:report` (human-readable external blocker inventory)
- `bun run check:legacy-signoff:ready` (strict closure check; passes)
- `rg -n '\bnpx\b' package.json tools` (no matches)
- `rg -n '@ts-(expect-error|ignore|nocheck)' client/js-esm server/js shared/js tests` (no matches)

## Remaining Work

1. `T-304` Full ESM runtime promotion (server runtime lane)
   - Scope: promote `server/js/*.cts` + generated CJS runtime artifacts toward first-class ESM runtime modules (without gameplay/protocol regressions).
   - Out of scope: gameplay feature rewrites.
   - Acceptance criteria:
     - `start:server:esm` runs as primary runtime path.
     - CJS runtime remains optional rollback path only.
     - Protocol/browser smokes stay green.
   - Verification: `bun run verify:modern:node22` + `bun run test:browser:protocol:node22`.
   - Dependencies/blockers: staged migration plan across websocket/worldserver/player/module boundaries.

2. `T-305` Legacy artifact removal follow-through
   - Scope: remove or archive unneeded legacy-only browser tests/docs/workflow references now that command lanes are retired.
   - Out of scope: deleting rollback-critical artifacts until release/ops signoff.
   - Acceptance criteria:
     - No active docs recommend retired commands as default workflows.
     - Legacy compatibility checks remain explicitly marked advisory/archival where kept.
   - Verification: `rg -n "verify:legacy|test:browser:legacy|build:client|build:vite:legacy" README.md docs`.
   - Dependencies/blockers: maintainer decision on rollback retention window.

3. `T-306` Type-safety completion in runtime lanes
   - Scope: continue replacing broad dynamic seams with explicit interfaces and remove residual loose typing patterns in server/runtime boundaries.
   - Out of scope: introducing risky behavior changes in combat/world logic.
   - Acceptance criteria:
     - No new untyped seam escape hatches in `server/js/*.cts`.
     - Sync/runtime checks remain deterministic.
   - Verification: `bun run typecheck` + `bun run check:server-shadow-hardening` + `bun run verify:modern:node22`.
   - Dependencies/blockers: incremental module-by-module contract extraction.
