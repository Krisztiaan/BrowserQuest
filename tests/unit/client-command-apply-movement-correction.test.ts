import { expect, test } from 'bun:test';
import { entityIdFromWire } from '../../shared/domain/ids';
import { gridPos } from '../../shared/domain/positions';
import { ClientWorldKernel } from '../../client/ecs/world-kernel';
import { runClientCommandApplySystem } from '../../client/ecs/systems/client-command-apply-system';
import { runClientCombatSystem } from '../../client/ecs/systems/client-combat-system';
import Warrior from '../../client/warrior';
import Mob from '../../client/mob';
import Types from '../../shared/gametypes-browser';
import { getZoneGroupIdFromGrid, isOutOfBoundsGridPosition } from '../../shared/world/coordinate-contract';
import { tileToWorldPosCenter } from '../../shared/world/worldpos';

function createHostFixture(playerId: number) {
    const kernel = new ClientWorldKernel();
    const player = new Warrior('player', 'K');
    player.id = playerId;
    player.kind = Types.Entities.WARRIOR;
    player.setGridPosition(10, 10);

    const entities: Record<string, Warrior> = {
        [String(playerId)]: player,
    };
    const teleports: Array<{ x: number; y: number }> = [];
    const chunkSubscriptions: Array<{ chunkX: number; chunkY: number; radius: number }> = [];
    const loadMapByIdCalls: string[] = [];
    const notifications: string[] = [];
    const sentAttacks: number[] = [];
    const attackLinks: Array<{ attackerId: number; targetId: number }> = [];
    let chunkUnsubscribeCount = 0;
    let resetCameraCalls = 0;

    const host = {
        kernel,
        started: true,
        client: {
            sendMove() {},
            sendChunkSubscribe(chunkX: number, chunkY: number, radius: number) {
                chunkSubscriptions.push({ chunkX, chunkY, radius });
            },
            sendChunkUnsubscribe() {
                chunkUnsubscribeCount += 1;
            },
            sendAttack(mob: { id: number }) {
                sentAttacks.push(mob.id);
            },
            sendOpen() {},
        },
        playerId: entityIdFromWire(playerId),
        player,
        entities,
        map: { isOutOfBounds: () => false, grid: [[0]] },
        renderer: null,
        obsoleteEntities: null,
        connectionStartedCallback: null,
        audioManager: null,
        app: { initUnlockedAchievements() {} },
        infoManager: { addDamageInfo() {} },
        sprites: {},
        storage: {
            hasAlreadyPlayed: () => true,
            initPlayer() {},
            savePlayer() {},
            setPlayerName() {},
            applyAchievementProgressSnapshot() {},
            incrementTotalKills() {},
            incrementRatCount() {},
            incrementSkeletonCount() {},
            addDamage() {},
            data: { achievements: { unlocked: [] } },
        },
        emit() {},
        stopPlayerCombat() {},
        makePlayerGoTo() {},
        makePlayerGoToItem() {},
        getEntityById(id: number) {
            return entities[String(id)] ?? null;
        },
        makeCharacterTeleportTo(entity: Warrior, x: number, y: number) {
            teleports.push({ x, y });
            entity.setGridPosition(x, y);
        },
        makeCharacterGoTo() {},
        createAttackLink(attacker: { id: number }, target: { id: number }) {
            attackLinks.push({ attackerId: attacker.id, targetId: target.id });
        },
        removeItem() {},
        removeEntity() {},
        enqueueZoningFrom() {},
        makePlayerAttack() {},
        makePlayerTalkTo() {},
        makePlayerOpenChest() {},
        makeNpcTalk() {},
        updateBars() {},
        resetCamera() {
            resetCameraCalls += 1;
        },
        addEntity(entity: Warrior) {
            entities[String(entity.id)] = entity;
        },
        showNotification(message: string) {
            notifications.push(message);
        },
        loadMapById(mapId: string) {
            loadMapByIdCalls.push(mapId);
            return Promise.resolve();
        },
        tryUnlockingAchievement() {},
        createBubble() {},
        removeObsoleteEntities() {},
        setPlayerId(id: number) {
            host.playerId = id;
        },
        setPlayerName(name: string) {
            player.name = name;
        },
        setPlayerGridPosition(x: number, y: number) {
            player.setGridPosition(x, y);
        },
        setPlayerMaxHitPoints(hp: number) {
            player.setMaxHitPoints(hp);
        },
        setPlayerHealth(points: number) {
            player.hitPoints = points;
        },
        addItemFromUnknown() {},
    } as Parameters<typeof runClientCommandApplySystem>[0];

    return {
        host,
        kernel,
        player,
        teleports,
        chunkSubscriptions,
        loadMapByIdCalls,
        notifications,
        sentAttacks,
        attackLinks,
        getChunkUnsubscribeCount: () => chunkUnsubscribeCount,
        getResetCameraCalls: () => resetCameraCalls,
    };
}

