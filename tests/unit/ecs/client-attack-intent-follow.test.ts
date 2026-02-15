import { expect, test } from 'bun:test';
import Player from '../../../client/player';
import Mob from '../../../client/mob';
import { ClientWorldKernel } from '../../../client/ecs/world-kernel';
import { runClientInteractionIntentSystem } from '../../../client/ecs/systems/client-interaction-intent-system';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import Types from '../../../shared/gametypes-browser';

function setGrid(
    entity: {
        setGridPosition(x: number, y: number): void;
        gridX: number;
        gridY: number;
    },
    x: number,
    y: number
): void {
    entity.setGridPosition(x, y);
    entity.gridX = x;
    entity.gridY = y;
}

test('attack intent enqueues follow when non-adjacent', () => {
    const playerId = entityIdFromWire(5100);
    const player = new Player('player', 'K', Types.Entities.WARRIOR);
    (player as unknown as { id: number }).id = playerId;
    setGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1701), Types.Entities.RAT);
    setGrid(mob, 14, 10);

    const kernel = new ClientWorldKernel();
    kernel.clientSpatialRecords.set(playerId, {
        gridX: player.gridX,
        gridY: player.gridY,
        nextGridX: -1,
        nextGridY: -1,
        isMoving: false,
        isDead: false,
        kind: player.kind,
        isPlayer: true,
    });
    kernel.clientSpatialRecords.set(mob.id, {
        gridX: mob.gridX,
        gridY: mob.gridY,
        nextGridX: -1,
        nextGridY: -1,
        isMoving: false,
        isDead: false,
        kind: mob.kind,
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

test('attack intent emits ATTACK once adjacent even if target already assigned', () => {
    const playerId = entityIdFromWire(5101);
    const player = new Player('player', 'K', Types.Entities.WARRIOR);
    (player as unknown as { id: number }).id = playerId;
    setGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1702), Types.Entities.RAT);
    setGrid(mob, 11, 10);

    player.setTarget(mob);
    expect(player.isAttacking()).toBe(false);

    const kernel = new ClientWorldKernel();
    kernel.clientSpatialRecords.set(playerId, {
        gridX: player.gridX,
        gridY: player.gridY,
        nextGridX: -1,
        nextGridY: -1,
        isMoving: false,
        isDead: false,
        kind: player.kind,
        isPlayer: true,
    });
    kernel.clientSpatialRecords.set(mob.id, {
        gridX: mob.gridX,
        gridY: mob.gridY,
        nextGridX: -1,
        nextGridY: -1,
        isMoving: false,
        isDead: false,
        kind: mob.kind,
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
    const player = new Player('player', 'K', Types.Entities.WARRIOR);
    (player as unknown as { id: number }).id = playerId;
    player.setWeaponName('axe');
    setGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1703), Types.Entities.RAT);
    setGrid(mob, 12, 10);

    const kernel = new ClientWorldKernel();
    kernel.clientSpatialRecords.set(playerId, {
        gridX: player.gridX,
        gridY: player.gridY,
        nextGridX: -1,
        nextGridY: -1,
        isMoving: false,
        isDead: false,
        kind: player.kind,
        isPlayer: true,
    });
    kernel.clientSpatialRecords.set(mob.id, {
        gridX: mob.gridX,
        gridY: mob.gridY,
        nextGridX: -1,
        nextGridY: -1,
        isMoving: false,
        isDead: false,
        kind: mob.kind,
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
    const player = new Player('player', 'K', Types.Entities.WARRIOR);
    (player as unknown as { id: number }).id = playerId;
    player.setWeaponName('axe');
    setGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1704), Types.Entities.RAT);
    setGrid(mob, 11, 11);

    const kernel = new ClientWorldKernel();
    kernel.clientSpatialRecords.set(playerId, {
        gridX: player.gridX,
        gridY: player.gridY,
        nextGridX: -1,
        nextGridY: -1,
        isMoving: false,
        isDead: false,
        kind: player.kind,
        isPlayer: true,
    });
    kernel.clientSpatialRecords.set(mob.id, {
        gridX: mob.gridX,
        gridY: mob.gridY,
        nextGridX: -1,
        nextGridY: -1,
        isMoving: false,
        isDead: false,
        kind: mob.kind,
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
