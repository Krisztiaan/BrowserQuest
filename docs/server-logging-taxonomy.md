# Server Structured Logging Taxonomy

This document defines stable structured-event names emitted by the server runtime and world simulation.

## Event naming contract

- Event names are lowercase dot-separated identifiers.
- Field keys are stable once introduced; additive fields are allowed.
- `worldId`, `playerId`, and map coordinates are emitted as numbers/strings (no nested polymorphic payloads).

## Core runtime events

- `server.start`
- `server.connect.rejected`
- `server.error`
- `server.shutdown.signal`
- `server.config.invalid`
- `server.fatal.uncaught_exception`
- `server.fatal.unhandled_rejection`
- `server.fatal.unknown`
- `server.metrics.ready`
- `server.metrics.unavailable`
- `ws.server.listen`
- `ws.server.error`
- `ws.connection.open`
- `ws.connection.closed`
- `ws.connection.error`
- `ws.connection.close_request`
- `world.player.join`
- `world.player.leave`

## Map transition observability events

### `world.map.transition.begin`

Emitted when authoritative door transition processing begins for a player.

Fields:
- `worldId`
- `playerId`
- `fromMapId`
- `toMapId`
- `toX`
- `toY`
- `attempts`
- `commits`
- `rejects`

### `world.map.transition.commit`

Emitted when a begun transition is committed (map id + position applied and commit outcome queued).

Fields:
- `worldId`
- `playerId`
- `fromMapId`
- `toMapId`
- `toX`
- `toY`
- `attempts`
- `commits`
- `rejects`

### `world.map.transition.reject`

Emitted when a transition candidate is rejected before commit.

Fields:
- `worldId`
- `playerId`
- `fromMapId`
- `toMapId`
- `toX`
- `toY`
- `reason`
- `destinationOccupantId` (`null` when not applicable)
- `attempts`
- `commits`
- `rejects`
- `rejectReasonCount`

Stable `reason` values:
- `invalid_destination`
- `destination_occupied`
- `player_missing`
- `invalid_transition_payload`
