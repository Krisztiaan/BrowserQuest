import type { EntityId } from '../../shared/domain/ids';

export type ClientCommand =
    | Readonly<{ type: 'stopPlayerCombat' }>
    | Readonly<{ type: 'playerGoTo'; x: number; y: number }>
    | Readonly<{ type: 'playerGoToItem'; itemId: EntityId }>;

