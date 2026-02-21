import type { EntityKind } from '../../shared/entity-kind-domain';
import type { EntityId } from '../../shared/domain/ids';
import { entityIdFromWire } from '../../shared/domain/ids';
import { gridPos, type GridPos } from '../../shared/domain/positions';
import type { SpawnSnapshot } from '../../shared/replication/spawn-snapshot';
import Types from '../../shared/gametypes-browser';
import { MOVE_INPUT_KEY_A, MOVE_INPUT_KEY_D, MOVE_INPUT_KEY_S, MOVE_INPUT_KEY_W } from '../../shared/protocol/intents';
import { tileToWorldPosCenter, worldPos, worldPosToTile, type WorldPos } from '../../shared/world/worldpos';
import type { ClientCommand } from './client-commands';
import type { ClientRuntimeEvent } from './runtime-events';
import { ClientChunkOverlayCache } from '../world/chunks/client-chunk-overlay-cache';

export type KernelEntityType = 'player' | 'mob' | 'simple';

export type KernelEntityView = Readonly<{
    id: EntityId;
    kind: EntityKind;
    type: KernelEntityType;
    position: GridPos;
    worldPosition: WorldPos;
    name?: string;
    orientation?: number;
    armor?: EntityKind;
    weapon?: EntityKind;
    targetId?: EntityId;
}>;

export type ClientInteractionKind = 'attack' | 'talk' | 'open' | 'loot';

export type ClientInteractionIntent = Readonly<{
    kind: ClientInteractionKind;
    targetId: EntityId;
    lastKnownTargetPos?: GridPos;
}>;

export type ClientClickIntent = Readonly<{
    x: number;
    y: number;
}>;

export type ClientLootAttempt = Readonly<{
    itemId: EntityId;
    pos: GridPos;
}>;

export type ClientMovePlan = Readonly<{
    requestedTo: GridPos;
    target: GridPos;
    steps: GridPos[];
    stopAdjacentToTarget: boolean;
    sent: boolean;
}>;

export type ClientPendingDoorTraversal = Readonly<{
    doorX: number;
    doorY: number;
    toX: number;
    toY: number;
    orientation: number;
    portal: boolean;
    cameraX?: number;
    cameraY?: number;
    requestedAtMs: number;
}>;

export type ClientSpatialRecord = Readonly<{
    gridX: number;
    gridY: number;
    nextGridX: number;
    nextGridY: number;
    isMoving: boolean;
    kind: EntityKind;
    isPlayer: boolean;
}>;

function cellKey(x: number, y: number): string {
    return `${x},${y}`;
}

function addToCellIndex(index: Map<string, EntityId[]>, x: number, y: number, id: EntityId): void {
    const key = cellKey(x, y);
    const list = index.get(key);
    if (!list) {
        index.set(key, [id]);
        return;
    }
    if (list.includes(id)) {
        return;
    }
    list.push(id);
    list.sort((a, b) => a - b);
}

function removeFromCellIndex(index: Map<string, EntityId[]>, x: number, y: number, id: EntityId): void {
    const key = cellKey(x, y);
    const list = index.get(key);
    if (!list) {
        return;
    }
    const next = list.filter((existing) => existing !== id);
    if (next.length === 0) {
        index.delete(key);
        return;
    }
    if (next.length !== list.length) {
        index.set(key, next);
    }
}

export class ClientWorldKernel {
    readonly alive = new Set<EntityId>();
    readonly kind = new Map<EntityId, EntityKind>();
    readonly position = new Map<EntityId, GridPos>();
    readonly worldPosition = new Map<EntityId, WorldPos>();

    readonly name = new Map<EntityId, string>();
    readonly orientation = new Map<EntityId, number>();
    readonly armor = new Map<EntityId, EntityKind>();
    readonly weapon = new Map<EntityId, EntityKind>();
    readonly target = new Map<EntityId, EntityId>();

    worldPlayers = 0;
    totalPlayers = 0;

    clientInteractionIntent: ClientInteractionIntent | null = null;
    clientClickIntent: ClientClickIntent | null = null;
    clientLootAttempt: ClientLootAttempt | null = null;
    clientRuntimeEvents: ClientRuntimeEvent[] = [];
    clientCommands: ClientCommand[] = [];

    // Client-only replication bookkeeping for kernel-driven sync systems.
    readonly clientReplicationKnownAlive = new Set<EntityId>();
    readonly clientReplicationLastPos = new Map<EntityId, GridPos>();
    readonly clientReplicationLastWorldPos = new Map<EntityId, WorldPos>();
    readonly clientReplicationLastTarget = new Map<EntityId, EntityId>();

