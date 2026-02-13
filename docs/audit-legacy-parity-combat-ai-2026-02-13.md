# Legacy Parity Audit: Combat, Enemy AI, Death/Despawn, Respawn (2026-02-13)

Scope: modern runtime in `/root/dev/BrowserQuest` vs legacy baseline in `/root/dev/BrowserQuest.wt-origin-master`.

Goal: identify gameplay-simulation parity gaps before deeper ECS migration work.

Out of scope:
- Rendering modernization (Ticket 12)
- Product/UI redesigns
- New combat balance/features

## Method

- Read side-by-side implementations for server and client combat/AI flows.
- Validate against observed runtime symptoms from session logs (mob orbiting, clipping, stale dead mobs, combat cleanup errors).
- Map each gap to actionable remediation tickets.

Primary sources reviewed:
- Legacy server: `../BrowserQuest.wt-origin-master/server/js/worldserver.js`, `../BrowserQuest.wt-origin-master/server/js/player.js`, `../BrowserQuest.wt-origin-master/server/js/mob.js`
- Legacy client: `../BrowserQuest.wt-origin-master/client/js/game.js`, `../BrowserQuest.wt-origin-master/client/js/character.js`, `../BrowserQuest.wt-origin-master/client/js/gameclient.js`
- Modern server: `server/world/ecs-command-pipeline.ts`, `server/world-server.ts`, `server/world/player-lifecycle.ts`, `server/mob.ts`
- Modern client: `client/game.ts`, `client/ecs/systems/client-combat-system.ts`, `client/ecs/systems/client-kernel-replication-sync-system.ts`, `client/ecs/systems/client-command-apply-system.ts`, `client/gameclient.ts`

## Executive Summary

Modern runtime now has key fixes (mob hurt-player flow and despawn bookkeeping), but parity is still incomplete in several important places.

Highest-impact remaining gaps:
1. Combat authority still depends on client-sent `HIT`/`HURT` (legacy parity, but fragile for modern authoritative sim).
2. Modern client lost legacy auto-aggro wiring (`checkAggro` emits with no listener-driven mob scan/send path).
3. Mob chase/unstack behavior differs due scheduler cadence and lack of occupancy constraints in server path selection.
4. Client combat graph cleanup is still non-idempotent under despawn/death reorderings (`X is not attacked by Y`).

## Parity Matrix

### 1) Protocol-level combat control (`AGGRO`, `ATTACK`, `HIT`, `HURT`)

Status: `partial` (legacy-compatible, not modern-authoritative)

Legacy behavior:
- Client sends `AGGRO` near aggressive mobs.
- Client sends `ATTACK` to set target.
- Client sends `HIT` to apply player->mob damage.
- Client sends `HURT` to apply mob->player damage.

Modern behavior:
- Same protocol shape still active (`translateClientActionToCommand` still accepts all 4 opcodes).
- Damage application still triggered by inbound `HIT`/`HURT` in `applyHitCommand`/`applyHurtCommand`.

Gap:
- This matches legacy, but blocks server-authoritative simulation goals and leaves damage pacing sensitive to client timing/order.

Remedy mapping:
- Ticket 98 (server-authoritative combat loop).

### 2) Auto-aggro acquisition

Status: `deviates` (regression)

Legacy behavior:
- Client periodically scans nearby aggressive mobs and sends `AGGRO` (`player.onCheckAggro` + `player.onAggro` in `client/js/game.js`).

Modern behavior:
- `player.checkAggro()` still emits from `runClientSimulationSystem`, but there is no modern listener chain that scans nearby mobs and enqueues `clientSendAggro`.
- `clientSendAggro` exists and works, but is currently reached mainly from explicit test controls and manual command paths.

Impact:
- Passive aggro parity is incomplete; mob engagement relies more on explicit player actions than legacy intended.

Remedy mapping:
- Ticket 102 (new): restore deterministic auto-aggro wiring in modern client systems.

### 3) Mob chase cadence and retarget responsiveness

Status: `deviates`

Legacy behavior:
- Additional repath pressure from callbacks tied to player movement (`onMove` / `onLootMove`) and `onEntityAttack` handling.
- Mobs are repeatedly repositioned toward adjacent attack tiles using `findPositionNextTo`.

