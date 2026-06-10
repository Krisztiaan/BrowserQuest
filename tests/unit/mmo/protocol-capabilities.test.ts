import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { checkClientToServerProtocolAction, isServerToClientProtocolAction } from '../../../shared/protocol/schema';
import { encodeProtocolCapabilitiesJson } from '../../../shared/protocol/capabilities';
import GameClient from '../../../client/gameclient';
import Player from '../../../server/player';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import { gridPos } from '../../../shared/domain/positions';
import {
    encodeMapTransitionOutcomePayload,
    encodeMoveStepIntentPayload,
    OUTCOME_MAP_TRANSITION_BEGIN,
    OUTCOME_MAP_TRANSITION_COMMIT,
} from '../../../shared/protocol/intents';
import type { WorldMessage } from '../../../server/world/contracts';
import { joinFormattedArgs } from '../../support/format';

function createTestPlayer(wireId: number): Player {
    const connection = {
        id: String(wireId),
        listen() {},
        onClose() {},
        send() {},
        sendUTF8() {},
        close() {},
    };
    const player = new Player(connection, null);
    player.resetHitPoints(100);
    player.isDead = false;
    player.setPosition(0, 0);
    return player;
}

test('protocol schema accepts HELLO capability extension and new INTENT envelope', () => {
    const capsJson = encodeProtocolCapabilitiesJson({ moduleIds: ['core.doors'] });
    expect(checkClientToServerProtocolAction([Types.Messages.HELLO, 'name', 1, 2])).toBe(true);
    expect(checkClientToServerProtocolAction([Types.Messages.HELLO, 'name', 1, 2, 1, capsJson])).toBe(true);

    const payloadBytes = encodeMoveStepIntentPayload(gridPos(1, 2));
    expect(payloadBytes).not.toBeNull();
    expect(checkClientToServerProtocolAction([Types.Messages.INTENT, 5, 'move.step', payloadBytes as number[]])).toBe(true);
});

test('protocol schema rejects legacy C2S HIT/HURT actions', () => {
    expect(checkClientToServerProtocolAction([Types.Messages.HIT, 101])).toBe(false);
    expect(checkClientToServerProtocolAction([Types.Messages.HURT, 101])).toBe(false);
});

test('protocol schema accepts WELCOME capability extension and new OUTCOME/REJECT envelopes', () => {
    const capsJson = encodeProtocolCapabilitiesJson({ moduleIds: ['core.doors'] });
    expect(isServerToClientProtocolAction([Types.Messages.WELCOME, 1, 'name', 2, 3, 100])).toBe(true);
    expect(isServerToClientProtocolAction([Types.Messages.WELCOME, 1, 'name', 2, 3, 100, 2, capsJson])).toBe(true);

    expect(isServerToClientProtocolAction([Types.Messages.OUTCOME, 7, 'teleport.door', '{"x":10,"y":10}'])).toBe(true);
    expect(isServerToClientProtocolAction([Types.Messages.REJECT, 7, 'future.intent', 'Unknown intentTypeId'])).toBe(true);
});

test('client stores server capabilities from extended WELCOME and ignores unrecognized OUTCOME (logs once)', () => {
    const client = new GameClient('ws://example.invalid');
    const capsJson = encodeProtocolCapabilitiesJson({ moduleIds: ['core.doors'] });

    client.receiveWelcome([Types.Messages.WELCOME, 1, 'name', 2, 3, 100, 2, capsJson]);
    expect(client.serverProtocolRevision).toBe(2);
    expect(client.serverCapabilities?.moduleIds).toEqual(['core.doors']);

    const logged: string[] = [];
    const originalInfo = console.info;
    console.info = (...args: Array<string | number | boolean | object | null | undefined>) => {
        logged.push(joinFormattedArgs(args));
    };
    try {
        client.receiveOutcome([Types.Messages.OUTCOME, 1, 'future.outcome', '{}']);
        client.receiveOutcome([Types.Messages.OUTCOME, 2, 'future.outcome', '{}']);
    } finally {
        console.info = originalInfo;
    }

    expect(logged.length).toBe(1);
    expect(logged[0] ?? '').toMatch(/Ignoring .*outcomeTypeId:\s*future\.outcome/);
});