test('applyWelcome seeds local player in kernel authoritative position state', () => {
    const playerId = entityIdFromWire(7001);
    const { host, kernel, chunkSubscriptions } = createHostFixture(playerId);

    kernel.enqueueClientCommand({
        type: 'applyWelcome',
        id: playerId,
        name: 'K',
        x: 8,
        y: 9,
        maxHp: 120,
    });

    runClientCommandApplySystem(host);

    expect(kernel.alive.has(playerId)).toBe(true);
    expect(kernel.position.get(playerId)).toEqual(gridPos(8, 9));
    expect(kernel.clientLastSentMovePos).toEqual(gridPos(8, 9));
    expect(chunkSubscriptions).toEqual([{ chunkX: 0, chunkY: 0, radius: 3 }]);
});

test('coordinate contract handles edge grid coordinates consistently', () => {
    expect(isOutOfBoundsGridPosition(0, 0, 100, 100)).toBe(false);
    expect(isOutOfBoundsGridPosition(1, 1, 100, 100)).toBe(false);
    expect(isOutOfBoundsGridPosition(99, 99, 100, 100)).toBe(false);
    expect(isOutOfBoundsGridPosition(-1, 0, 100, 100)).toBe(true);
    expect(isOutOfBoundsGridPosition(100, 99, 100, 100)).toBe(true);
    expect(isOutOfBoundsGridPosition(99, 100, 100, 100)).toBe(true);

    expect(getZoneGroupIdFromGrid(0, 0, 28, 12)).toBe('0-0');
    expect(getZoneGroupIdFromGrid(1, 1, 28, 12)).toBe('0-0');
    expect(getZoneGroupIdFromGrid(27, 11, 28, 12)).toBe('0-0');
    expect(getZoneGroupIdFromGrid(28, 12, 28, 12)).toBe('1-1');
    expect(getZoneGroupIdFromGrid(99, 99, 28, 12)).toBe('3-8');
});

test('clientSendChunkUnsubscribe forwards to client transport', () => {
    const playerId = entityIdFromWire(7010);
    const { host, kernel, getChunkUnsubscribeCount } = createHostFixture(playerId);

    kernel.enqueueClientCommand({ type: 'clientSendChunkUnsubscribe' });
    runClientCommandApplySystem(host);

    expect(getChunkUnsubscribeCount()).toBe(1);
});

test('local player adjacent characterGoTo starts authoritative step', () => {
    const playerId = entityIdFromWire(7002);
    const { host, kernel, player, teleports } = createHostFixture(playerId);
    player.setGridPosition(10, 10);

    kernel.enqueueClientCommand({ type: 'characterGoTo', entityId: playerId, x: 11, y: 10 });
    runClientCommandApplySystem(host);

    expect(teleports.length).toBe(0);
    expect(player.isMoving()).toBe(true);
    expect(player.nextGridX).toBe(11);
    expect(player.nextGridY).toBe(10);
});

