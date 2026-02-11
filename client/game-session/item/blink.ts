type BlinkItem = {
    blink(speed: number): void;
};

type ItemBlinkHost<TItem extends BlinkItem> = {
    item: TItem | null;
    speed: number;
};

export function handleItemBlink<TItem extends BlinkItem>(host: ItemBlinkHost<TItem>): void {
    if (!host.item) {
        return;
    }

    host.item.blink(host.speed);
}
