export type ClientUpdaterSystemHost = Readonly<{
    updater: { update(): void } | null;
}>;

export function runClientUpdaterSystem(host: ClientUpdaterSystemHost): void {
    host.updater?.update();
}

