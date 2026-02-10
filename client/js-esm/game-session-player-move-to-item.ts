type MoveToItemTarget = {
    gridX: number;
    gridY: number;
};

type PlayerMoveToItemHost<TPlayer, TItem extends MoveToItemTarget> = {
    playerId: string | number;
    localPlayerId: string | number | null;
    itemId: string | number;
    resolvePlayer(playerId: string | number): TPlayer | null;
    resolveItem(itemId: string | number): TItem | null;
    movePlayerTo(player: TPlayer, x: number, y: number): void;
};

export function handlePlayerMoveToItem<TPlayer, TItem extends MoveToItemTarget>(
    host: PlayerMoveToItemHost<TPlayer, TItem>
): void {
    if (host.playerId === host.localPlayerId) {
        return;
    }

    const player = host.resolvePlayer(host.playerId);
    const item = host.resolveItem(host.itemId);
    if (!player || !item) {
        return;
    }

    host.movePlayerTo(player, item.gridX, item.gridY);
}
