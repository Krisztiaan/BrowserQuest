type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

export type GridPos = Brand<Readonly<{ x: number; y: number }>, 'GridPos'>;
export type WorldPos = Brand<Readonly<{ x: number; y: number }>, 'WorldPos'>;
type PositionCandidate = Readonly<{ x?: number; y?: number }>;
type PositionInput = PositionCandidate | number | string | boolean | bigint | null | undefined;

function isFiniteNumber(value: PositionInput): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isFiniteInteger(value: PositionInput): value is number {
    return isFiniteNumber(value) && Number.isSafeInteger(value) && Number.isInteger(value);
}

function isPositionCandidate(value: object | null | undefined): value is PositionCandidate {
    return !!value && !Array.isArray(value) && 'x' in value && 'y' in value;
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

export function isGridPos(value: PositionInput): value is GridPos {
    if (!value || typeof value !== 'object' || !isPositionCandidate(value)) {
        return false;
    }
    return isFiniteInteger(value.x) && isFiniteInteger(value.y);
}

export function isWorldPos(value: PositionInput): value is WorldPos {
    if (!value || typeof value !== 'object' || !isPositionCandidate(value)) {
        return false;
    }
    return isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

export function gridPosKey(pos: GridPos): string {
    return `${pos.x},${pos.y}`;
}