    // Client-only spatial bookkeeping for legacy grid sync without per-entity step hooks.
    readonly clientSpatialKnownIds = new Set<EntityId>();
    readonly clientSpatialRecords = new Map<
        EntityId,
        Readonly<{
            gridX: number;
            gridY: number;
            nextGridX: number;
            nextGridY: number;
            isMoving: boolean;
            isDead: boolean;
            kind: EntityKind;
            isPlayer: boolean;
        }>
    >();

    // Kernel-owned spatial indices derived from `clientSpatialRecords` (replaces legacy Game grids).
    readonly clientSpatialEntityIndex = new Map<string, EntityId[]>();
    readonly clientSpatialItemIndex = new Map<string, EntityId[]>();
    readonly clientSpatialRenderIndex = new Map<string, EntityId[]>();

    clientPathingGrid: number[][] | null = null;

    clientMovePlan: ClientMovePlan | null = null;
    clientLastSentMovePos: GridPos | null = null;
    readonly clientPendingMoveAcks: GridPos[] = [];
    readonly clientPendingMoveSeqAcks: number[] = [];
    clientMovementSuppressed = false;
    clientMoveInputKeysMask = 0;
    readonly clientMoveInputRecentKeys: number[] = [];
    clientMoveInputDirty = false;
    clientPredictedWorldPos: WorldPos | null = null;
    clientDoorTraversalArmed = false;
    clientPendingDoorTraversal: ClientPendingDoorTraversal | null = null;
    clientLocalPlayerDead = false;
    readonly clientChunkOverlayCache = new ClientChunkOverlayCache();

    ensureClientPathingGrid(mapGrid: number[][]): void {
        const height = mapGrid.length;
        const width = mapGrid[0]?.length ?? 0;
        if (height === 0 || width === 0) {
            return;
        }

        const existing = this.clientPathingGrid;
        if (existing?.length === height && (existing[0]?.length ?? 0) === width) {
            return;
        }

        const next: number[][] = [];
        for (let y = 0; y < height; y += 1) {
            const nextRow: number[] = [];
            const sourceRow = mapGrid[y];
            for (let x = 0; x < width; x += 1) {
                nextRow[x] = sourceRow?.[x] ?? 0;
            }
            next[y] = nextRow;
        }
        this.clientPathingGrid = next;
    }

    resetClientSpatialState(mapGrid?: number[][]): void {
        this.clientSpatialKnownIds.clear();
        this.clientSpatialRecords.clear();
        this.clientSpatialEntityIndex.clear();
        this.clientSpatialItemIndex.clear();
        this.clientSpatialRenderIndex.clear();
        this.clientPathingGrid = null;
        if (mapGrid) {
            this.ensureClientPathingGrid(mapGrid);
        }
    }

    enqueueClientPendingMoveAck(x: number, y: number): void {
        this.clientPendingMoveAcks.push(gridPos(x, y));
    }

    consumeClientPendingMoveAck(x: number, y: number): boolean {
        if (this.clientPendingMoveAcks.length === 0) {
            return false;
        }

        const matchedIndex = this.clientPendingMoveAcks.findIndex((entry) => entry.x === x && entry.y === y);
        if (matchedIndex < 0) {
            return false;
        }

        this.clientPendingMoveAcks.splice(0, matchedIndex + 1);
        return true;
    }

    clearClientPendingMoveAcks(): void {
        this.clientPendingMoveAcks.length = 0;
    }

    pressClientMoveInputKey(bit: number): void {
        const mask = this.clientMoveInputKeysMask >>> 0;
        if ((mask & bit) !== 0) {
            return;
        }
        this.clientMoveInputKeysMask = (mask | (bit >>> 0)) >>> 0;
        const idx = this.clientMoveInputRecentKeys.indexOf(bit);
        if (idx >= 0) {
            this.clientMoveInputRecentKeys.splice(idx, 1);
        }
        this.clientMoveInputRecentKeys.push(bit);
        if (this.clientMoveInputRecentKeys.length > 4) {
            this.clientMoveInputRecentKeys.splice(0, this.clientMoveInputRecentKeys.length - 4);
        }
        this.clientMoveInputDirty = true;
    }

    releaseClientMoveInputKey(bit: number): void {
        const mask = this.clientMoveInputKeysMask >>> 0;
        if ((mask & bit) === 0) {
            return;
        }
        this.clientMoveInputKeysMask = (mask & ~(bit >>> 0)) >>> 0;
        this.clientMoveInputDirty = true;
    }

