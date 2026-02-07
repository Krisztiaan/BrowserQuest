# `server/js/lib/class.js` Fanout Map (2026-02-07)

## Snapshot

- Initial fanout before pilot: `12` server modules imported `./lib/class`.
- After pilot migrations (`server/js/format.js`, `server/js/checkpoint.js`, `server/js/area.js`, `server/js/message.js`, `server/js/mobarea.js`, `server/js/chestarea.js`): `8` remaining imports.

## Remaining direct dependents

- `server/js/character.js`
- `server/js/entity.js`
- `server/js/map.js`
- `server/js/metrics.js`
- `server/js/mob.js`
- `server/js/player.js`
- `server/js/worldserver.js`
- `server/js/ws.js`

## Pilot completed

- Migrated off `Class.extend` to native class:
  - `server/js/format.js`
  - `server/js/checkpoint.js`
  - `server/js/area.js`
  - `server/js/message.js`
  - `server/js/mobarea.js`
  - `server/js/chestarea.js`
- Export contract preserved:
  - `exports.FormatChecker`
  - `exports.check`

## Suggested next migration order

1. Low-risk leafs:
   - `server/js/entity.js`
2. Mid-risk messaging/domain:
   - `server/js/character.js`
   - `server/js/mob.js`
3. High-risk core:
   - `server/js/map.js`
   - `server/js/ws.js`
   - `server/js/player.js`
   - `server/js/worldserver.js`
4. Runtime/metrics integration:
   - `server/js/metrics.js`

## Verification guardrails per module migration

- `bun run test`
- `bun run verify:legacy:node22`
- `bun run test:browser:protocol:node22`
