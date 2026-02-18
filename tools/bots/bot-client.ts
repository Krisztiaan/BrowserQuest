import Types from '../../shared/gametypes-browser';
import { decodeServerToClientProtocolActionBatchBinary } from '../../shared/protocol/registry';
import { decodeProtocolCapabilitiesJson, type ProtocolCapabilities } from '../../shared/protocol/capabilities';
import { decodeChunkSnapshotPayloadJson } from '../../shared/protocol/chunks/chunk-snapshot-codec';
import { decodeChunkDeltaPayloadJson } from '../../shared/protocol/chunks/chunk-delta-codec';
import { gridPos } from '../../shared/domain/positions';
import { encodeClientToServerBinaryActionBatchPayload } from '../../shared/protocol/binary-action-codec';
import {
    createHelloAction,
    createIntentAction,
} from '../../client/gameclient-outbound-actions';
import { encodeMoveStepIntentPayload, encodeTileEditIntentPayload } from '../../shared/protocol/intents';
import { ClientChunkOverlayCache } from '../../client/world/chunks/client-chunk-overlay-cache';

export type BotMetrics = {
    connectErrors: number;
    opens: number;
    closes: number;
    closeCode: number | null;
    closeReason: string | null;
    welcomeX: number | null;
    welcomeY: number | null;
    messagesIn: number;
    actionsIn: number;
    bytesIn: number;
    bytesOut: number;
    acks: number;
    rejects: number;
    corrections: number;
    ackRttMs: number[];
    chunkSnapshots: number;
    chunkSnapshotPayloadBytes: number[];
    chunkSnapshotOverrideCounts: number[];
    chunkDeltas: number;
    chunkDeltaPayloadBytes: number[];
    chunkDeltaChangeCounts: number[];
    chunkDeltaApplyFailures: number;
    tileEditsSent: number;
    tileEditsAcked: number;
    tileEditsRejected: number;
    observedPeerTileEdits: number;
};

export type BotRunResult = Readonly<{
    metrics: BotMetrics;
    welcomeReceived: boolean;
}>;

function nowMs(): number {
    return Date.now();
}

function byteLengthUtf8(value: string): number {
    return new TextEncoder().encode(value).byteLength;
}

function decodeSocketMessageData(raw: unknown): string | Uint8Array | ArrayBuffer | null {
    if (typeof raw === 'string') {
        return raw;
    }
    if (raw instanceof Uint8Array) {
        return raw;
    }
    if (raw instanceof ArrayBuffer) {
        return raw;
    }
    return null;
}

function recordSample(target: number[], value: number, cap = 5000): void {
    if (!Number.isFinite(value)) return;
    if (target.length >= cap) return;
    target.push(Math.max(0, Math.floor(value)));
}

export class BotClient {
    readonly name: string;
    readonly url: string;
    readonly moveHz: number;
    readonly enableChunks: boolean;
    readonly chunkRadius: number;
    readonly enableTileEdits: boolean;
    readonly tileEditHz: number;
    readonly role: 'leader' | 'observer';

    readonly metrics: BotMetrics = {
        connectErrors: 0,
        opens: 0,
        closes: 0,
        closeCode: null,
        closeReason: null,
        welcomeX: null,
        welcomeY: null,
        messagesIn: 0,
        actionsIn: 0,
        bytesIn: 0,
        bytesOut: 0,
        acks: 0,
        rejects: 0,
        corrections: 0,
        ackRttMs: [],
        chunkSnapshots: 0,
        chunkSnapshotPayloadBytes: [],
        chunkSnapshotOverrideCounts: [],
        chunkDeltas: 0,
        chunkDeltaPayloadBytes: [],
        chunkDeltaChangeCounts: [],
        chunkDeltaApplyFailures: 0,
        tileEditsSent: 0,
        tileEditsAcked: 0,
        tileEditsRejected: 0,
        observedPeerTileEdits: 0,
    };

    #ws: WebSocket | null = null;
    #isGo = false;
    #playerId: number | null = null;
    #serverProtocolRevision: number | null = null;
    #serverCapabilities: ProtocolCapabilities | null = null;
    #intentSeq = 1;
    #pendingAcks = new Map<number, { sentAtMs: number; kind: 'move' | 'tile' }>();
    #position: { x: number; y: number } | null = null;
    #moveInterval: ReturnType<typeof setInterval> | null = null;
    #tileEditInterval: ReturnType<typeof setInterval> | null = null;
    #welcomeReceived = false;
    #chunkCache = new ClientChunkOverlayCache();
    #seenInitialChunkSnapshot = false;
    #tileEditValue = 1;
    #watchedTile: { x: number; y: number } | null = null;