test('local player non-adjacent characterGoTo snaps to authoritative position (teleport)', () => {
    const playerId = entityIdFromWire(7003);
    const { host, kernel, player, teleports } = createHostFixture(playerId);
    player.setGridPosition(13, 10);

    kernel.enqueueClientCommand({ type: 'characterGoTo', entityId: playerId, x: 1, y: 1 });
    runClientCommandApplySystem(host);

    expect(teleports).toEqual([{ x: 1, y: 1 }]);
    expect(player.isMoving()).toBe(false);
    expect(player.gridX).toBe(1);
    expect(player.gridY).toBe(1);
});

test('playerGoTo plans steps and starts local prediction immediately', () => {
    const playerId = entityIdFromWire(7004);
    const { host, kernel, player } = createHostFixture(playerId);

    player.setPathRequestResolver(() => [
        [10, 10],
        [11, 10],
        [12, 10],
    ]);

    kernel.enqueueClientCommand({ type: 'playerGoTo', x: 12, y: 10 });
    runClientCommandApplySystem(host);

    expect(player.isMoving()).toBe(true);
    expect(kernel.clientMovePlan?.steps).toEqual([gridPos(11, 10), gridPos(12, 10)]);
    expect(kernel.clientMovePlan?.requestedTo).toEqual(gridPos(12, 10));
    expect(kernel.clientMovePlan?.target).toEqual(gridPos(12, 10));
});

test('playerGoTo in lockstep mode plans movement but does not start local prediction pathing', () => {
    const playerId = entityIdFromWire(70041);
    const { host, kernel, player } = createHostFixture(playerId);
    kernel.setClientMovementNetcodeMode('lockstep');

    player.setPathRequestResolver(() => [
        [10, 10],
        [11, 10],
        [12, 10],
    ]);

    kernel.enqueueClientCommand({ type: 'playerGoTo', x: 12, y: 10 });
    runClientCommandApplySystem(host);

    expect(kernel.clientMovePlan?.steps).toEqual([gridPos(11, 10), gridPos(12, 10)]);
    expect(player.isMoving()).toBe(false);
    expect(player.path).toBeNull();
});

test('playerGoTo plan cancels stale pending move acks and plans from rendered player position', () => {
    const playerId = entityIdFromWire(70011);
    const { host, kernel, player } = createHostFixture(playerId);
    const pathOrigins: Array<{ x: number; y: number }> = [];

    player.setPathRequestResolver((toX, toY) => {
        pathOrigins.push({ x: player.gridX, y: player.gridY });
        return [
            [player.gridX, player.gridY],
            [player.gridX + 1, player.gridY],
            [toX, toY],
        ];
    });

    kernel.enqueueClientPendingMoveAck(11, 10);
    kernel.enqueueClientPendingMoveAck(12, 10);
    kernel.enqueueClientPendingMoveSeqAck(31);

    kernel.enqueueClientCommand({ type: 'playerGoTo', x: 14, y: 10 });
    runClientCommandApplySystem(host);

    expect(pathOrigins).toEqual([{ x: 10, y: 10 }]);
    expect(kernel.clientPendingMoveAcks.length).toBe(0);
    expect(kernel.clientPendingMoveSeqAcks.length).toBe(0);
    expect(kernel.clientMovePlan?.steps).toEqual([gridPos(11, 10), gridPos(14, 10)]);
    expect(kernel.clientMovePlan?.requestedTo).toEqual(gridPos(14, 10));
    expect(kernel.clientMovePlan?.target).toEqual(gridPos(14, 10));
});

test('playerGoTo ignores authoritative kernel lag when building a predicted click plan', () => {
    const playerId = entityIdFromWire(70012);
    const { host, kernel, player } = createHostFixture(playerId);
    const pathOrigins: Array<{ x: number; y: number }> = [];

    player.setPathRequestResolver((toX, toY) => {
        pathOrigins.push({ x: player.gridX, y: player.gridY });
        return [
            [player.gridX, player.gridY],
            [player.gridX + 1, player.gridY],
            [toX, toY],
        ];
    });

    kernel.position.set(playerId, gridPos(11, 10));

    kernel.enqueueClientCommand({ type: 'playerGoTo', x: 13, y: 10 });
    runClientCommandApplySystem(host);

    expect(pathOrigins).toEqual([{ x: 10, y: 10 }]);
    expect(kernel.clientMovePlan?.steps).toEqual([gridPos(11, 10), gridPos(13, 10)]);
    expect(kernel.clientMovePlan?.requestedTo).toEqual(gridPos(13, 10));
    expect(kernel.clientMovePlan?.target).toEqual(gridPos(13, 10));
});

