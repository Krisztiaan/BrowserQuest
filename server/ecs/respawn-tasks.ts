import { createResourceKey } from './resources';

export type RespawnableEntity = Readonly<{
    emit(eventName: 'respawn'): void;
}>;

export type RespawnTask = Readonly<{
    atTick: number;
    entity: RespawnableEntity;
}>;

export const RESPAWN_TASKS_RESOURCE = createResourceKey<RespawnTask[]>('respawn_tasks');

