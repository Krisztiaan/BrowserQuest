export type ClientRenderSystemHost = Readonly<{
    renderer: { renderFrame(): void } | null;
}>;

export function runClientRenderSystem(host: ClientRenderSystemHost): void {
    host.renderer?.renderFrame();
}

