export type ClientUpdaterSystemHost = Readonly<{
    started: boolean;
    updater: { update(): void } | null;
}>;

export function runClientUpdaterSystem(host: ClientUpdaterSystemHost): void {
    if (!host.started) {
        return;
    }
    host.updater?.update();
}
