# `server/js/lib/class.js` Fanout Map (2026-02-07)

## Snapshot

- Initial fanout before pilot: `12` server modules imported `./lib/class`.
- After tiered migrations (`server/js/format.js`, `server/js/checkpoint.js`, `server/js/area.js`, `server/js/message.js`, `server/js/mobarea.js`, `server/js/chestarea.js`, `server/js/entity.js`, `server/js/character.js`, `server/js/item.js`, `server/js/npc.js`, `server/js/chest.js`, `server/js/mob.js`, `server/js/player.js`, `server/js/map.js`, `server/js/metrics.js`, `server/js/ws.js`, `server/js/worldserver.js`): `0` remaining imports.

## Remaining direct dependents

- none

## Pilot completed

- Migrated off `Class.extend` to native class:
  - `server/js/format.js`
  - `server/js/checkpoint.js`
  - `server/js/area.js`
  - `server/js/message.js`
  - `server/js/mobarea.js`
  - `server/js/chestarea.js`
  - `server/js/entity.js`
  - `server/js/character.js`
  - `server/js/item.js`
  - `server/js/npc.js`
  - `server/js/chest.js`
  - `server/js/mob.js`
  - `server/js/player.js`
  - `server/js/map.js`
  - `server/js/metrics.js`
  - `server/js/ws.js`
  - `server/js/worldserver.js`
- Export contract preserved:
  - `exports.FormatChecker`
  - `exports.check`

## Suggested next migration order

1. Low-risk leafs:
   - complete
2. High-risk core:
   - complete

## Verification guardrails per module migration

- `bun run test`
- `bun run verify:legacy:node22`
- `bun run test:browser:protocol:node22`