    clearClientMoveInput(): void {
        if (this.clientMoveInputKeysMask === 0 && this.clientMoveInputRecentKeys.length === 0 && !this.clientMoveInputDirty) {
            return;
        }
        this.clientMoveInputKeysMask = 0;
        this.clientMoveInputRecentKeys.length = 0;
        this.clientMoveInputDirty = true;
    }

    consumeClientMoveInputDirty(): number | null {
        if (!this.clientMoveInputDirty) {
            return null;
        }
        this.clientMoveInputDirty = false;
        return this.clientMoveInputKeysMask >>> 0;
    }

    resolveClientMoveInputActiveKey(): number | null {
        const mask = this.clientMoveInputKeysMask >>> 0;
        const recent = this.clientMoveInputRecentKeys;
        for (let i = recent.length - 1; i >= 0; i -= 1) {
            const bit = recent[i] ?? 0;
            if ((mask & bit) !== 0) {
                return bit;
            }
        }
        if (mask & MOVE_INPUT_KEY_W) return MOVE_INPUT_KEY_W;
        if (mask & MOVE_INPUT_KEY_A) return MOVE_INPUT_KEY_A;
        if (mask & MOVE_INPUT_KEY_S) return MOVE_INPUT_KEY_S;
        if (mask & MOVE_INPUT_KEY_D) return MOVE_INPUT_KEY_D;
        return null;
    }

    resolveClientMoveInputAxis(): { dx: -1 | 0 | 1; dy: -1 | 0 | 1 } {
        const mask = this.clientMoveInputKeysMask >>> 0;
        const recent = this.clientMoveInputRecentKeys;

        const axis = (negBit: number, posBit: number): -1 | 0 | 1 => {
            const neg = (mask & (negBit >>> 0)) !== 0;
            const pos = (mask & (posBit >>> 0)) !== 0;
            if (neg && !pos) return -1;
            if (pos && !neg) return 1;
            if (!neg && !pos) return 0;
            // Both pressed: choose the more recent bit.
            const negIdx = recent.lastIndexOf(negBit);
            const posIdx = recent.lastIndexOf(posBit);
            if (negIdx === -1 && posIdx === -1) return 0;
            if (negIdx > posIdx) return -1;
            if (posIdx > negIdx) return 1;
            return 0;
        };

        const dx = axis(MOVE_INPUT_KEY_A, MOVE_INPUT_KEY_D);
        const dy = axis(MOVE_INPUT_KEY_W, MOVE_INPUT_KEY_S);
        return { dx, dy };
    }

    enqueueClientPendingMoveSeqAck(seq: number): void {
        this.clientPendingMoveSeqAcks.push(seq);
    }

    consumeClientPendingMoveSeqAck(seq: number): boolean {
        if (this.clientPendingMoveSeqAcks.length === 0) {
            return false;
        }
        const matchedIndex = this.clientPendingMoveSeqAcks.indexOf(seq);
        if (matchedIndex < 0) {
            return false;
        }
        this.clientPendingMoveSeqAcks.splice(0, matchedIndex + 1);
        return true;
    }

    pruneClientPendingMoveSeqAcksUpTo(seq: number): boolean {
        const pending = this.clientPendingMoveSeqAcks;
        if (pending.length === 0) {
            return false;
        }
        let lastIndex = -1;
        for (let i = 0; i < pending.length; i += 1) {
            const entry = pending[i];
            if (typeof entry === 'number' && entry <= seq) {
                lastIndex = i;
            }
        }
        if (lastIndex < 0) {
            return false;
        }
        pending.splice(0, lastIndex + 1);
        return true;
    }

    clearClientPendingMoveSeqAcks(): void {
        this.clientPendingMoveSeqAcks.length = 0;
    }

    setClientPendingDoorTraversal(pending: Omit<ClientPendingDoorTraversal, 'requestedAtMs'>): void {
        this.clientPendingDoorTraversal = { ...pending, requestedAtMs: Date.now() };
    }

    clearClientPendingDoorTraversal(): void {
        this.clientPendingDoorTraversal = null;
    }