    constructor({
        name,
        url,
        moveHz,
        enableChunks,
        chunkRadius,
        enableTileEdits,
        tileEditHz,
        role,
    }: {
        name: string;
        url: string;
        moveHz: number;
        enableChunks: boolean;
        chunkRadius: number;
        enableTileEdits: boolean;
        tileEditHz: number;
        role: 'leader' | 'observer';
    }) {
        this.name = name;
        this.url = url;
        this.moveHz = Math.max(0, Math.floor(moveHz));
        this.enableChunks = enableChunks;
        this.chunkRadius = Math.max(0, Math.floor(chunkRadius));
        this.enableTileEdits = enableTileEdits;
        this.tileEditHz = Math.max(0, Math.floor(tileEditHz));
        this.role = role;
    }

    async runFor(seconds: number): Promise<BotRunResult> {
        const durationMs = Math.max(1, Math.floor(seconds)) * 1000;
        await this.#connectAndRun(durationMs);
        return Object.freeze({ metrics: this.metrics, welcomeReceived: this.#welcomeReceived });
    }

    async #connectAndRun(durationMs: number): Promise<void> {
        await new Promise<void>((resolve) => {
            const ws = new WebSocket(this.url);
            this.#ws = ws;

            const finish = () => {
                this.#stopMovementLoop();
                this.#stopTileEditLoop();
                try {
                    ws.close();
                } catch (_) {
                    // ignore
                }
                resolve();
            };

            const stopAt = setTimeout(() => finish(), durationMs);

            ws.addEventListener('open', () => {
                this.metrics.opens += 1;
            });
            ws.addEventListener('error', () => {
                this.metrics.connectErrors += 1;
            });
            ws.addEventListener('close', (evt: CloseEvent) => {
                this.metrics.closes += 1;
                if (typeof evt.code === 'number') {
                    this.metrics.closeCode = evt.code;
                }
                if (typeof evt.reason === 'string') {
                    this.metrics.closeReason = evt.reason;
                }
                clearTimeout(stopAt);
                resolve();
            });
            ws.addEventListener('message', (evt: MessageEvent<unknown>) => {
                const data = decodeSocketMessageData(evt.data);
                if (data === 'go') {
                    this.#isGo = true;
                    this.#sendHello();
                    return;
                }
                if (typeof data !== 'string') {
                    this.metrics.messagesIn += 1;
                    if (data instanceof Uint8Array) {
                        this.metrics.bytesIn += data.byteLength;
                        this.#handleServerMessage(data);
                        return;
                    }
                    if (data instanceof ArrayBuffer) {
                        this.metrics.bytesIn += data.byteLength;
                        this.#handleServerMessage(data);
                    }
                    return;
                }
            });
        });
    }

    #sendRaw(action: unknown): void {
        const ws = this.#ws;
        if (ws?.readyState !== WebSocket.OPEN) {
            return;
        }
        if (!Array.isArray(action)) {
            return;
        }
        const payload = encodeClientToServerBinaryActionBatchPayload([action]);
        this.metrics.bytesOut += payload.byteLength;
        ws.send(payload);
    }

