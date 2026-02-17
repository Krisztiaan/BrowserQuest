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
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });

    const commands = kernel.drainClientCommands();
    expect(commands).not.toContainEqual({ type: 'playerFollow', targetId: mob.id });
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
        playerId,
        player,
        entities: { [String(mob.id)]: mob },
        kernel,
    });

    const commands = kernel.drainClientCommands();
    expect(commands).toContainEqual({ type: 'playerFollow', targetId: mob.id });
    expect(commands).not.toContainEqual({ type: 'playerAttack', targetId: mob.id });
});
