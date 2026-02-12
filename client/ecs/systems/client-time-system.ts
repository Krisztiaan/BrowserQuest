export type ClientTimeSystemHost = {
    currentTime: number;
};

export function runClientTimeSystem(host: ClientTimeSystemHost): void {
    host.currentTime = Date.now();
}

