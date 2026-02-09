> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Player TS Contract Extraction (T-324/T-326)

Date: 2026-02-08

Status:

- Contract extraction complete (`T-324`)
- Shadow-source phase-1 execution complete (`T-326`)

## Objective

Extract TypeScript-first seam contracts for `server/js/player.js` without runtime behavior changes so future player/worldserver shadow-source promotion has explicit dependency and callback boundaries.

## Extracted artifacts

- Contract module: `server/js/player-types.ts`
- Contract test: `tests/unit/player-shadow-source-contract.test.ts`
- Authored shadow source: `server/js/player.cts`
- Generated runtime artifact: `server/js/player.js`
- Sync tooling: `tools/sync-player.cjs`
- Build config: `tsconfig.build-player.json`

## Captured seam inventory

### Runtime dependency boundaries

- `./character`
- `./chest`
- `./log`
- `./message`
- `./utils`
- `./properties`
- `./formulas`
- `./format`
- `../../shared/js/gametypes`

### Constructor fields

- `server`
- `connection`
- `name`
- `hasEnteredGame`
- `isDead`
- `haters`
- `lastCheckpoint`
- `disconnectTimeout`
- `firepotionTimeout`
- `attackers`

### Callback fields

- `exit_callback`
- `move_callback`
- `lootmove_callback`
- `zone_callback`
- `orient_callback`
- `message_callback`
- `broadcast_callback`
- `broadcastzone_callback`
- `requestpos_callback`

## Verification

1. `bun run typecheck`
2. `bun run verify:modern:node22`
3. `bun run verify:legacy:node22`
4. `bun run test:browser:protocol:node22`
