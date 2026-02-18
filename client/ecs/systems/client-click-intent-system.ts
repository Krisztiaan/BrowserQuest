import { gridPos } from '../../../shared/domain/positions';
import Types from '../../../shared/gametypes-browser';
import type { EntityId } from '../../../shared/domain/ids';
import type { EntityKind } from '../../../shared/entity-kind-domain';
import type { ClientWorldKernel } from '../world-kernel';
import { clearClientInteractionIntentWithSideEffects } from './client-interaction-intent-system';
import { debugClicks } from '../../debug-flags';

export type ClientClickIntentSystemHost = Readonly<{
    started: boolean;
    kernel: ClientWorldKernel;
    player: {
        gridX: number;
        gridY: number;
        isDead: boolean;
        isOnPlateau: boolean;
        nextGridX?: number;
        nextGridY?: number;
    } | null;
    map:
        | {
              isColliding(x: number, y: number): boolean;
              isPlateau(x: number, y: number): boolean;
              isDoor?(x: number, y: number): boolean;
              getDoorDestination?(x: number, y: number): {
                  x: number;
                  y: number;
                  orientation: number;
                  portal: boolean;
                  cameraX?: number;
                  cameraY?: number;
              } | undefined;
          }
        | null;

    isZoning(): boolean;
    isZoningTile(x: number, y: number): boolean;
}>;

type SpatialPick = Readonly<{ id: EntityId; x: number; y: number; kind: EntityKind; isPlayer: boolean }>;

function pickEntityAt(kernel: ClientWorldKernel, x: number, y: number): SpatialPick | null {
    const ids = kernel.getClientEntityIdsAt(x, y);
    for (const id of ids) {
        const record = kernel.clientSpatialRecords.get(id);
        if (!record) {
            continue;
        }
        if (record.isPlayer) {
            continue;
        }
        if (record.isDead) {
            continue;
        }
        return { id, x: record.gridX, y: record.gridY, kind: record.kind, isPlayer: record.isPlayer };
    }
    return null;
}

function pickItemAt(kernel: ClientWorldKernel, x: number, y: number): SpatialPick | null {
    const ids = kernel.getClientItemIdsAt(x, y);
    if (ids.length === 0) {
        return null;
    }

    let picked: SpatialPick | null = null;
    for (const id of ids) {
        const record = kernel.clientSpatialRecords.get(id);
        if (!record) {
            continue;
        }
        picked ??= { id, x: record.gridX, y: record.gridY, kind: record.kind, isPlayer: record.isPlayer };
        if (Types.isExpendableItem(record.kind)) {
            picked = { id, x: record.gridX, y: record.gridY, kind: record.kind, isPlayer: record.isPlayer };
        }
    }

    return picked;
}