test('repeating the same playerGoTo while it is already in flight preserves the active plan and pending acks', () => {
    const playerId = entityIdFromWire(700121);
    const { host, kernel, player } = createHostFixture(playerId);
    const pathRequests: Array<{ x: number; y: number }> = [];

    player.setPathRequestResolver((toX, toY) => {
        pathRequests.push({ x: toX, y: toY });
        return [
            [10, 10],
            [11, 11],
            [12, 12],
        ];
    });

    kernel.enqueueClientCommand({ type: 'playerGoTo', x: 12, y: 12 });
    runClientCommandApplySystem(host);

    kernel.enqueueClientPendingMoveAck(11, 11);
    kernel.enqueueClientPendingMoveSeqAck(41);
    const activePlan = kernel.clientMovePlan;
    expect(activePlan).not.toBeNull();
    if (!activePlan) {
        throw new Error('Expected active move plan');
    }
    kernel.clientMovePlan = { ...activePlan, sent: true };

    kernel.enqueueClientCommand({ type: 'playerGoTo', x: 12, y: 12 });
    runClientCommandApplySystem(host);

    expect(pathRequests).toEqual([{ x: 12, y: 12 }, { x: 12, y: 12 }]);
    expect(kernel.clientPendingMoveAcks).toEqual([gridPos(11, 11)]);
    expect(kernel.clientPendingMoveSeqAcks).toEqual([41]);
    expect(kernel.clientMovePlan).toEqual({ ...activePlan, sent: true });
});

test('replanning with an overlapping in-flight path keeps the shared steps and only rolls in the new tail', () => {
    const playerId = entityIdFromWire(700122);
    const { host, kernel, player } = createHostFixture(playerId);

    player.setPathRequestResolver((toX, toY) => {
        if (toX === 13 && toY === 13) {
            return [
                [10, 10],
                [11, 11],
                [12, 12],
                [13, 13],
            ];
        }
        return [
            [10, 10],
            [12, 12],
            [13, 13],
            [14, 14],
        ];
    });

    kernel.enqueueClientCommand({ type: 'playerGoTo', x: 13, y: 13 });
    runClientCommandApplySystem(host);

    kernel.enqueueClientPendingMoveAck(11, 11);
    kernel.enqueueClientPendingMoveSeqAck(51);
    player.go(13, 13);
    kernel.enqueueClientCommand({ type: 'playerGoTo', x: 14, y: 14 });
    runClientCommandApplySystem(host);

    expect(kernel.clientPendingMoveAcks).toEqual([gridPos(11, 11)]);
    expect(kernel.clientPendingMoveSeqAcks).toEqual([51]);
    expect(kernel.clientMovePlan?.steps).toEqual([gridPos(11, 11), gridPos(12, 12), gridPos(13, 13), gridPos(14, 14)]);
    expect(player.newDestination).toEqual({ x: 14, y: 14 });
});

test('replanning with a shared leading diagonal segment replaces only the diverging tail', () => {
    const playerId = entityIdFromWire(700123);
    const { host, kernel, player } = createHostFixture(playerId);

    player.setPathRequestResolver((toX, toY) => {
        if (toX === 14 && toY === 14) {
            return [
                [10, 10],
                [11, 11],
                [12, 12],
                [13, 13],
                [14, 14],
            ];
        }
        return [
            [10, 10],
            [11, 11],
            [12, 12],
            [12, 13],
            [12, 14],
        ];
    });

    kernel.enqueueClientCommand({ type: 'playerGoTo', x: 14, y: 14 });
    runClientCommandApplySystem(host);

    kernel.enqueueClientPendingMoveAck(11, 11);
    kernel.enqueueClientPendingMoveSeqAck(61);
    player.go(14, 14);
    kernel.enqueueClientCommand({ type: 'playerGoTo', x: 12, y: 14 });
    runClientCommandApplySystem(host);

    expect(kernel.clientPendingMoveAcks).toEqual([gridPos(11, 11)]);
    expect(kernel.clientPendingMoveSeqAcks).toEqual([61]);
    expect(kernel.clientMovePlan?.steps).toEqual([gridPos(11, 11), gridPos(12, 12), gridPos(12, 13), gridPos(12, 14)]);
    expect(player.newDestination).toEqual({ x: 12, y: 14 });
});