test('client emits map transition outcomes for recognized begin/commit outcome ids', () => {
    const client = new GameClient('ws://example.invalid');
    const payload = encodeMapTransitionOutcomePayload({
        fromMapId: 'overworld',
        toMapId: 'house_01',
        x: 10,
        y: 11,
    });
    expect(payload).not.toBeNull();

    const beginEvents: Array<{ seq: number; fromMapId: string; toMapId: string; x: number; y: number }> = [];
    const commitEvents: Array<{ seq: number; fromMapId: string; toMapId: string; x: number; y: number }> = [];
    client.on('mapTransitionBegin', (seq, fromMapId, toMapId, x, y) => {
        beginEvents.push({ seq, fromMapId, toMapId, x, y });
    });
    client.on('mapTransitionCommit', (seq, fromMapId, toMapId, x, y) => {
        commitEvents.push({ seq, fromMapId, toMapId, x, y });
    });

    client.receiveOutcome([Types.Messages.OUTCOME, 5, OUTCOME_MAP_TRANSITION_BEGIN, payload as string]);
    client.receiveOutcome([Types.Messages.OUTCOME, 5, OUTCOME_MAP_TRANSITION_COMMIT, payload as string]);

    expect(beginEvents).toEqual([{ seq: 5, fromMapId: 'overworld', toMapId: 'house_01', x: 10, y: 11 }]);
    expect(commitEvents).toEqual([{ seq: 5, fromMapId: 'overworld', toMapId: 'house_01', x: 10, y: 11 }]);
});

test('server rejects unrecognized INTENT intentTypeId without disconnecting', () => {
    const player = createTestPlayer(21601);

    const delivered: WorldMessage[] = [];
    const host = {
        ups: 50,
        map: {
            getCheckpoint() {
                return null;
            },
            isDoor() {
                return false;
            },
            getDoorDestination() {
                return null;
            },
            getGroupIdFromPosition() {
                return 'g';
            },
            forEachAdjacentGroup(_groupId: string | null | undefined, cb: (groupId: string) => void) {
                cb('g');
            },
        },
        getConnectionPlayerById(id: number) {
            return id === player.id ? player : null;
        },
        removeEntityFromAreas() {},
        scheduleMobRespawn() {},
        scheduleStaticItemRespawn() {},
        getEntityById() {
            return null;
        },
        addPlayer() {},
        emitPlayerEnter() {},
        isPlayerActive(id: number) {
            return id === player.id;
        },
        pushSpawnsToPlayerId() {},
        isValidPosition() {
            return true;
        },
        getDroppedItem() {
            return null;
        },
        handleItemDespawn() {},
        moveEntity(_entity: { setPosition: (x: number, y: number) => void }, _x: number, _y: number) {},
        removeEntity() {},
        addItemFromChest() {
            return null;
        },
        pushToPlayerId(playerId: number, message: WorldMessage) {
            if (playerId === player.id) {
                delivered.push(message);
            }
        },
        persistPlayerEquipment() {},
        persistPlayerCheckpoint() {},
        persistPlayerAchievementUnlock() {},
        recordPlayerMobKill() {},
        recordPlayerDamageTaken() {},
        recordPlayerRevive() {},
    };

    const pipeline = new WorldEcsCommandPipeline(host as never);
    pipeline.state.world.ensureEntity(player.id);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(0, 0));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);
    player.setPosition(0, 0);

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'future.intent',
        payloadJson: '{}',
    });

    pipeline.tick();

    expect(
        delivered.some(
            (msg) =>
                Array.isArray(msg) &&
                msg[0] === Types.Messages.REJECT &&
                msg[1] === 1 &&
                msg[2] === 'future.intent' &&
                String(msg[3]).includes('Unknown intentTypeId')
        )
    ).toBe(true);
});