export function runClientClickIntentSystem(host: ClientClickIntentSystemHost): void {
    const intent = host.kernel.clientClickIntent;
    if (!intent) {
        return;
    }

    // Consume intent exactly once.
    host.kernel.clearClientClickIntent();

    debugClicks('intent', {
        raw: { x: intent.x, y: intent.y },
        started: host.started,
        hasPlayer: Boolean(host.player),
        hasMap: Boolean(host.map),
    });

    if (!host.started || !host.player || !host.map) {
        debugClicks('ignore:not_ready');
        return;
    }

    if (host.kernel.clientMoveInputKeysMask !== 0) {
        debugClicks('ignore:move_input_active');
        return;
    }

    const map = host.map;
    const resolveDoorClick = (x: number, y: number): { x: number; y: number } | null => {
        if (!map.isDoor) {
            return null;
        }
        if (map.isDoor(x, y)) {
            return { x, y };
        }
        const adjacent = [
            { x: x - 1, y },
            { x: x + 1, y },
            { x, y: y - 1 },
            { x, y: y + 1 },
        ];
        for (const candidate of adjacent) {
            if (map.isDoor(candidate.x, candidate.y)) {
                return candidate;
            }
        }
        return null;
    };

    let x = intent.x;
    let y = intent.y;

    const doorClick = map.isDoor?.(x, y) ? { x, y } : map.isColliding(x, y) ? resolveDoorClick(x, y) : null;
    if (doorClick) {
        x = doorClick.x;
        y = doorClick.y;
    }

    debugClicks('resolved', {
        click: { x, y },
        doorClick,
        player: {
            x: host.player.gridX,
            y: host.player.gridY,
            nextX: host.player.nextGridX ?? null,
            nextY: host.player.nextGridY ?? null,
        },
        map: {
            isDoor: map.isDoor?.(x, y) ?? null,
            isColliding: map.isColliding(x, y),
            isPlateau: map.isPlateau(x, y),
        },
    });

    if (doorClick && map.getDoorDestination) {
        const destination = map.getDoorDestination(x, y);
        if (destination) {
            debugClicks('door:destination', destination);
            host.kernel.setClientPendingDoorTraversal({
                doorX: x,
                doorY: y,
                toX: destination.x,
                toY: destination.y,
                orientation: destination.orientation,
                portal: destination.portal,
                cameraX: destination.cameraX,
                cameraY: destination.cameraY,
            });
        } else {
            debugClicks('door:destination:none');
            host.kernel.clearClientPendingDoorTraversal();
        }
    } else {
        host.kernel.clearClientPendingDoorTraversal();
    }

    if (map.isDoor?.(x, y) && host.player.gridX === x && host.player.gridY === y) {
        debugClicks('door:arm', { x, y });
        host.kernel.clientDoorTraversalArmed = true;
        return;
    }

    const nextX = host.player.nextGridX ?? -1;
    const nextY = host.player.nextGridY ?? -1;

    const hoveringCollidingTile = map.isColliding(x, y) && !(map.isDoor?.(x, y) ?? false);
    const hoveringPlateauTile = host.player.isOnPlateau ? !host.map.isPlateau(x, y) : host.map.isPlateau(x, y);

    if (
        host.isZoning() ||
        host.isZoningTile(nextX, nextY) ||
        host.player.isDead ||
        hoveringCollidingTile ||
        hoveringPlateauTile
    ) {
        debugClicks('ignore:gated', {
            isZoning: host.isZoning(),
            isZoningTile: host.isZoningTile(nextX, nextY),
            isDead: host.player.isDead,
            hoveringCollidingTile,
            hoveringPlateauTile,
            click: { x, y },
            next: { x: nextX, y: nextY },
        });
        return;
    }

    const kernel = host.kernel;

    const entity = pickEntityAt(kernel, x, y);
    if (entity && Types.isMob(entity.kind)) {
        debugClicks('pick:mob', { id: entity.id, kind: entity.kind, x: entity.x, y: entity.y });
        host.kernel.enqueueClientCommand({ type: 'stopPlayerCombat' });
        host.kernel.setClientInteractionIntent({
            kind: 'attack',
            targetId: entity.id,
            lastKnownTargetPos: gridPos(entity.x, entity.y),
        });
        return;
    }

    const item = pickItemAt(kernel, x, y);
    if (item) {
        debugClicks('pick:item', { id: item.id, kind: item.kind, x: item.x, y: item.y });
        host.kernel.enqueueClientCommand({ type: 'stopPlayerCombat' });
        host.kernel.clearClientLootAttempt();
        host.kernel.setClientInteractionIntent({
            kind: 'loot',
            targetId: item.id,
            lastKnownTargetPos: gridPos(item.x, item.y),
        });
        host.kernel.enqueueClientCommand({ type: 'playerGoToItem', itemId: item.id });
        return;
    }

    if (entity && Types.isNpc(entity.kind)) {
        debugClicks('pick:npc', { id: entity.id, kind: entity.kind, x: entity.x, y: entity.y });
        host.kernel.enqueueClientCommand({ type: 'stopPlayerCombat' });
        host.kernel.setClientInteractionIntent({
            kind: 'talk',
            targetId: entity.id,
            lastKnownTargetPos: gridPos(entity.x, entity.y),
        });
        return;
    }

    if (entity && Types.isChest(entity.kind)) {
        debugClicks('pick:chest', { id: entity.id, kind: entity.kind, x: entity.x, y: entity.y });
        host.kernel.enqueueClientCommand({ type: 'stopPlayerCombat' });
        host.kernel.setClientInteractionIntent({
            kind: 'open',
            targetId: entity.id,
            lastKnownTargetPos: gridPos(entity.x, entity.y),
        });
        return;
    }

    clearClientInteractionIntentWithSideEffects(host);
    debugClicks('move', { x, y });
    host.kernel.enqueueClientCommand({ type: 'playerGoTo', x, y });
}