Modern behavior:
- Chase runs in server `mob_ai` stage on interval ticks (`ups/5` cadence).
- Position selection uses greedy step + bounded BFS fallback.

Impact:
- Works in simple lanes, but less responsive under tight movement and contributes to visible jitter/orbit patterns compared with legacy feel.

Remedy mapping:
- Ticket 99 (occupancy/collision),
- Ticket 103 (new): tune repath cadence/triggers for parity under movement churn.

### 4) Anti-stacking and tile occupancy around player

Status: `deviates`

Legacy behavior:
- Client anti-stacking logic (`tryMovingToADifferentTile`, `getFreeAdjacentNonDiagonalPosition`, `adjacentTiles`) strongly biases mobs toward unique adjacent slots.

Modern behavior:
- Client retains anti-stacking mechanics in `runClientCombatSystem`, but server movement legality currently checks map collision only (`isValidPosition`), not dynamic entity occupancy.

Impact:
- Mobs can still clip/overlap under load because authoritative server does not enforce occupancy constraints.

Remedy mapping:
- Ticket 99.

### 5) Attack-link replication stability

Status: `improving`, still `partial`

Legacy behavior:
- Attack links are formed by `ATTACK` events and client utility `createAttackLink`.

Modern behavior:
- Local-player target-presence fix landed in `client-kernel-replication-sync-system`.
- Remote-entity path-follow side effects were reduced in `Game.createAttackLink`.

Remaining gap:
- Cleanup path still can emit benign but noisy graph mismatch errors during despawn/death reorderings.

Remedy mapping:
- Ticket 100.

### 6) Death, despawn, and corpse interactability

Status: `improving`, still `partial`

Legacy behavior:
- On despawn, character death flow and attacker cleanup execute in predictable order with death animation path.

Modern behavior:
- Despawn bookkeeping bug was fixed (Ticket 95).
- Server now emits nearby `DESPAWN` on mob kill (Ticket 93).

Remaining gap:
- Client cleanup ordering still occasionally logs attacker/target mismatch errors, indicating non-idempotent removal semantics.

Remedy mapping:
- Ticket 100,
- Ticket 101 (explicit kill/despawn/respawn browser regression).

### 7) Respawn lifecycle

Status: `near parity`

Legacy behavior:
- Mob death schedules delayed respawn; mob resets health and position before returning.

Modern behavior:
- Respawn task resource schedules respawn callbacks.
- MobArea respawn callback resets position and HP.
- Static entities also use scheduled respawn hooks.

Risk note:
- Still hybrid with legacy entity instances and world maps; race edges remain until Ticket 90/91 land.

Remedy mapping:
- Ticket 90,
- Ticket 91.

### 8) Combat UI parity (health/damage feedback)

Status: `mostly parity`

Legacy baseline:
- Player health bar + received/inflicted damage info.
- No dedicated enemy health bar UI.

Modern:
- Player health bar still driven by `HEALTH` and `updateBars`.
- `DAMAGE` feedback path restored (Ticket 94).

Interpretation:
- "No enemy health bar" is not a new regression vs legacy baseline.

## Prioritized Remediation Plan

### P0

- Ticket 98: server-authoritative damage loop (`ATTACK` intent only).
- Ticket 90: remove legacy entity-class simulation seams.
- Ticket 91: remove legacy world entity maps as authority.

### P1

- Ticket 99: occupancy-aware movement/collision for mobs.
- Ticket 102: restore modern auto-aggro wiring parity.
- Ticket 103: repath cadence/trigger parity under player movement churn.

### P2

- Ticket 100: idempotent client combat graph cleanup.
- Ticket 101: end-to-end kill/despawn/respawn regression.

## Recommended Execution Order (Server-first)

1. Ticket 97 (this audit)
2. Ticket 90
3. Ticket 91
4. Ticket 98
5. Ticket 99
6. Ticket 102
7. Ticket 103
8. Ticket 100
9. Ticket 101

## Notes for ECS Migration

Server-authoritative combat and occupancy are prerequisites for idiomatic ECS simulation. Keeping `HIT`/`HURT` as damage-authority opcodes while removing legacy classes will increase complexity and create dual-path state bugs. Resolve authority first, then continue ECS cleanup.
