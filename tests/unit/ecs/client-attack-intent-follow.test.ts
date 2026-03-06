import { expect, test } from 'bun:test';
import Player from '../../../client/player';
import Mob from '../../../client/mob';
import { ClientWorldKernel } from '../../../client/ecs/world-kernel';
import { runClientInteractionIntentSystem } from '../../../client/ecs/systems/client-interaction-intent-system';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import Types from '../../../shared/gametypes-browser';
import { setEntityGrid, upsertClientSpatialRecord } from '../../support/mmo/client-gameplay';

test('attack intent enqueues follow when non-adjacent', () => {
    const playerId = entityIdFromWire(5100);
    const player = new Player(playerId, 'K', Types.Entities.WARRIOR);
    setEntityGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1701), Types.Entities.RAT);
    setEntityGrid(mob, 14, 10);

    const kernel = new ClientWorldKernel();
    upsertClientSpatialRecord({
        kernel,
        entityId: playerId,
        kind: player.kind,
        x: player.gridX,
        y: player.gridY,
        isPlayer: true,
    });
    upsertClientSpatialRecord({
        kernel,
        entityId: mob.id,
        kind: mob.kind,
        x: mob.gridX,
        y: mob.gridY,
        isPlayer: false,
    });
    kernel.setClientInteractionIntent({
        kind: 'attack',
        targetId: mob.id,
        lastKnownTargetPos: gridPos(mob.gridX, mob.gridY),
    });

    runClientInteractionIntentSystem({
        started: true,
        currentTime: 1_000,
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });

    const commands = kernel.drainClientCommands();
    expect(commands).toContainEqual({ type: 'playerFollow', targetId: mob.id });
});

test('attack intent does not enqueue follow while move intents are already pending', () => {
    const playerId = entityIdFromWire(5104);
    const player = new Player(playerId, 'K', Types.Entities.WARRIOR);
    setEntityGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1705), Types.Entities.RAT);
    setEntityGrid(mob, 14, 10);

    const kernel = new ClientWorldKernel();
    upsertClientSpatialRecord({
        kernel,
        entityId: playerId,
        kind: player.kind,
        x: player.gridX,
        y: player.gridY,
        isPlayer: true,
    });
    upsertClientSpatialRecord({
        kernel,
        entityId: mob.id,
        kind: mob.kind,
        x: mob.gridX,
        y: mob.gridY,
        isPlayer: false,
    });
    kernel.enqueueClientPendingMoveAck(11, 10);
    kernel.enqueueClientPendingMoveSeqAck(42);
    kernel.setClientInteractionIntent({
        kind: 'attack',
        targetId: mob.id,
        lastKnownTargetPos: gridPos(mob.gridX, mob.gridY),
    });

    runClientInteractionIntentSystem({
        started: true,
        currentTime: 1_000,
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });

    const commands = kernel.drainClientCommands();
    expect(commands).not.toContainEqual({ type: 'playerFollow', targetId: mob.id });
});

test('attack intent defers ATTACK in-range while move intents are still pending', () => {
    const playerId = entityIdFromWire(5105);
    const player = new Player(playerId, 'K', Types.Entities.WARRIOR);
    setEntityGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1706), Types.Entities.RAT);
    setEntityGrid(mob, 11, 10);

    const kernel = new ClientWorldKernel();
    upsertClientSpatialRecord({
        kernel,
        entityId: playerId,
        kind: player.kind,
        x: player.gridX,
        y: player.gridY,
        isPlayer: true,
    });
    upsertClientSpatialRecord({
        kernel,
        entityId: mob.id,
        kind: mob.kind,
        x: mob.gridX,
        y: mob.gridY,
        isPlayer: false,
    });
    kernel.enqueueClientPendingMoveAck(10, 10);
    kernel.enqueueClientPendingMoveSeqAck(99);
    kernel.setClientInteractionIntent({
        kind: 'attack',
        targetId: mob.id,
        lastKnownTargetPos: gridPos(mob.gridX, mob.gridY),
    });

    runClientInteractionIntentSystem({
        started: true,
        currentTime: 1_000,
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });

    const commands = kernel.drainClientCommands();
    expect(commands).not.toContainEqual({ type: 'playerAttack', targetId: mob.id });
});

