import type { EntityId } from '../../../shared/domain/ids';

type HighlightableEntity = {
    isHighlighted?: boolean;
    setHighlight(isHighlighted: boolean): void;
};

const isHighlightableEntity = (entity: unknown): entity is HighlightableEntity => {
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

    hoveringCollidingTile: boolean;
    hoveringPlateauTile: boolean;
    hoveringMob: boolean;
    hoveringItem: boolean;
    hoveringNpc: boolean;
    hoveringChest: boolean;
    lastHovered: HighlightableEntity | null;

    getMouseGridPosition(): { x: number; y: number };
    isMobAt(x: number, y: number): boolean;
    isItemAt(x: number, y: number): boolean;
    isNpcAt(x: number, y: number): boolean;
    isChestAt(x: number, y: number): boolean;
    getEntityAt(x: number, y: number): { id: EntityId } | null;
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
    host.hoveringMob = host.isMobAt(x, y);
    host.hoveringItem = host.isItemAt(x, y);
    host.hoveringNpc = host.isNpcAt(x, y);
    host.hoveringChest = host.isChestAt(x, y);

    if (host.hoveringMob || host.hoveringNpc || host.hoveringChest) {
        const entity = host.getEntityAt(x, y);
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