    #sendHello(): void {
        if (!this.#isGo) {
            return;
        }
        // Use the modern HELLO with protocol revision + capabilities so the server returns capabilities back.
        const armorKind = Types.Entities.CLOTHARMOR;
        const weaponKind = Types.Entities.SWORD1;
        if (typeof armorKind !== 'number' || typeof weaponKind !== 'number') {
            throw new Error('BotClient: failed to resolve default armor/weapon kinds');
        }
        this.#sendRaw(createHelloAction(this.name, armorKind, weaponKind));
    }

    #startMovementLoop(): void {
        if (this.moveHz <= 0 || this.#moveInterval) {
            return;
        }
        const intervalMs = Math.max(50, Math.floor(1000 / this.moveHz));
        this.#moveInterval = setInterval(() => this.#sendMoveTick(), intervalMs);
    }

    #stopMovementLoop(): void {
        if (this.#moveInterval) {
            clearInterval(this.#moveInterval);
            this.#moveInterval = null;
        }
    }

    #startTileEditLoop(): void {
        if (!this.enableTileEdits || this.tileEditHz <= 0 || this.#tileEditInterval) {
            return;
        }
        if (this.role !== 'leader') {
            return;
        }
        const intervalMs = Math.max(100, Math.floor(1000 / this.tileEditHz));
        this.#tileEditInterval = setInterval(() => this.#sendTileEditTick(), intervalMs);
    }

    #stopTileEditLoop(): void {
        if (this.#tileEditInterval) {
            clearInterval(this.#tileEditInterval);
            this.#tileEditInterval = null;
        }
    }

    #sendMoveTick(): void {
        const pos = this.#position;
        if (!pos) {
            return;
        }
        const dx = Math.random() < 0.5 ? -1 : 1;
        const dy = Math.random() < 0.5 ? -1 : 1;
        const next = { x: pos.x + dx, y: pos.y + dy };

        const supportsMoveIntent =
            this.#serverProtocolRevision !== null && (this.#serverCapabilities?.intentTypeIds?.includes('move.step') ?? false);
        if (!supportsMoveIntent) {
            return;
        }

        const seq = this.#intentSeq++;
        this.#pendingAcks.set(seq, { sentAtMs: nowMs(), kind: 'move' });
        const payloadBytes = encodeMoveStepIntentPayload(gridPos(next.x, next.y));
        if (!payloadBytes) {
            return;
        }
        this.#sendRaw(createIntentAction(seq, 'move.step', payloadBytes));
    }

    #sendChunkSubscribe(): void {
        if (!this.enableChunks) {
            return;
        }
        const radius = Math.max(0, Math.min(8, this.chunkRadius));
        this.#sendRaw([Types.Messages.CHUNK_SUBSCRIBE, 0, 0, radius]);
    }

    #sendTileEditTick(): void {
        if (!this.enableTileEdits || this.role !== 'leader') {
            return;
        }
        if (this.enableChunks && !this.#seenInitialChunkSnapshot) {
            return;
        }
        const pos = this.#position;
        if (!pos) {
            return;
        }

        const x = pos.x;
        const y = pos.y;
        const value = this.#tileEditValue++;
        const seq = this.#intentSeq++;
        this.#pendingAcks.set(seq, { sentAtMs: nowMs(), kind: 'tile' });
        this.metrics.tileEditsSent += 1;
        const payloadBytes = encodeTileEditIntentPayload({ x, y, value });
        if (!payloadBytes) {
            return;
        }
        this.#sendRaw(createIntentAction(seq, 'tile.edit', payloadBytes));
    }

    #handleServerMessage(message: ArrayBuffer | Uint8Array): void {
        const actions = decodeServerToClientProtocolActionBatchBinary(message);
        this.metrics.actionsIn += actions.length;

        for (let i = 0; i < actions.length; i += 1) {
            const action = actions[i];
            if (!action) continue;

            const opcode = action[0];
            if (opcode === Types.Messages.WELCOME) {
                const id = action[1];
                const x = action[3];
                const y = action[4];
                if (typeof id === 'number') {
                    this.#playerId = id;
                }
                if (typeof x === 'number' && typeof y === 'number') {
                    this.#position = { x, y };
                    this.metrics.welcomeX = x;
                    this.metrics.welcomeY = y;
                    this.#watchedTile = { x, y };
                }
                const maybeRevision = action[6];
                const maybeCapsJson = action[7];
                if (typeof maybeRevision === 'number') {
                    this.#serverProtocolRevision = maybeRevision;
                }
                if (typeof maybeCapsJson === 'string') {
                    this.#serverCapabilities = decodeProtocolCapabilitiesJson(maybeCapsJson);
                }
                this.#welcomeReceived = true;
                this.#sendChunkSubscribe();
                this.#startMovementLoop();
                if (this.enableTileEdits && !this.enableChunks) {
                    setTimeout(() => this.#startTileEditLoop(), 200);
                }
                continue;
            }

            if (opcode === Types.Messages.MOVE) {
                const id = action[1];
                const x = action[2];
                const y = action[3];
                if (typeof id === 'number' && typeof x === 'number' && typeof y === 'number' && id === this.#playerId) {
                    this.#position = { x, y };
                }
                continue;
            }

            if (opcode === Types.Messages.TELEPORT) {
                const id = action[1];
                const x = action[2];
                const y = action[3];
                if (typeof id === 'number' && typeof x === 'number' && typeof y === 'number' && id === this.#playerId) {
                    this.#position = { x, y };
                }
                continue;
            }

            if (opcode === Types.Messages.ACK) {
                const seq = action[1];
                if (typeof seq === 'number') {
                    this.metrics.acks += 1;
                    const pending = this.#pendingAcks.get(seq);
                    if (pending) {
                        this.metrics.ackRttMs.push(nowMs() - pending.sentAtMs);
                        if (pending.kind === 'tile') {
                            this.metrics.tileEditsAcked += 1;
                        }
                        this.#pendingAcks.delete(seq);
                    }
                }
                continue;
            }

            if (opcode === Types.Messages.REJECT) {
                this.metrics.rejects += 1;
                const intentTypeId = action[2];
                if (intentTypeId === 'tile.edit') {
                    this.metrics.tileEditsRejected += 1;
                }
                continue;
            }

            if (opcode === Types.Messages.CORRECTION) {
                this.metrics.corrections += 1;
                continue;
            }

            if (opcode === Types.Messages.CHUNK_SNAPSHOT) {
                if (!this.enableChunks) {
                    continue;
                }
                const chunkX = action[1];
                const chunkY = action[2];
                const version = action[3];
                const payloadJson = action[4];
                if (
                    typeof chunkX !== 'number'
                    || typeof chunkY !== 'number'
                    || typeof version !== 'number'
                    || typeof payloadJson !== 'string'
                ) {
                    continue;
                }
                const decoded = decodeChunkSnapshotPayloadJson(payloadJson);
                if (!decoded) {
                    continue;
                }
                recordSample(this.metrics.chunkSnapshotPayloadBytes, byteLengthUtf8(payloadJson));
                recordSample(this.metrics.chunkSnapshotOverrideCounts, decoded.overrides.length);
                this.#chunkCache.applySnapshot({
                    chunkX,
                    chunkY,
                    version,
                    chunkSize: decoded.chunkSize,
                    overrides: decoded.overrides,
                });
                this.metrics.chunkSnapshots += 1;
                if (!this.#seenInitialChunkSnapshot) {
                    this.#seenInitialChunkSnapshot = true;
                    setTimeout(() => this.#startTileEditLoop(), 300);
                }
                continue;
            }

            if (opcode === Types.Messages.CHUNK_SNAPSHOT_PART) {
                if (!this.enableChunks) {
                    continue;
                }
                const chunkX = action[1];
                const chunkY = action[2];
                const version = action[3];
                const partIndex = action[4];
                const partCount = action[5];
                const payloadJson = action[6];
                if (
                    typeof chunkX !== 'number'
                    || typeof chunkY !== 'number'
                    || typeof version !== 'number'
                    || typeof partIndex !== 'number'
                    || typeof partCount !== 'number'
                    || typeof payloadJson !== 'string'
                ) {
                    continue;
                }
                const decoded = decodeChunkSnapshotPayloadJson(payloadJson);
                if (!decoded) {
                    continue;
                }
                recordSample(this.metrics.chunkSnapshotPayloadBytes, byteLengthUtf8(payloadJson));
                recordSample(this.metrics.chunkSnapshotOverrideCounts, decoded.overrides.length);
                const result = this.#chunkCache.applySnapshotPart({
                    chunkX,
                    chunkY,
                    version,
                    partIndex,
                    partCount,
                    chunkSize: decoded.chunkSize,
                    overrides: decoded.overrides,
                });
                if (result.applied) {
                    this.metrics.chunkSnapshots += 1;
                    if (!this.#seenInitialChunkSnapshot) {
                        this.#seenInitialChunkSnapshot = true;
                        setTimeout(() => this.#startTileEditLoop(), 300);
                    }
                }
                continue;
            }

            if (opcode === Types.Messages.CHUNK_DELTA) {
                if (!this.enableChunks) {
                    continue;
                }
                const chunkX = action[1];
                const chunkY = action[2];
                const fromVersion = action[3];
                const toVersion = action[4];
                const payloadJson = action[5];
                if (
                    typeof chunkX !== 'number'
                    || typeof chunkY !== 'number'
                    || typeof fromVersion !== 'number'
                    || typeof toVersion !== 'number'
                    || typeof payloadJson !== 'string'
                ) {
                    continue;
                }
                const decoded = decodeChunkDeltaPayloadJson(payloadJson);
                if (!decoded) {
                    continue;
                }
                recordSample(this.metrics.chunkDeltaPayloadBytes, byteLengthUtf8(payloadJson));
                recordSample(this.metrics.chunkDeltaChangeCounts, decoded.changes.length);
                const applied = this.#chunkCache.applyDelta({
                    chunkX,
                    chunkY,
                    fromVersion,
                    toVersion,
                    changes: decoded.changes,
                });
                this.metrics.chunkDeltas += 1;
                if (!applied) {
                    this.metrics.chunkDeltaApplyFailures += 1;
                    continue;
                }

                const watched = this.#watchedTile;
                if (watched && this.role === 'observer') {
                    for (let j = 0; j < decoded.changes.length; j += 1) {
                        const change = decoded.changes[j];
                        if (!change) continue;
                        const [localX, localY] = change;
                        const globalX = chunkX * decoded.chunkSize + localX;
                        const globalY = chunkY * decoded.chunkSize + localY;
                        if (globalX === watched.x && globalY === watched.y) {
                            this.metrics.observedPeerTileEdits += 1;
                            break;
                        }
                    }
                }
                continue;
            }
        }
    }
}
