import EntityFactory from '../entityfactory';
import Item from '../item';
import Chest from '../chest';
import Character from '../character';
import Types from '../../shared/gametypes-browser';
import { getMobPrefab } from '../../shared/content/prefabs';
import type { EntityId } from '../../shared/domain/ids';
import type { EntityKind } from '../../shared/entity-kind-domain';
import type { ClientWorldKernel, KernelEntityView } from './world-kernel';

type AdaptedCharacter = {
    id: EntityId;
    weaponName?: string;
    spriteName?: string;
};

export type AdaptedEntity =
    | Readonly<{ type: 'item'; entity: Item }>
    | Readonly<{ type: 'chest'; entity: Chest }>
    | Readonly<{
          type: 'character';
          entity: Character;
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
    const entity = EntityFactory.createEntity(view.kind, view.id, view.type === 'player' ? view.name : undefined);

    if (Types.isItem(view.kind)) {
        if (!(entity instanceof Item)) {
            throw new Error(`Expected item entity for kind=${String(view.kind)} id=${String(view.id)}`);
        }
        return { type: 'item', entity };
    }

    if (Types.isChest(view.kind)) {
        if (!(entity instanceof Chest)) {
            throw new Error(`Expected chest entity for kind=${String(view.kind)} id=${String(view.id)}`);
        }
        return { type: 'chest', entity };
    }

    if (!(entity instanceof Character)) {
        throw new Error(`Expected character entity for kind=${String(view.kind)} id=${String(view.id)}`);
    }
    const character = entity as AdaptedCharacter & Character;

    if (view.type === 'player') {
        character.weaponName = toKindName(view.weapon);
        character.spriteName = toKindName(view.armor);
    }

    if (Types.isMob(view.kind)) {
        const prefab = getMobPrefab(view.kind);
        if (prefab) {
            character.setMaxHitPoints(prefab.combat.maxHitPoints);
        }
    }

    return {
        type: 'character',
        entity: character,
        orientation: view.orientation,
        targetId: view.targetId,
    };
}
