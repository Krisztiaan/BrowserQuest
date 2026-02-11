import type { EntityKindName } from '../../shared/js/entity-kind-domain';

export type MapMobAreaConfig = {
    id: string | number;
    nb: number;
    type: EntityKindName;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type MapChestAreaConfig = {
    id: string | number;
    x: number;
    y: number;
    w: number;
    h: number;
    tx: number;
    ty: number;
    i: unknown[];
};

export type MapChestConfig = {
    x: number;
    y: number;
    i: unknown[];
};

export const isMapMobAreaConfig = (value: unknown): value is MapMobAreaConfig => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const entry = value as Partial<MapMobAreaConfig>;
    return (
        (typeof entry.id === 'string' || typeof entry.id === 'number')
        && typeof entry.nb === 'number'
        && typeof entry.type === 'string'
        && typeof entry.x === 'number'
        && typeof entry.y === 'number'
        && typeof entry.width === 'number'
        && typeof entry.height === 'number'
    );
};

export const isMapChestAreaConfig = (value: unknown): value is MapChestAreaConfig => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const entry = value as Partial<MapChestAreaConfig>;
    return (
        (typeof entry.id === 'string' || typeof entry.id === 'number')
        && typeof entry.x === 'number'
        && typeof entry.y === 'number'
        && typeof entry.w === 'number'
        && typeof entry.h === 'number'
        && typeof entry.tx === 'number'
        && typeof entry.ty === 'number'
        && Array.isArray(entry.i)
    );
};

export const isMapChestConfig = (value: unknown): value is MapChestConfig => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const entry = value as Partial<MapChestConfig>;
    return typeof entry.x === 'number' && typeof entry.y === 'number' && Array.isArray(entry.i);
};
