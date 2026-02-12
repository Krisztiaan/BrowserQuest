import type { CursorKey } from '../../asset-key-domain';

export type ClientCursorSystemHost = {
    started: boolean;
    hoveringCollidingTile: boolean;
    hoveringMob: boolean;
    hoveringNpc: boolean;
    hoveringItem: boolean;
    hoveringChest: boolean;

    targetColor: string;
    hoveringTarget: boolean;
    targetCellVisible: boolean;

    setCursor(name: CursorKey, orientation?: number): void;
};

export function runClientCursorSystem(host: ClientCursorSystemHost): void {
    if (host.hoveringCollidingTile && host.started) {
        host.targetColor = 'rgba(255, 50, 50, 0.5)';
    } else {
        host.targetColor = 'rgba(255, 255, 255, 0.5)';
    }

    if (host.hoveringMob && host.started) {
        host.setCursor('sword');
        host.hoveringTarget = false;
        host.targetCellVisible = false;
    } else if (host.hoveringNpc && host.started) {
        host.setCursor('talk');
        host.hoveringTarget = false;
        host.targetCellVisible = false;
    } else if ((host.hoveringItem || host.hoveringChest) && host.started) {
        host.setCursor('loot');
        host.hoveringTarget = false;
        host.targetCellVisible = true;
    } else {
        host.setCursor('hand');
        host.hoveringTarget = false;
        host.targetCellVisible = true;
    }
}

