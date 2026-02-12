import Types from '../../../shared/gametypes-browser';
import type { EntityKind } from '../../../shared/entity-kind-domain';
import type { EntityId } from '../../../shared/domain/ids';
import type { GridPos } from '../../../shared/domain/positions';
import { adaptKernelEntityForRendering } from '../kernel-entity-adapter';
import type { ClientWorldKernel, KernelEntityView } from '../world-kernel';

type GridIndexedEntity = {
    id: EntityId;
    kind: EntityKind;
    setSprite(sprite: unknown): void;
    getSpriteName(): string;
    setGridPosition(x: number, y: number): void;
    setOrientation?(orientation: number): void;
    idle?(): void;
};

export type ClientKernelReplicationSyncSystemHost = {
    kernel: ClientWorldKernel;
    sprites: Record<string, unknown>;
    entities: Record<string, GridIndexedEntity>;
    playerId: EntityId | null;
    entityIdExists(id: EntityId): boolean;
    getEntityById(id: EntityId): GridIndexedEntity | undefined;
    addItem(item: unknown, x: number, y: number): void;
    addEntity(entity: unknown): void;
    removeItem(item: unknown): void;
    removeEntity(entity: unknown): void;
    makeCharacterGoTo(entity: unknown, x: number, y: number): void;
    createAttackLink(attacker: unknown, target: unknown): void;
};

function isSamePos(a: GridPos | undefined, b: GridPos): boolean {
    return a !== undefined && a.x === b.x && a.y === b.y;
}

function safeOrientation(orientation: number | undefined): number {
    return orientation === Types.Orientations.UP ||
        orientation === Types.Orientations.DOWN ||
        orientation === Types.Orientations.LEFT ||
        orientation === Types.Orientations.RIGHT
        ? orientation
        : Types.Orientations.DOWN;
}

function addSpawnedEntity(host: ClientKernelReplicationSyncSystemHost, view: KernelEntityView): void {
    if (host.entityIdExists(view.id)) {
        host.kernel.clientReplicationKnownAlive.add(view.id);
        host.kernel.clientReplicationLastPos.set(view.id, view.position);
        if (view.targetId !== undefined) {
            host.kernel.clientReplicationLastTarget.set(view.id, view.targetId);
        }
        return;
    }

    const adapted = adaptKernelEntityForRendering(host.kernel, view.id);

    if (adapted.type === 'item') {
        host.addItem(adapted.entity, view.position.x, view.position.y);
        host.kernel.clientReplicationKnownAlive.add(view.id);
        host.kernel.clientReplicationLastPos.set(view.id, view.position);
        return;
    }

    if (adapted.type === 'chest') {
        const entity = adapted.entity as GridIndexedEntity;
        entity.setSprite(host.sprites[entity.getSpriteName()]);
        entity.setGridPosition(view.position.x, view.position.y);
        host.addEntity(entity as unknown);
        host.kernel.clientReplicationKnownAlive.add(view.id);
        host.kernel.clientReplicationLastPos.set(view.id, view.position);
        return;
    }

    const character = adapted.entity as GridIndexedEntity;
    const orientation = safeOrientation(adapted.orientation);
    character.setSprite(host.sprites[character.getSpriteName()]);
    character.setGridPosition(view.position.x, view.position.y);
    if (typeof character.setOrientation === 'function') {
        character.setOrientation(orientation);
    }
    character.idle?.();

    host.addEntity(character as unknown);
    host.kernel.clientReplicationKnownAlive.add(view.id);
    host.kernel.clientReplicationLastPos.set(view.id, view.position);

    if (adapted.targetId !== undefined) {
        host.kernel.clientReplicationLastTarget.set(view.id, adapted.targetId);
        const target = host.getEntityById(adapted.targetId);
        if (target) {
            host.createAttackLink(character as unknown, target as unknown);
        }
    }
}

export function runClientKernelReplicationSyncSystem(host: ClientKernelReplicationSyncSystemHost): void {
    const kernel = host.kernel;

    // Removed entities: kernel no longer considers them alive.
    for (const id of Array.from(kernel.clientReplicationKnownAlive)) {
        if (kernel.alive.has(id)) {
            continue;
        }
        const entity = host.entities[String(id)];
        if (entity) {
            if (Types.isItem(entity.kind)) {
                host.removeItem(entity as unknown);
            } else {
                host.removeEntity(entity as unknown);
            }
        }
        kernel.clientReplicationKnownAlive.delete(id);
        kernel.clientReplicationLastPos.delete(id);
        kernel.clientReplicationLastTarget.delete(id);
    }

    // New entities: kernel has them alive but the client has not yet synced them.
    for (const id of kernel.alive) {
        if (kernel.clientReplicationKnownAlive.has(id)) {
            continue;
        }

        const view = kernel.getEntityView(id);
        if (view.type === 'player' && host.playerId === null) {
            continue;
        }
        addSpawnedEntity(host, view);
    }

    // Movement: drive characters toward their authoritative kernel positions (once per destination).
    for (const [id, pos] of kernel.position.entries()) {
        if (!kernel.clientReplicationKnownAlive.has(id)) {
            continue;
        }
        if (isSamePos(kernel.clientReplicationLastPos.get(id), pos)) {
            continue;
        }

        const kind = kernel.kind.get(id);
        if (kind === undefined || Types.isItem(kind) || Types.isChest(kind)) {
            kernel.clientReplicationLastPos.set(id, pos);
            continue;
        }

        const entity = host.entities[String(id)];
        if (!entity) {
            kernel.clientReplicationLastPos.set(id, pos);
            continue;
        }

        host.makeCharacterGoTo(entity as unknown, pos.x, pos.y);
        kernel.clientReplicationLastPos.set(id, pos);
    }

    // Target updates: maintain attack links based on kernel target map changes.
    for (const [attackerId, targetId] of kernel.target.entries()) {
        if (!kernel.clientReplicationKnownAlive.has(attackerId) || !kernel.clientReplicationKnownAlive.has(targetId)) {
            continue;
        }
        const lastTargetId = kernel.clientReplicationLastTarget.get(attackerId);
        if (lastTargetId === targetId) {
            continue;
        }

        const attacker = host.entities[String(attackerId)];
        const target = host.entities[String(targetId)];
        if (!attacker || !target) {
            continue;
        }

        host.createAttackLink(attacker as unknown, target as unknown);
        kernel.clientReplicationLastTarget.set(attackerId, targetId);
    }
}

