import type { EntityKind } from '../../shared/entity-kind-domain';
import type { EntityId } from '../../shared/domain/ids';
import { entityIdFromWire } from '../../shared/domain/ids';
import { gridPos, type GridPos } from '../../shared/domain/positions';
import type { SpawnSnapshot } from '../../shared/replication/spawn-snapshot';
import type { ClientRuntimeEvent } from './runtime-events';

export type KernelEntityType = 'player' | 'mob' | 'simple';

export type KernelEntityView = Readonly<{
    id: EntityId;
    kind: EntityKind;
    type: KernelEntityType;
    position: GridPos;
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

export type ClientClickState = Readonly<{
    lastClickPos: GridPos;
}>;

export type ClientLootAttempt = Readonly<{
    itemId: EntityId;
    pos: GridPos;
}>;

export class ClientWorldKernel {
    readonly alive = new Set<EntityId>();
    readonly kind = new Map<EntityId, EntityKind>();
    readonly position = new Map<EntityId, GridPos>();

    readonly name = new Map<EntityId, string>();
    readonly orientation = new Map<EntityId, number>();
    readonly armor = new Map<EntityId, EntityKind>();
    readonly weapon = new Map<EntityId, EntityKind>();
    readonly target = new Map<EntityId, EntityId>();

    worldPlayers = 0;
    totalPlayers = 0;

    clientInteractionIntent: ClientInteractionIntent | null = null;
    clientClickIntent: ClientClickIntent | null = null;
    clientClickState: ClientClickState | null = null;
    clientLootAttempt: ClientLootAttempt | null = null;
    clientRuntimeEvents: ClientRuntimeEvent[] = [];

    // Client-only replication bookkeeping for kernel-driven sync systems.
    readonly clientReplicationKnownAlive = new Set<EntityId>();
    readonly clientReplicationLastPos = new Map<EntityId, GridPos>();
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
            kind: EntityKind;
        }>
    >();

    clientLastSentMovePos: GridPos | null = null;

    upsertFromSpawnSnapshot(snapshot: SpawnSnapshot): KernelEntityView {
        const id = entityIdFromWire(snapshot.id);
        this.alive.add(id);
        this.kind.set(id, snapshot.kind);
        const pos = gridPos(snapshot.x, snapshot.y);
        this.position.set(id, pos);

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
        this.name.delete(id);
        this.orientation.delete(id);
        this.armor.delete(id);
        this.weapon.delete(id);
        this.target.delete(id);

        this.clientReplicationKnownAlive.delete(id);
        this.clientReplicationLastPos.delete(id);
        this.clientReplicationLastTarget.delete(id);
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

    setClientLastClickPos(x: number, y: number): void {
        this.clientClickState = { lastClickPos: gridPos(x, y) };
    }

    clearClientLastClickPos(): void {
        this.clientClickState = null;
    }

    setClientLootAttempt(itemId: EntityId, x: number, y: number): void {
        this.clientLootAttempt = { itemId, pos: gridPos(x, y) };
    }

    clearClientLootAttempt(): void {
        this.clientLootAttempt = null;
    }

    getEntityView(id: EntityId): KernelEntityView {
        const kind = this.kind.get(id);
        const position = this.position.get(id);
        if (kind === undefined || !position) {
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
            name,
            orientation,
            armor,
            weapon,
            targetId,
        };
    }
}
