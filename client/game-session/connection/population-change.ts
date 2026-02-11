type PopulationChangeHost = {
    worldPlayers: number;
    totalPlayers: number;
    onPlayersChanged: ((worldPlayers: number, totalPlayers: number) => void) | null;
};

export function handlePopulationChange(host: PopulationChangeHost): void {
    if (!host.onPlayersChanged) {
        return;
    }

    host.onPlayersChanged(host.worldPlayers, host.totalPlayers);
}