test('playerStop clears queued move plan and pending move acks', () => {
    const playerId = entityIdFromWire(7006);
    const { host, kernel } = createHostFixture(playerId);

    kernel.setClientMovePlan({
        requestedTo: gridPos(12, 10),
        target: gridPos(12, 10),
        steps: [gridPos(11, 10), gridPos(12, 10)],
        stopAdjacentToTarget: false,
    });
    kernel.enqueueClientPendingMoveAck(12, 10);
    kernel.enqueueClientPendingMoveSeqAck(99);

    kernel.enqueueClientCommand({ type: 'playerStop' });
    runClientCommandApplySystem(host);

    expect(kernel.clientMovePlan).toBeNull();
    expect(kernel.clientPendingMoveAcks.length).toBe(0);
    expect(kernel.clientPendingMoveSeqAcks.length).toBe(0);
});

test('teleportEntity for local player clears stale pending move acks', () => {
    const playerId = entityIdFromWire(7005);
    const { host, kernel, player, teleports } = createHostFixture(playerId);
    player.setGridPosition(4, 4);
    kernel.enqueueClientPendingMoveAck(5, 4);
    kernel.enqueueClientPendingMoveAck(6, 4);

    kernel.enqueueClientCommand({ type: 'teleportEntity', entityId: playerId, x: 8, y: 4 });
    runClientCommandApplySystem(host);

    expect(teleports).toEqual([{ x: 8, y: 4 }]);
    expect(player.gridX).toBe(8);
    expect(player.gridY).toBe(4);
    expect(kernel.clientPendingMoveAcks.length).toBe(0);
    expect(kernel.clientMovePlan).toBeNull();
    expect(kernel.clientLastSentMovePos).toEqual(gridPos(8, 4));
});

test('teleportEntity cancels local pathing so client does not continue obsolete predicted moves', () => {
    const playerId = entityIdFromWire(7008);
    const { host, kernel, player } = createHostFixture(playerId);

    player.setPathRequestResolver(() => [
        [10, 10],
        [11, 10],
        [12, 10],
    ]);
    player.go(12, 10);
    expect(player.isMoving()).toBe(true);

    kernel.enqueueClientCommand({ type: 'teleportEntity', entityId: playerId, x: 8, y: 4 });
    runClientCommandApplySystem(host);

    expect(player.isMoving()).toBe(false);
    expect(player.gridX).toBe(8);
    expect(player.gridY).toBe(4);
});

test('setEntityWorldPosition keeps local predicted path movement active', () => {
    const playerId = entityIdFromWire(7011);
    const { host, kernel, player } = createHostFixture(playerId);
    kernel.upsertSimpleEntity(playerId, player.kind, player.gridX, player.gridY);

    player.setPathRequestResolver(() => [
        [10, 10],
        [11, 10],
        [12, 10],
    ]);
    player.go(12, 10);
    expect(player.isMoving()).toBe(true);

    const world = tileToWorldPosCenter(11, 10);
    kernel.enqueueClientCommand({
        type: 'setEntityWorldPosition',
        entityId: playerId,
        worldX: world.x,
        worldY: world.y,
        visualDivergenceClass: 'ordinary',
    });
    runClientCommandApplySystem(host);

    expect(player.isMoving()).toBe(true);
    expect(kernel.getClientPresentationTargetWorldPosition(playerId)).toEqual(world);
});

