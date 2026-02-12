import type {
    ClientToServerProtocolAction,
    ServerToClientProtocolAction,
} from '../shared/protocol/types';
import type { EntityKind } from '../shared/entity-kind-domain';
import type { EntityId } from '../shared/domain/ids';

export type ClientInboundProtocolAction = ServerToClientProtocolAction;
export type ClientOutboundProtocolAction = ClientToServerProtocolAction;
export type ClientInboundActionByOpcode<Opcode extends ClientInboundProtocolAction[0]> = Extract<
    ClientInboundProtocolAction,
    [Opcode, ...unknown[]]
>;
export type ClientProtocolAction = ClientInboundProtocolAction;
export type ClientProtocolBatch = ClientProtocolAction[];

export interface RuntimeEntity {
    id?: EntityId;
    kind?: EntityKind;
    weaponName?: string | null;
    spriteName?: string;
    wasDropped?: boolean;
    playersInvolved?: Array<EntityId>;
}

export type EntityFactoryBuilder = (id: EntityId, name?: string) => RuntimeEntity;

export interface EntityFactoryContract {
    builders: Array<EntityFactoryBuilder | undefined>;
    createEntity(kind: EntityKind, id: EntityId, name?: string): RuntimeEntity;
}

export interface GameClientProtocolBoundary {
    receiveAction(data: ClientInboundProtocolAction): void;
    receiveActionBatch(actions: ClientProtocolBatch): void;
    sendMessage(payload: ClientOutboundProtocolAction): void;
}
