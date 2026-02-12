export type ClientRenderSystemHost = Readonly<{
    started: boolean;
    renderer: { renderFrame(): void } | null;
}>;

export function runClientRenderSystem(host: ClientRenderSystemHost): void {
    if (!host.started) {
        return;
    }
    host.renderer?.renderFrame();
}
