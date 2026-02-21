import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { ClientWorldKernel } from '../../../client/ecs/world-kernel';
import GameClient from '../../../client/gameclient';
import { encodeProtocolCapabilitiesJson } from '../../../shared/protocol/capabilities';
import type { ClientToServerProtocolAction } from '../../../shared/protocol/types';
import { runClientPlayerMoveOutboxSystem } from '../../../client/ecs/systems/client-player-move-outbox-system';
import {
    encodeClaimCreateIntentPayload,
    encodeClaimDeleteIntentPayload,
    encodeMoveStepIntentPayload,
    encodeTileEditIntentPayload,
} from '../../../shared/protocol/intents';
import { gridPos } from '../../../shared/domain/positions';

test('client refuses movement sends until move.step capability is known', () => {
    const kernel = new ClientWorldKernel();
    const client = new GameClient('ws://example.invalid', kernel);

    const sent: ClientToServerProtocolAction[] = [];
    client.sendMessage = (action) => {
        sent.push(action);
    };

    client.sendMove(1, 2);

    expect(sent).toEqual([]);
    expect(kernel.clientPendingMoveSeqAcks.length).toBe(0);
});

test('client sends sequenced INTENT for movement and consumes ACK by seq', () => {
    const kernel = new ClientWorldKernel();
    const client = new GameClient('ws://example.invalid', kernel);

    const sent: ClientToServerProtocolAction[] = [];
    client.sendMessage = (action) => {
        sent.push(action);
    };

    const capsJson = encodeProtocolCapabilitiesJson({ intentTypeIds: ['move.step'] });
    client.receiveWelcome([Types.Messages.WELCOME, 1, 'name', 0, 0, 100, 1, capsJson]);

    client.sendMove(5, 6);
    client.sendMove(5, 7);

    expect(sent.length).toBe(2);
    expect(sent[0]).toEqual([Types.Messages.INTENT, 1, 'move.step', encodeMoveStepIntentPayload(gridPos(5, 6)) ?? []]);
    expect(sent[1]).toEqual([Types.Messages.INTENT, 2, 'move.step', encodeMoveStepIntentPayload(gridPos(5, 7)) ?? []]);
    expect(kernel.clientPendingMoveSeqAcks).toEqual([1, 2]);

    client.receiveAck([Types.Messages.ACK, 1]);
    expect(kernel.clientPendingMoveSeqAcks).toEqual([2]);
});

test('client tracks move.input seq and MOVE_SYNC prunes pending movement seqs', () => {
    const kernel = new ClientWorldKernel();
    const client = new GameClient('ws://example.invalid', kernel);

    const sent: ClientToServerProtocolAction[] = [];
    client.sendMessage = (action) => {
        sent.push(action);
    };

    const capsJson = encodeProtocolCapabilitiesJson({ intentTypeIds: ['move.input'] });
    client.receiveWelcome([Types.Messages.WELCOME, 1, 'name', 0, 0, 100, 1, capsJson]);

    client.sendMoveInput(1); // MOVE_INPUT_KEY_D
    expect(sent.length).toBe(1);
    expect(kernel.clientPendingMoveSeqAcks).toEqual([1]);

    // Authoritative sync point ACKs the move.input seq and should prune pending seqs up to that value.
    client.receiveMoveSync([Types.Messages.MOVE_SYNC, 1, 0, 0, 0, 0]);
    expect(kernel.clientPendingMoveSeqAcks).toEqual([]);
});

test('movement CORRECTION suppresses outbox and enqueues teleportEntity for local player', () => {
    const kernel = new ClientWorldKernel();
    const client = new GameClient('ws://example.invalid', kernel);

    const capsJson = encodeProtocolCapabilitiesJson({ intentTypeIds: ['move.step'] });
    client.receiveWelcome([Types.Messages.WELCOME, 1, 'name', 0, 0, 100, 1, capsJson]);
    client.sendMove(1, 0);
    expect(kernel.clientPendingMoveSeqAcks).toEqual([1]);

    client.receiveCorrection([Types.Messages.CORRECTION, 1, 10, 11]);

    expect(kernel.clientMovementSuppressed).toBe(true);
    expect(kernel.clientPendingMoveSeqAcks.length).toBe(0);

    const commands = kernel.drainClientCommands();
    expect(commands).toEqual([{ type: 'teleportEntity', entityId: 1, x: 10, y: 11 }]);

    // While suppressed, outbox does not emit clientSendMove.
    runClientPlayerMoveOutboxSystem({
        started: true,
        kernel,
        playerId: 1,
        player: { gridX: 10, gridY: 11 },
        isZoning: () => false,
        isZoningTile: () => false,
    });
    expect(kernel.drainClientCommands()).toEqual([]);
});

test('client sends sequenced non-movement intents for tile/claim operations when capabilities allow', () => {
    const kernel = new ClientWorldKernel();
    const client = new GameClient('ws://example.invalid', kernel);
    const sent: ClientToServerProtocolAction[] = [];
    client.sendMessage = (action) => {
        sent.push(action);
    };

    const capsJson = encodeProtocolCapabilitiesJson({ intentTypeIds: ['move.step', 'tile.edit', 'claim.create', 'claim.delete'] });
    client.receiveWelcome([Types.Messages.WELCOME, 1, 'name', 0, 0, 100, 1, capsJson]);

    const tileSeq = client.sendTileEdit(10, 11, 123);
    const claimSeq = client.sendClaimCreate({ x1: 10, y1: 10, x2: 12, y2: 12, editors: ['bob'] });
    const deleteSeq = client.sendClaimDelete(1);

    expect(tileSeq).toBe(1);
    expect(claimSeq).toBe(2);
    expect(deleteSeq).toBe(3);
    expect(sent).toEqual([
        [Types.Messages.INTENT, 1, 'tile.edit', encodeTileEditIntentPayload({ x: 10, y: 11, value: 123 }) ?? []],
        [Types.Messages.INTENT, 2, 'claim.create', encodeClaimCreateIntentPayload({ x1: 10, y1: 10, x2: 12, y2: 12, editors: ['bob'] }) ?? []],
        [Types.Messages.INTENT, 3, 'claim.delete', encodeClaimDeleteIntentPayload({ id: 1 }) ?? []],
    ]);
    expect(kernel.clientPendingMoveSeqAcks.length).toBe(0);
});