test('setEntityWorldPosition updates remote character visual target through the bridge without snapping render', () => {
    const playerId = entityIdFromWire(70114);
    const { host, kernel } = createHostFixture(playerId);
    const remoteId = entityIdFromWire(8129);
    const remote = new Warrior('player', 'remote');
    remote.id = remoteId;
    remote.kind = Types.Entities.WARRIOR;
    remote.setGridPosition(20, 20);
    host.entities[String(remoteId)] = remote;
    kernel.upsertSimpleEntity(remoteId, remote.kind, remote.gridX, remote.gridY);

    const renderBefore = { x: remote.x, y: remote.y };
    const world = tileToWorldPosCenter(21, 20);
    kernel.enqueueClientCommand({
        type: 'setEntityWorldPosition',
        entityId: remoteId,
        worldX: world.x,
        worldY: world.y,
        visualDivergenceClass: 'ordinary',
    });
    runClientCommandApplySystem(host);

    expect(remote.x).toBe(renderBefore.x);
    expect(remote.y).toBe(renderBefore.y);
    expect(remote.visualState.targetRenderWorldX).toBe(world.x);
    expect(remote.visualState.targetRenderWorldY).toBe(world.y);
    expect(remote.visualState.visualMoveMode).toBe('interpolate');
    expect(remote.visualState.visualDivergenceClass).toBe('ordinary');
});

test('setEntityWorldPosition remote discontinuity snaps through the bridge', () => {
    const playerId = entityIdFromWire(70115);
    const { host, kernel } = createHostFixture(playerId);
    const remoteId = entityIdFromWire(8130);
    const remote = new Warrior('player', 'remote');
    remote.id = remoteId;
    remote.kind = Types.Entities.WARRIOR;
    remote.setGridPosition(20, 20);
    host.entities[String(remoteId)] = remote;
    kernel.upsertSimpleEntity(remoteId, remote.kind, remote.gridX, remote.gridY);

    const world = tileToWorldPosCenter(25, 24);
    kernel.enqueueClientCommand({
        type: 'setEntityWorldPosition',
        entityId: remoteId,
        worldX: world.x,
        worldY: world.y,
        visualDivergenceClass: 'remote_discontinuity',
    });
    runClientCommandApplySystem(host);

    expect(remote.visualState.renderWorldX).toBe(world.x);
    expect(remote.visualState.renderWorldY).toBe(world.y);
    expect(remote.visualState.targetRenderWorldX).toBe(world.x);
    expect(remote.visualState.targetRenderWorldY).toBe(world.y);
    expect(remote.visualState.visualMoveMode).toBe('snap');
    expect(remote.visualState.visualDivergenceClass).toBe('remote_discontinuity');
    expect(kernel.getClientRenderedWorldPosition(remoteId)).toEqual(world);
});

test('teleportEntity resets kernel presentation state to the authoritative tile center', () => {
    const playerId = entityIdFromWire(7013);
    const { host, kernel, player } = createHostFixture(playerId);
    kernel.upsertSimpleEntity(playerId, player.kind, player.gridX, player.gridY);

    kernel.setClientRenderedWorldPosition(playerId, 123, 456);
    kernel.setClientPresentationTargetWorldPosition(playerId, 234, 567);
    kernel.enqueueClientCommand({ type: 'teleportEntity', entityId: playerId, x: 8, y: 4 });
    runClientCommandApplySystem(host);

    const teleported = tileToWorldPosCenter(8, 4);
    expect(kernel.getClientPresentationTargetWorldPosition(playerId)).toEqual(teleported);
    expect(kernel.getClientRenderedWorldPosition(playerId)).toEqual(teleported);
});

test('playerAttack sends attack intent without creating a local optimistic attack link', () => {
    const playerId = entityIdFromWire(7100);
    const { host, kernel, sentAttacks, attackLinks } = createHostFixture(playerId);
    const mobId = entityIdFromWire(9001);
    const mob = new Mob(mobId, Types.Entities.RAT);
    mob.setGridPosition(11, 10);
    host.entities[String(mobId)] = mob as never;

    kernel.enqueueClientCommand({ type: 'playerAttack', targetId: mobId });
    runClientCommandApplySystem(host);

    expect(sentAttacks).toEqual([mobId]);
    expect(attackLinks).toEqual([]);
});

