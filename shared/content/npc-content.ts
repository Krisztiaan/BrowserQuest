import { ENTITY_KIND_DOMAIN, type EntityKind, type EntityKindName } from '../entity-kind-domain';
import Types from '../gametypes-browser';

function isEntityKindName(value: string): value is EntityKindName {
    return value in ENTITY_KIND_DOMAIN;
}

export function resolveNpcContentIdFromKind(kind: EntityKind): string | null {
    const kindName = typeof kind === 'string' ? kind : Types.getKindAsString(kind);
    if (!kindName || !isEntityKindName(kindName)) {
        return null;
    }
    return ENTITY_KIND_DOMAIN[kindName][1] === 'npc' ? kindName : null;
}