    applySpatialRemoveRecord(entityId: EntityId, record: ClientSpatialRecord): void {
        removeFromCellIndex(this.clientSpatialRenderIndex, record.gridX, record.gridY, entityId);

        if (!Types.isItem(record.kind)) {
            if (record.isMoving && record.nextGridX >= 0 && record.nextGridY >= 0) {
                removeFromCellIndex(this.clientSpatialEntityIndex, record.nextGridX, record.nextGridY, entityId);
            }
            removeFromCellIndex(this.clientSpatialEntityIndex, record.gridX, record.gridY, entityId);
        }
        if (Types.isItem(record.kind)) {
            removeFromCellIndex(this.clientSpatialItemIndex, record.gridX, record.gridY, entityId);
        }
    }

    applySpatialAddRecord(entityId: EntityId, record: ClientSpatialRecord): void {
        addToCellIndex(this.clientSpatialRenderIndex, record.gridX, record.gridY, entityId);

        // Hit-test entities in both current and next cells while they are moving.
        if (!Types.isItem(record.kind)) {
            addToCellIndex(this.clientSpatialEntityIndex, record.gridX, record.gridY, entityId);
            if (record.isMoving && record.nextGridX >= 0 && record.nextGridY >= 0) {
                addToCellIndex(this.clientSpatialEntityIndex, record.nextGridX, record.nextGridY, entityId);
            }
        }

        if (Types.isItem(record.kind)) {
            addToCellIndex(this.clientSpatialItemIndex, record.gridX, record.gridY, entityId);
        }
    }

    getClientEntityIdsAt(x: number, y: number): EntityId[] {
        return this.clientSpatialEntityIndex.get(cellKey(x, y)) ?? [];
    }

    getClientItemIdsAt(x: number, y: number): EntityId[] {
        return this.clientSpatialItemIndex.get(cellKey(x, y)) ?? [];
    }

    getClientRenderIdsAt(x: number, y: number): EntityId[] {
        return this.clientSpatialRenderIndex.get(cellKey(x, y)) ?? [];
    }

    upsertFromSpawnSnapshot(snapshot: SpawnSnapshot): KernelEntityView {
        const id = entityIdFromWire(snapshot.id);
        this.alive.add(id);
        this.kind.set(id, snapshot.kind);
        const pos = gridPos(snapshot.x, snapshot.y);
        this.position.set(id, pos);
        this.worldPosition.set(id, tileToWorldPosCenter(snapshot.x, snapshot.y));

        // Clear optional components first; extras will re-add what applies.
        this.name.delete(id);
        this.orientation.delete(id);
        this.armor.delete(id);
        this.weapon.delete(id);
        this.target.delete(id);

        if (snapshot.extras.type === 'player') {
            this.name.set(id, snapshot.extras.name);
            this.orientation.set(id, snapshot.extras.orientation);
            this.armor.set(id, snapshot.extras.armor);
            this.weapon.set(id, snapshot.extras.weapon);
            if (typeof snapshot.extras.targetId === 'number') {
                this.target.set(id, entityIdFromWire(snapshot.extras.targetId));
            }
        } else if (snapshot.extras.type === 'mob') {
            this.orientation.set(id, snapshot.extras.orientation);
            if (typeof snapshot.extras.targetId === 'number') {
                this.target.set(id, entityIdFromWire(snapshot.extras.targetId));
            }
        }

        return this.getEntityView(id);
    }

    upsertSimpleEntity(id: EntityId, kind: EntityKind, x: number, y: number): KernelEntityView {
        this.alive.add(id);
        this.kind.set(id, kind);
        this.position.set(id, gridPos(x, y));
        this.worldPosition.set(id, tileToWorldPosCenter(x, y));

        // Clear optional components: this is a "simple" entity unless later promoted by spawn snapshots.
        this.name.delete(id);
        this.orientation.delete(id);
        this.armor.delete(id);
        this.weapon.delete(id);
        this.target.delete(id);

        return this.getEntityView(id);
    }

    setPosition(id: EntityId, x: number, y: number): void {
        if (!this.alive.has(id)) {
            return;
        }
        this.position.set(id, gridPos(x, y));
        this.worldPosition.set(id, tileToWorldPosCenter(x, y));
    }

    setWorldPosition(id: EntityId, worldX: number, worldY: number): void {
        if (!this.alive.has(id)) {
            return;
        }
        const pos = worldPos(worldX, worldY);
        this.worldPosition.set(id, pos);
        this.position.set(id, worldPosToTile(pos));
    }

    setTarget(id: EntityId, targetId: EntityId | null): void {
        if (!this.alive.has(id)) {
            return;
        }
        if (targetId === null) {
            this.target.delete(id);
        } else {
            this.target.set(id, targetId);
        }
    }

