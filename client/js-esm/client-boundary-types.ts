import type { ClientToServerProtocolAction, ServerToClientProtocolAction } from '../../shared/js/protocol-contract-types';
import type { EntityKind } from '../../shared/js/entity-kind-domain';

export type ClientInboundProtocolAction = ServerToClientProtocolAction;
export type ClientOutboundProtocolAction = ClientToServerProtocolAction;
export type ClientProtocolAction = ClientInboundProtocolAction;
export type ClientProtocolBatch = ClientProtocolAction[];

export interface RuntimeEntity {
    id?: string | number;
    kind?: EntityKind;
    weaponName?: string;
    spriteName?: string;
    wasDropped?: boolean;
    playersInvolved?: Array<string | number>;
}

export type EntityFactoryBuilder = (id: string | number, name?: string) => RuntimeEntity;

export interface EntityFactoryContract {
    builders: Array<EntityFactoryBuilder | undefined>;
    createEntity(kind: EntityKind, id: string | number, name?: string): RuntimeEntity | undefined;
}

export interface GameClientProtocolBoundary {
    receiveAction(data: ClientInboundProtocolAction): void;
    receiveActionBatch(actions: ClientProtocolBatch): void;
    sendMessage(payload: ClientOutboundProtocolAction): void;
}