test('attack intent emits ATTACK once pending move intents clear without requiring a second click', () => {
    const playerId = entityIdFromWire(5109);
    const player = new Player(playerId, 'K', Types.Entities.WARRIOR);
    setEntityGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1710), Types.Entities.RAT);
    setEntityGrid(mob, 11, 10);

    const kernel = new ClientWorldKernel();
    upsertClientSpatialRecord({
        kernel,
        entityId: playerId,
        kind: player.kind,
        x: player.gridX,
        y: player.gridY,
        isPlayer: true,
        isMoving: false,
    });
    upsertClientSpatialRecord({
        kernel,
        entityId: mob.id,
        kind: mob.kind,
        x: mob.gridX,
        y: mob.gridY,
        isPlayer: false,
    });
    player.setTarget(mob);
    player.attackingMode = true;
    kernel.enqueueClientPendingMoveAck(10, 10);
    kernel.enqueueClientPendingMoveSeqAck(100);
    kernel.setClientInteractionIntent({
        kind: 'attack',
        targetId: mob.id,
        lastKnownTargetPos: gridPos(mob.gridX, mob.gridY),
    });

    runClientInteractionIntentSystem({
        started: true,
        currentTime: 1_000,
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });
    expect(kernel.drainClientCommands()).not.toContainEqual({ type: 'playerAttack', targetId: mob.id });

    kernel.clearClientPendingMoveAcks();
    kernel.clearClientPendingMoveSeqAcks();
    runClientInteractionIntentSystem({
        started: true,
        currentTime: 1_100,
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });
    expect(kernel.drainClientCommands()).toContainEqual({ type: 'playerAttack', targetId: mob.id });
});

test('attack intent waits for authoritative tile alignment before emitting ATTACK', () => {
    const playerId = entityIdFromWire(5110);
    const player = new Player(playerId, 'K', Types.Entities.WARRIOR);
    setEntityGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1711), Types.Entities.RAT);
    setEntityGrid(mob, 11, 10);

    const kernel = new ClientWorldKernel();
    upsertClientSpatialRecord({
        kernel,
        entityId: playerId,
        kind: player.kind,
        x: player.gridX,
        y: player.gridY,
        isPlayer: true,
        isMoving: false,
    });
    upsertClientSpatialRecord({
        kernel,
        entityId: mob.id,
        kind: mob.kind,
        x: mob.gridX,
        y: mob.gridY,
        isPlayer: false,
    });
    kernel.clientReplicationLastPos.set(playerId, gridPos(9, 10));
    kernel.setClientInteractionIntent({
        kind: 'attack',
        targetId: mob.id,
        lastKnownTargetPos: gridPos(mob.gridX, mob.gridY),
    });

    runClientInteractionIntentSystem({
        started: true,
        currentTime: 1_000,
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });
    expect(kernel.drainClientCommands()).not.toContainEqual({ type: 'playerAttack', targetId: mob.id });

    kernel.clientReplicationLastPos.set(playerId, gridPos(10, 10));
    runClientInteractionIntentSystem({
        started: true,
        currentTime: 1_100,
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });
    expect(kernel.drainClientCommands()).toContainEqual({ type: 'playerAttack', targetId: mob.id });
});

test('attack intent allows first-click ATTACK once authoritative position is still diagonally in range', () => {
    const playerId = entityIdFromWire(5111);
    const player = new Player(playerId, 'K', Types.Entities.WARRIOR);
    setEntityGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1712), Types.Entities.RAT);
    setEntityGrid(mob, 11, 11);

    const kernel = new ClientWorldKernel();
    upsertClientSpatialRecord({
        kernel,
        entityId: playerId,
        kind: player.kind,
        x: player.gridX,
        y: player.gridY,
        isPlayer: true,
        isMoving: false,
    });
    upsertClientSpatialRecord({
        kernel,
        entityId: mob.id,
        kind: mob.kind,
        x: mob.gridX,
        y: mob.gridY,
        isPlayer: false,
    });
    // Server-side tile can lag by one axis during diagonal settle while still being valid attack range.
    kernel.clientReplicationLastPos.set(playerId, gridPos(10, 11));
    kernel.setClientInteractionIntent({
        kind: 'attack',
        targetId: mob.id,
        lastKnownTargetPos: gridPos(mob.gridX, mob.gridY),
    });

    runClientInteractionIntentSystem({
        started: true,
        currentTime: 1_000,
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });

    expect(kernel.drainClientCommands()).toContainEqual({ type: 'playerAttack', targetId: mob.id });
});

