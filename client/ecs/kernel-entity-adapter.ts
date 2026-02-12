import EntityFactory from '../entityfactory';
import Types from '../../shared/gametypes-browser';
import type { EntityId } from '../../shared/domain/ids';
import type { EntityKind } from '../../shared/entity-kind-domain';
import type { ClientWorldKernel, KernelEntityView } from './world-kernel';

type AdaptedCharacter = {
    id: EntityId;
    weaponName?: string;
    spriteName?: string;
};

export type AdaptedEntity =
    | Readonly<{ type: 'item'; entity: unknown }>
    | Readonly<{ type: 'chest'; entity: unknown }>
    | Readonly<{
          type: 'character';
          entity: unknown;
          orientation: number | undefined;
          targetId: EntityId | undefined;
      }>;

function toKindName(kind: EntityKind | undefined): string | undefined {
    if (kind === undefined) {
        return undefined;
    }
    return Types.getKindAsString(kind);
}

export function adaptKernelEntityForRendering(kernel: ClientWorldKernel, id: EntityId): AdaptedEntity {
    const view: KernelEntityView = kernel.getEntityView(id);

    if (Types.isItem(view.kind)) {
        return { type: 'item', entity: EntityFactory.createEntity(view.kind, view.id) };
    }

    if (Types.isChest(view.kind)) {
        return { type: 'chest', entity: EntityFactory.createEntity(view.kind, view.id) };
    }

    const name = view.type === 'player' ? view.name : undefined;
    const character = EntityFactory.createEntity(view.kind, view.id, name) as AdaptedCharacter;

    if (view.type === 'player') {
        character.weaponName = toKindName(view.weapon);
        character.spriteName = toKindName(view.armor);
    }

    return {
        type: 'character',
        entity: character,
        orientation: view.orientation,
        targetId: view.targetId,
    };
}

