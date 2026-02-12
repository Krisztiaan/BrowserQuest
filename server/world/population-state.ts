import { buildPopulationAction } from '../protocol/outbound-actions';

type PlayerMap = Record<string, unknown>;

type PlayerCountHolder = {
    playerCount: number;
};

type PopulationNotifyHost = {
    playerCount: number;
    pushBroadcast(message: unknown): void;
};

export function countPlayersInWorld(playerMap: PlayerMap): number {
    let count = 0;
    for (const playerId in playerMap) {
        if (playerMap.hasOwnProperty(playerId)) {
            count += 1;
        }
    }
    return count;
}

export function setWorldPlayerCount(holder: PlayerCountHolder, count: number): void {
    holder.playerCount = count;
}

export function incrementWorldPlayerCount(holder: PlayerCountHolder): void {
    setWorldPlayerCount(holder, holder.playerCount + 1);
}

export function decrementWorldPlayerCount(holder: PlayerCountHolder): void {
    if (holder.playerCount > 0) {
        setWorldPlayerCount(holder, holder.playerCount - 1);
    }
}

export function notifyWorldPopulation(host: PopulationNotifyHost, totalPlayers: number | null): void {
    const resolvedTotalPlayers = totalPlayers ?? host.playerCount;
    host.pushBroadcast(buildPopulationAction(host.playerCount, resolvedTotalPlayers));
}