test('attack intent uses authoritative in-range tile even when rendered tile is one diagonal step behind', () => {
    const playerId = entityIdFromWire(5112);
    const player = new Player(playerId, 'K', Types.Entities.WARRIOR);
    setEntityGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1713), Types.Entities.RAT);
    setEntityGrid(mob, 12, 11);

    const kernel = new ClientWorldKernel();
    upsertClientSpatialRecord({
        kernel,
        entityId: playerId,
        kind: player.kind,
        x: player.gridX,
        y: player.gridY,
        isPlayer: true,
        isMoving: false,
    });
    upsertClientSpatialRecord({
        kernel,
        entityId: mob.id,
        kind: mob.kind,
        x: mob.gridX,
        y: mob.gridY,
        isPlayer: false,
    });
    // Rendered tile is still out of range, but the last authoritative tile is already diagonally adjacent.
    kernel.clientReplicationLastPos.set(playerId, gridPos(11, 10));
    kernel.setClientInteractionIntent({
        kind: 'attack',
        targetId: mob.id,
        lastKnownTargetPos: gridPos(mob.gridX, mob.gridY),
    });

    runClientInteractionIntentSystem({
        started: true,
        currentTime: 1_000,
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });

    expect(kernel.drainClientCommands()).toContainEqual({ type: 'playerAttack', targetId: mob.id });
});

test('attack intent defers ATTACK while local player is still moving even if adjacent', () => {
    const playerId = entityIdFromWire(5106);
    const player = new Player(playerId, 'K', Types.Entities.WARRIOR);
    setEntityGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1707), Types.Entities.RAT);
    setEntityGrid(mob, 11, 10);

    const kernel = new ClientWorldKernel();
    upsertClientSpatialRecord({
        kernel,
        entityId: playerId,
        kind: player.kind,
        x: player.gridX,
        y: player.gridY,
        isPlayer: true,
        isMoving: true,
        nextGridX: 10,
        nextGridY: 10,
    });
    upsertClientSpatialRecord({
        kernel,
        entityId: mob.id,
        kind: mob.kind,
        x: mob.gridX,
        y: mob.gridY,
        isPlayer: false,
    });
    kernel.setClientInteractionIntent({
        kind: 'attack',
        targetId: mob.id,
        lastKnownTargetPos: gridPos(mob.gridX, mob.gridY),
    });

    runClientInteractionIntentSystem({
        started: true,
        currentTime: 1_000,
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });

    const commands = kernel.drainClientCommands();
    expect(commands).not.toContainEqual({ type: 'playerAttack', targetId: mob.id });
});

test('attack intent emits ATTACK automatically once movement settles without requiring a second click', () => {
    const playerId = entityIdFromWire(5107);
    const player = new Player(playerId, 'K', Types.Entities.WARRIOR);
    setEntityGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1708), Types.Entities.RAT);
    setEntityGrid(mob, 11, 10);

    const kernel = new ClientWorldKernel();
    upsertClientSpatialRecord({
        kernel,
        entityId: playerId,
        kind: player.kind,
        x: player.gridX,
        y: player.gridY,
        isPlayer: true,
        isMoving: true,
        nextGridX: 10,
        nextGridY: 10,
    });
    upsertClientSpatialRecord({
        kernel,
        entityId: mob.id,
        kind: mob.kind,
        x: mob.gridX,
        y: mob.gridY,
        isPlayer: false,
    });
    kernel.setClientInteractionIntent({
        kind: 'attack',
        targetId: mob.id,
        lastKnownTargetPos: gridPos(mob.gridX, mob.gridY),
    });

    runClientInteractionIntentSystem({
        started: true,
        currentTime: 1_000,
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });
    expect(kernel.drainClientCommands()).not.toContainEqual({ type: 'playerAttack', targetId: mob.id });

    upsertClientSpatialRecord({
        kernel,
        entityId: playerId,
        kind: player.kind,
        x: player.gridX,
        y: player.gridY,
        isPlayer: true,
        isMoving: false,
    });

    runClientInteractionIntentSystem({
        started: true,
        currentTime: 1_100,
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });
    expect(kernel.drainClientCommands()).toContainEqual({ type: 'playerAttack', targetId: mob.id });
});

