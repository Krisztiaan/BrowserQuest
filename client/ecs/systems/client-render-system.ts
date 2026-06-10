import type { GameRenderer } from '../../rendering/renderer-contract';

export type ClientRenderSystemHost = Readonly<{
    started: boolean;
    currentTime: number;
    gameRenderer: GameRenderer | null;
}>;

export function runClientRenderSystem(host: ClientRenderSystemHost): void {
    if (!host.started) {
        return;
    }
    host.gameRenderer?.renderFrame({ nowMs: host.currentTime });
}