test('non-local adjacent characterGoTo starts authoritative step without pathfinder', () => {
    const playerId = entityIdFromWire(7006);
    const { host, kernel, teleports } = createHostFixture(playerId);
    const mobId = entityIdFromWire(8123);
    const mob = new Warrior('player', 'mob');
    mob.id = mobId;
    mob.kind = Types.Entities.RAT;
    mob.setGridPosition(20, 20);
    host.entities[String(mobId)] = mob;

    kernel.enqueueClientCommand({ type: 'characterGoTo', entityId: mobId, x: 21, y: 20 });
    runClientCommandApplySystem(host);

    expect(mob.isMoving()).toBe(true);
    expect(mob.nextGridX).toBe(21);
    expect(mob.nextGridY).toBe(20);
    expect(teleports.length).toBe(0);
});

test('non-local moving character ignores duplicate destination ack without teleport', () => {
    const playerId = entityIdFromWire(7007);
    const { host, kernel, teleports } = createHostFixture(playerId);
    const mobId = entityIdFromWire(8124);
    const mob = new Warrior('player', 'mob');
    mob.id = mobId;
    mob.kind = Types.Entities.RAT;
    mob.setGridPosition(20, 20);
    mob.setPathRequestResolver(() => [
        [20, 20],
        [21, 20],
    ]);
    mob.moveTo_(21, 20);
    host.entities[String(mobId)] = mob;

    kernel.enqueueClientCommand({ type: 'characterGoTo', entityId: mobId, x: 21, y: 20 });
    runClientCommandApplySystem(host);

    expect(mob.nextGridX).toBe(21);
    expect(mob.nextGridY).toBe(20);
    expect(teleports.length).toBe(0);
});

test('non-local moving character appends adjacent authoritative steps while mid-path', () => {
    const playerId = entityIdFromWire(7008);
    const { host, kernel, teleports } = createHostFixture(playerId);
    const mobId = entityIdFromWire(8125);
    const mob = new Warrior('player', 'mob');
    mob.id = mobId;
    mob.kind = Types.Entities.RAT;
    mob.setGridPosition(20, 20);
    mob.setPathRequestResolver(() => [
        [20, 20],
        [21, 20],
    ]);
    mob.moveTo_(21, 20);
    host.entities[String(mobId)] = mob;

    kernel.enqueueClientCommand({ type: 'characterGoTo', entityId: mobId, x: 22, y: 20 });
    runClientCommandApplySystem(host);

    expect(teleports.length).toBe(0);
    expect(mob.newDestination).toBeNull();
    expect(mob.path?.length).toBe(3);
    expect(mob.path?.[mob.path.length - 1]).toEqual([22, 20]);
});

test('non-local moving character teleports on non-adjacent authoritative gap while mid-step', () => {
    const playerId = entityIdFromWire(7009);
    const { host, kernel, teleports } = createHostFixture(playerId);
    const mobId = entityIdFromWire(8126);
    const mob = new Warrior('player', 'mob');
    mob.id = mobId;
    mob.kind = Types.Entities.RAT;
    mob.setGridPosition(20, 20);
    mob.setPathRequestResolver(() => [
        [20, 20],
        [21, 20],
    ]);
    mob.moveTo_(21, 20);
    host.entities[String(mobId)] = mob;

    kernel.enqueueClientCommand({ type: 'characterGoTo', entityId: mobId, x: 24, y: 20 });
    runClientCommandApplySystem(host);

    expect(teleports).toEqual([{ x: 24, y: 20 }]);
    expect(mob.isMoving()).toBe(false);
    expect(mob.gridX).toBe(24);
    expect(mob.gridY).toBe(20);
    expect(mob.newDestination).toBeNull();
});

