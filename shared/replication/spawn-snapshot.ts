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
    extras: SpawnExtras;
}>;

function normalizeOrientation(value: unknown): number {
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
    const [, id, kind, x, y, ...tail] = action;

    if (Types.isPlayer(kind)) {
        const name = typeof tail[0] === 'string' ? tail[0] : '';
        const orientation = normalizeOrientation(tail[1]);
        const armor = isEntityKind(tail[2]) ? tail[2] : (0 as unknown as EntityKind);
        const weapon = isEntityKind(tail[3]) ? tail[3] : (0 as unknown as EntityKind);
        const targetId = typeof tail[4] === 'number' ? tail[4] : undefined;
        return { id, kind, x, y, extras: { type: 'player', name, orientation, armor, weapon, targetId } };
    }

    if (Types.isMob(kind)) {
        const orientation = normalizeOrientation(tail[0]);
        const targetId = typeof tail[1] === 'number' ? tail[1] : undefined;
        return { id, kind, x, y, extras: { type: 'mob', orientation, targetId } };
    }

    return { id, kind, x, y, extras: { type: 'simple' } };
}

export function encodeSpawnSnapshot(snapshot: SpawnSnapshot): ServerToClientSpawnAction {
    return [
        Types.Messages.SPAWN,
        snapshot.id,
        snapshot.kind,
        snapshot.x,
        snapshot.y,
        ...encodeSpawnTail(snapshot.extras),
    ];
}

function encodeSpawnTail(extras: SpawnExtras): ProtocolActionValue[] {
    switch (extras.type) {
        case 'player': {
            const tail: ProtocolActionValue[] = [extras.name, extras.orientation, extras.armor, extras.weapon];
            if (typeof extras.targetId === 'number') {
                tail.push(extras.targetId);
            }
            return tail;
        }
        case 'mob': {
            const tail: ProtocolActionValue[] = [extras.orientation];
            if (typeof extras.targetId === 'number') {
                tail.push(extras.targetId);
            }
            return tail;
        }
        case 'simple':
            return [];
        default: {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _exhaustive: never = extras;
            return [];
        }
    }
}

function isEntityKind(value: unknown): value is EntityKind {
    return typeof value === 'number' || typeof value === 'string';
}