test('attack intent emits ATTACK once adjacent even if target already assigned', () => {
    const playerId = entityIdFromWire(5101);
    const player = new Player(playerId, 'K', Types.Entities.WARRIOR);
    setEntityGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1702), Types.Entities.RAT);
    setEntityGrid(mob, 11, 10);

    player.setTarget(mob);
    expect(player.isAttacking()).toBe(false);

    const kernel = new ClientWorldKernel();
    upsertClientSpatialRecord({
        kernel,
        entityId: playerId,
        kind: player.kind,
        x: player.gridX,
        y: player.gridY,
        isPlayer: true,
    });
    upsertClientSpatialRecord({
        kernel,
        entityId: mob.id,
        kind: mob.kind,
        x: mob.gridX,
        y: mob.gridY,
        isPlayer: false,
    });
    kernel.setClientInteractionIntent({
        kind: 'attack',
        targetId: mob.id,
        lastKnownTargetPos: gridPos(mob.gridX, mob.gridY),
    });

    runClientInteractionIntentSystem({
        started: true,
        currentTime: 1_000,
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });

    const commands = kernel.drainClientCommands();
    expect(commands).toContainEqual({ type: 'playerAttack', targetId: mob.id });
});

test('attack intent emits ATTACK at 2-tile line range for heavy melee weapon', () => {
    const playerId = entityIdFromWire(5102);
    const player = new Player(playerId, 'K', Types.Entities.WARRIOR);
    player.setWeaponName('axe');
    setEntityGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1703), Types.Entities.RAT);
    setEntityGrid(mob, 12, 10);

    const kernel = new ClientWorldKernel();
    upsertClientSpatialRecord({
        kernel,
        entityId: playerId,
        kind: player.kind,
        x: player.gridX,
        y: player.gridY,
        isPlayer: true,
    });
    upsertClientSpatialRecord({
        kernel,
        entityId: mob.id,
        kind: mob.kind,
        x: mob.gridX,
        y: mob.gridY,
        isPlayer: false,
    });
    kernel.setClientInteractionIntent({
        kind: 'attack',
        targetId: mob.id,
        lastKnownTargetPos: gridPos(mob.gridX, mob.gridY),
    });

    runClientInteractionIntentSystem({
        started: true,
        currentTime: 1_000,
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });

    const commands = kernel.drainClientCommands();
    expect(commands).toContainEqual({ type: 'playerAttack', targetId: mob.id });
    expect(commands).not.toContainEqual({ type: 'playerFollow', targetId: mob.id });
});

test('attack intent keeps follow when target is diagonal even with heavy melee weapon', () => {
    const playerId = entityIdFromWire(5103);
    const player = new Player(playerId, 'K', Types.Entities.WARRIOR);
    player.setWeaponName('axe');
    setEntityGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1704), Types.Entities.RAT);
    setEntityGrid(mob, 11, 11);

    const kernel = new ClientWorldKernel();
    upsertClientSpatialRecord({
        kernel,
        entityId: playerId,
        kind: player.kind,
        x: player.gridX,
        y: player.gridY,
        isPlayer: true,
    });
    upsertClientSpatialRecord({
        kernel,
        entityId: mob.id,
        kind: mob.kind,
        x: mob.gridX,
        y: mob.gridY,
        isPlayer: false,
    });
    kernel.setClientInteractionIntent({
        kind: 'attack',
        targetId: mob.id,
        lastKnownTargetPos: gridPos(mob.gridX, mob.gridY),
    });

    runClientInteractionIntentSystem({
        started: true,
        currentTime: 1_000,
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });

    const commands = kernel.drainClientCommands();
    expect(commands).toContainEqual({ type: 'playerFollow', targetId: mob.id });
    expect(commands).not.toContainEqual({ type: 'playerAttack', targetId: mob.id });
});