    removeEntity(id: EntityId): void {
        this.alive.delete(id);
        this.kind.delete(id);
        this.position.delete(id);
        this.worldPosition.delete(id);
        this.name.delete(id);
        this.orientation.delete(id);
        this.armor.delete(id);
        this.weapon.delete(id);
        this.target.delete(id);

        // Clear inbound/outbound targeting edges that reference this entity.
        for (const [attackerId, targetId] of this.target.entries()) {
            if (targetId === id) {
                this.target.delete(attackerId);
            }
        }

        if (this.clientInteractionIntent?.targetId === id) {
            this.clientInteractionIntent = null;
        }

    }

    resetWorldState(): void {
        this.alive.clear();
        this.kind.clear();
        this.position.clear();
        this.worldPosition.clear();
        this.name.clear();
        this.orientation.clear();
        this.armor.clear();
        this.weapon.clear();
        this.target.clear();

        this.worldPlayers = 0;
        this.totalPlayers = 0;

        this.clientInteractionIntent = null;
        this.clientClickIntent = null;
        this.clientLootAttempt = null;
        this.clientRuntimeEvents = [];
        this.clientCommands = [];

        this.clientReplicationKnownAlive.clear();
        this.clientReplicationLastPos.clear();
        this.clientReplicationLastWorldPos.clear();
        this.clientReplicationLastTarget.clear();

        this.resetClientSpatialState();
        this.clientChunkOverlayCache.clear();

        this.clientMovePlan = null;
        this.clientLastSentMovePos = null;
        this.clearClientPendingMoveAcks();
        this.clearClientPendingMoveSeqAcks();
        this.clientMoveInputKeysMask = 0;
        this.clientMoveInputRecentKeys.length = 0;
        this.clientMoveInputDirty = false;
        this.clientDoorTraversalArmed = false;
        this.clientPendingDoorTraversal = null;
        this.clientLocalPlayerDead = false;
    }

    setPopulation(worldPlayers: number, totalPlayers: number): void {
        this.worldPlayers = worldPlayers;
        this.totalPlayers = totalPlayers;
    }

    enqueueClientRuntimeEvent(event: ClientRuntimeEvent): void {
        this.clientRuntimeEvents.push(event);
    }

    drainClientRuntimeEvents(): ClientRuntimeEvent[] {
        if (this.clientRuntimeEvents.length === 0) {
            return [];
        }
        return this.clientRuntimeEvents.splice(0, this.clientRuntimeEvents.length);
    }

    enqueueClientCommand(command: ClientCommand): void {
        this.clientCommands.push(command);
    }

    drainClientCommands(): ClientCommand[] {
        if (this.clientCommands.length === 0) {
            return [];
        }
        return this.clientCommands.splice(0, this.clientCommands.length);
    }

    setClientInteractionIntent(intent: ClientInteractionIntent | null): void {
        this.clientInteractionIntent = intent;
    }

    clearClientInteractionIntent(): void {
        this.clientInteractionIntent = null;
    }

    setClientClickIntent(intent: ClientClickIntent | null): void {
        this.clientClickIntent = intent;
    }

    clearClientClickIntent(): void {
        this.clientClickIntent = null;
    }

    setClientLootAttempt(itemId: EntityId, x: number, y: number): void {
        this.clientLootAttempt = { itemId, pos: gridPos(x, y) };
    }

    clearClientLootAttempt(): void {
        this.clientLootAttempt = null;
    }

    setClientMovePlan(plan: Omit<ClientMovePlan, 'sent'>): void {
        this.clientMovePlan = {
            requestedTo: plan.requestedTo,
            target: plan.target,
            steps: plan.steps,
            stopAdjacentToTarget: plan.stopAdjacentToTarget,
            sent: false,
        };
    }

    clearClientMovePlan(): void {
        this.clientMovePlan = null;
    }

    getEntityView(id: EntityId): KernelEntityView {
        const kind = this.kind.get(id);
        const position = this.position.get(id);
        const worldPosition = this.worldPosition.get(id);
        if (kind === undefined || !position || !worldPosition) {
            throw new Error(`Kernel missing entity ${String(id)}`);
        }

        const weapon = this.weapon.get(id);
        const armor = this.armor.get(id);
        const targetId = this.target.get(id);
        const orientation = this.orientation.get(id);
        const name = this.name.get(id);

        let type: KernelEntityType = 'simple';
        if (name !== undefined) {
            type = 'player';
        } else if (orientation !== undefined) {
            type = 'mob';
        }

        return {
            id,
            kind,
            type,
            position,
            worldPosition,
            name,
            orientation,
            armor,
            weapon,
            targetId,
        };
    }
}
