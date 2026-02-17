import type { EntityId } from '../../../shared/domain/ids';
import Types from '../../../shared/gametypes-browser';
import type { ClientWorldKernel } from '../world-kernel';

type HighlightableEntity = {
    isHighlighted?: boolean;
    setHighlight(isHighlighted: boolean): void;
};

const isHighlightableEntity = (entity: object | null | undefined): entity is HighlightableEntity => {
    if (!entity || typeof entity !== 'object') {
        return false;
    }
    return typeof (entity as HighlightableEntity).setHighlight === 'function';
};

export type ClientHoverStateSystemHost = {
    started: boolean;
    player: { isOnPlateau: boolean } | null;
    renderer: { mobile: boolean; tablet: boolean; supportsSilhouettes: boolean };
    map: { isColliding(x: number, y: number): boolean; isPlateau(x: number, y: number): boolean } | null;
    kernel: ClientWorldKernel;
    entities: Record<string, object | null | undefined>;

    hoveringCollidingTile: boolean;
    hoveringPlateauTile: boolean;
    hoveringMob: boolean;
    hoveringItem: boolean;
    hoveringNpc: boolean;
    hoveringChest: boolean;
    lastHovered: HighlightableEntity | null;

    getMouseGridPosition(): { x: number; y: number };
};

function clearHover(host: ClientHoverStateSystemHost): void {
    host.hoveringCollidingTile = false;
    host.hoveringPlateauTile = false;
    host.hoveringMob = false;
    host.hoveringItem = false;
    host.hoveringNpc = false;
    host.hoveringChest = false;

    if (host.lastHovered) {
        host.lastHovered.setHighlight(false);
        host.lastHovered = null;
    }
}

export function runClientHoverStateSystem(host: ClientHoverStateSystemHost): void {
    if (!host.started || !host.player || !host.map || host.renderer.mobile || host.renderer.tablet) {
        clearHover(host);
        return;
    }

    const mouse = host.getMouseGridPosition();
    const x = mouse.x;
    const y = mouse.y;

    host.hoveringCollidingTile = host.map.isColliding(x, y);
    host.hoveringPlateauTile = host.player.isOnPlateau ? !host.map.isPlateau(x, y) : host.map.isPlateau(x, y);
    host.hoveringMob = false;
    host.hoveringNpc = false;
    host.hoveringChest = false;
    host.hoveringItem = host.kernel.getClientItemIdsAt(x, y).length > 0;

    let highlightId: EntityId | null = null;
    const entityIds = host.kernel.getClientEntityIdsAt(x, y);
    for (const id of entityIds) {
        const record = host.kernel.clientSpatialRecords.get(id);
        if (!record || record.isPlayer) {
            continue;
        }
        if (Types.isMob(record.kind)) {
            host.hoveringMob = true;
            highlightId ??= id;
        } else if (Types.isNpc(record.kind)) {
            host.hoveringNpc = true;
            highlightId ??= id;
        } else if (Types.isChest(record.kind)) {
            host.hoveringChest = true;
            highlightId ??= id;
        }
    }

    if (host.hoveringMob || host.hoveringNpc || host.hoveringChest) {
        const entity = highlightId !== null ? host.entities[String(highlightId)] : null;
        const highlightableEntity = entity && isHighlightableEntity(entity) ? entity : null;

        if (highlightableEntity && !highlightableEntity.isHighlighted && host.renderer.supportsSilhouettes) {
            if (host.lastHovered) {
                host.lastHovered.setHighlight(false);
            }
            host.lastHovered = highlightableEntity;
            highlightableEntity.setHighlight(true);
        }
        return;
    }

    if (host.lastHovered) {
        host.lastHovered.setHighlight(false);
        host.lastHovered = null;
    }
}