test('non-local stationary character teleports on non-adjacent authoritative gap', () => {
    const playerId = entityIdFromWire(7010);
    const { host, kernel, teleports } = createHostFixture(playerId);
    const mobId = entityIdFromWire(8127);
    const mob = new Warrior('player', 'mob');
    mob.id = mobId;
    mob.kind = Types.Entities.RAT;
    mob.setGridPosition(20, 20);
    host.entities[String(mobId)] = mob;

    kernel.enqueueClientCommand({ type: 'characterGoTo', entityId: mobId, x: 24, y: 20 });
    runClientCommandApplySystem(host);

    expect(teleports).toEqual([{ x: 24, y: 20 }]);
    expect(mob.gridX).toBe(24);
    expect(mob.gridY).toBe(20);
});

test('characterClearTarget hard-stops active movement immediately', () => {
    const playerId = entityIdFromWire(7011);
    const { host, kernel } = createHostFixture(playerId);
    const mobId = entityIdFromWire(8128);
    const mob = new Warrior('player', 'mob');
    mob.id = mobId;
    mob.kind = Types.Entities.RAT;
    mob.setGridPosition(20, 20);
    mob.setPathRequestResolver(() => [
        [20, 20],
        [21, 20],
    ]);
    mob.moveTo_(21, 20);
    host.entities[String(mobId)] = mob;

    kernel.enqueueClientCommand({ type: 'characterClearTarget', entityId: mobId });
    runClientCommandApplySystem(host);

    expect(mob.isMoving()).toBe(false);
    expect(mob.nextGridX).toBe(-1);
    expect(mob.nextGridY).toBe(-1);
});

test('map transition defers local teleport until target map activation + commit', async () => {
    const playerId = entityIdFromWire(7012);
    const { host, kernel, teleports, loadMapByIdCalls, getResetCameraCalls } = createHostFixture(playerId);

    kernel.enqueueClientCommand({
        type: 'beginMapTransition',
        seq: 100,
        fromMapId: 'world',
        toMapId: 'house',
        x: 3,
        y: 4,
    });
    runClientCommandApplySystem(host);

    expect(loadMapByIdCalls).toEqual(['house']);
    expect(kernel.clientMovementSuppressed).toBe(true);

    kernel.enqueueClientCommand({
        type: 'teleportEntity',
        entityId: playerId,
        x: 5,
        y: 6,
        mapId: 'house',
    });
    runClientCommandApplySystem(host);
    expect(teleports).toEqual([]);

    kernel.enqueueClientCommand({
        type: 'commitMapTransition',
        seq: 100,
        fromMapId: 'world',
        toMapId: 'house',
        x: 3,
        y: 4,
    });
    runClientCommandApplySystem(host);
    expect(teleports).toEqual([]);
    expect(kernel.clientMovementSuppressed).toBe(true);

    await Promise.resolve();
    runClientCommandApplySystem(host);

    expect(teleports).toEqual([{ x: 5, y: 6 }]);
    expect(kernel.clientMovementSuppressed).toBe(false);
    expect(getResetCameraCalls()).toBe(1);
});

test('combat system never repositions non-local mobs client-side', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(7200);
    const mobId = entityIdFromWire(7201);

    const player = new Warrior('player', 'K');
    player.id = playerId;
    player.kind = Types.Entities.WARRIOR;
    player.setGridPosition(10, 10);
    player.orientation = Types.Orientations.DOWN;

    const mob = new Warrior('mob', 'mob');
    mob.id = mobId;
    mob.kind = Types.Entities.SKELETON;
    mob.setGridPosition(11, 11);
    mob.attackingMode = true;
    mob.setTarget(player);

    const host = {
        started: true,
        currentTime: 0,
        playerId,
        player,
        entities: { [String(playerId)]: player, [String(mobId)]: mob },
        map: { isColliding: () => false },
        camera: { isVisible: () => false },
        kernel,
    };

    runClientCombatSystem(host as never);
    const cmds = kernel.drainClientCommands();

    expect(cmds.some((cmd) => cmd.type === 'combatRepositionAttacker')).toBe(false);
    expect(cmds.some((cmd) => cmd.type === 'combatRelinkPreviousTarget')).toBe(false);
    expect(cmds.some((cmd) => cmd.type === 'characterFollow')).toBe(false);
    expect(cmds.some((cmd) => cmd.type === 'playerFollow')).toBe(false);
});
