import Types from '../gametypes-browser';
import type { EntityKind } from '../entity-kind-domain';
import type { ProtocolActionValue, ServerToClientSpawnAction } from '../protocol/types';

export type SpawnExtras =
    | Readonly<{ type: 'simple' }>
    | Readonly<{
          type: 'player';
          name: string;
          orientation: number;
          armor: EntityKind;
          weapon: EntityKind;
          targetId?: number;
      }>
    | Readonly<{
          type: 'mob';
          orientation: number;
          targetId?: number;
      }>;

export type SpawnSnapshot = Readonly<{
    id: number;
    kind: EntityKind;
    x: number;
    y: number;
    mapId?: string;
    extras: SpawnExtras;
}>;

type LooseValue = string | number | boolean | null | undefined | object;
const DEFAULT_ENTITY_KIND = 0 as EntityKind;

function normalizeOrientation(value: LooseValue): number {
    if (typeof value !== 'number') {
        return Types.Orientations.DOWN;
    }
    switch (value) {
        case Types.Orientations.UP:
        case Types.Orientations.DOWN:
        case Types.Orientations.LEFT:
        case Types.Orientations.RIGHT:
            return value;
        default:
            return Types.Orientations.DOWN;
    }
}

export function decodeSpawnAction(action: ServerToClientSpawnAction): SpawnSnapshot {
    const [, id, kind, x, y, ...wireTail] = action;
    const tail = [...wireTail];
    const mapIdRaw = tail.length > 0 ? tail[tail.length - 1] : undefined;
    const mapId = typeof mapIdRaw === 'string' && mapIdRaw.trim().length > 0 ? mapIdRaw : undefined;
    if (mapId !== undefined) {
        tail.pop();
    }

    if (Types.isPlayer(kind)) {
        const name = typeof tail[0] === 'string' ? tail[0] : '';
        const orientation = normalizeOrientation(tail[1]);
        const armor = isEntityKind(tail[2]) ? tail[2] : DEFAULT_ENTITY_KIND;
        const weapon = isEntityKind(tail[3]) ? tail[3] : DEFAULT_ENTITY_KIND;
        const targetId = typeof tail[4] === 'number' ? tail[4] : undefined;
        return { id, kind, x, y, ...(mapId ? { mapId } : {}), extras: { type: 'player', name, orientation, armor, weapon, targetId } };
    }

    if (Types.isMob(kind)) {
        const orientation = normalizeOrientation(tail[0]);
        const targetId = typeof tail[1] === 'number' ? tail[1] : undefined;
        return { id, kind, x, y, ...(mapId ? { mapId } : {}), extras: { type: 'mob', orientation, targetId } };
    }

    return { id, kind, x, y, ...(mapId ? { mapId } : {}), extras: { type: 'simple' } };
}

export function encodeSpawnSnapshot(snapshot: SpawnSnapshot): ServerToClientSpawnAction {
    return [
        Types.Messages.SPAWN,
        snapshot.id,
        snapshot.kind,
        snapshot.x,
        snapshot.y,
        ...encodeSpawnTail(snapshot.extras, snapshot.mapId),
    ];
}

function encodeSpawnTail(extras: SpawnExtras, mapId?: string): ProtocolActionValue[] {
    const normalizedMapId = typeof mapId === 'string' && mapId.trim().length > 0 ? mapId : undefined;
    switch (extras.type) {
        case 'player': {
            const tail: ProtocolActionValue[] = [extras.name, extras.orientation, extras.armor, extras.weapon];
            if (typeof extras.targetId === 'number') {
                tail.push(extras.targetId);
            }
            if (normalizedMapId) {
                tail.push(normalizedMapId);
            }
            return tail;
        }
        case 'mob': {
            const tail: ProtocolActionValue[] = [extras.orientation];
            if (typeof extras.targetId === 'number') {
                tail.push(extras.targetId);
            }
            if (normalizedMapId) {
                tail.push(normalizedMapId);
            }
            return tail;
        }
        case 'simple':
            return normalizedMapId ? [normalizedMapId] : [];
        default: {
            throw new Error(`Unsupported spawn extras payload: ${(extras as { type: string }).type}`);
        }
    }
}

function isEntityKind(value: LooseValue): value is EntityKind {
    return typeof value === 'number' || typeof value === 'string';
}
