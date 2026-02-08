import type { ProtocolAction } from '../../shared/js/protocol-contract-types';

export type ClientProtocolAction = ProtocolAction;
export type ClientProtocolBatch = ClientProtocolAction[];

export interface RuntimeEntity {
    id?: string | number;
    kind?: number;
    weaponName?: string;
    spriteName?: string;
    wasDropped?: boolean;
    playersInvolved?: Array<string | number>;
}

export type EntityFactoryBuilder = (id: string | number, name?: string) => RuntimeEntity;

export interface EntityFactoryContract {
    builders: Array<EntityFactoryBuilder | undefined>;
    createEntity(kind: number, id: string | number, name?: string): RuntimeEntity | undefined;
}

export interface GameClientProtocolBoundary {
    receiveAction(data: ClientProtocolAction): void;
    receiveActionBatch(actions: ClientProtocolBatch): void;
    sendMessage(payload: ClientProtocolAction): void;
}
