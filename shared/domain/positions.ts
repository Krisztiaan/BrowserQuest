type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

export type GridPos = Brand<Readonly<{ x: number; y: number }>, 'GridPos'>;
export type WorldPos = Brand<Readonly<{ x: number; y: number }>, 'WorldPos'>;

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isFiniteInteger(value: unknown): value is number {
    return isFiniteNumber(value) && Number.isSafeInteger(value) && Number.isInteger(value);
}

export function gridPos(x: number, y: number): GridPos {
    if (!isFiniteInteger(x) || !isFiniteInteger(y)) {
        throw new Error(`Invalid GridPos: (${String(x)}, ${String(y)})`);
    }
    return { x, y } as GridPos;
}

export function worldPos(x: number, y: number): WorldPos {
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
        throw new Error(`Invalid WorldPos: (${String(x)}, ${String(y)})`);
    }
    return { x, y } as WorldPos;
}

export function isGridPos(value: unknown): value is GridPos {
    return (
        typeof value === 'object'
        && value !== null
        && 'x' in value
        && 'y' in value
        && isFiniteInteger((value as { x?: unknown }).x)
        && isFiniteInteger((value as { y?: unknown }).y)
    );
}

export function isWorldPos(value: unknown): value is WorldPos {
    return (
        typeof value === 'object'
        && value !== null
        && 'x' in value
        && 'y' in value
        && isFiniteNumber((value as { x?: unknown }).x)
        && isFiniteNumber((value as { y?: unknown }).y)
    );
}

export function gridPosKey(pos: GridPos): string {
    return `${pos.x},${pos.y}`;
}

