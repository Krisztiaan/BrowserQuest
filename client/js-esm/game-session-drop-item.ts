type GridPosition = {
    x: number;
    y: number;
};

type DropItemHost<TItem> = {
    item: TItem;
    mobId: string | number;
    resolveDeadMobPosition(mobId: string | number): GridPosition | null;
    addItem(item: TItem, x: number, y: number): void;
    updateCursor(): void;
};

export function handleDropItem<TItem>(host: DropItemHost<TItem>): void {
    const position = host.resolveDeadMobPosition(host.mobId);
    if (!position) {
        return;
    }

    host.addItem(host.item, position.x, position.y);
    host.updateCursor();
}
