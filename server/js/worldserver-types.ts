export const WORLDSERVER_RUNTIME_DEPENDENCY_BOUNDARIES = [
    './entity',
    './character',
    './log',
    './mob',
    './map',
    './npc',
    './player',
    './item',
    './mobarea',
    './chestarea',
    './chest',
    './message',
    './properties',
    './utils',
    '../../shared/js/gametypes',
] as const;

export type WorldserverRuntimeDependencyBoundary =
    (typeof WORLDSERVER_RUNTIME_DEPENDENCY_BOUNDARIES)[number];

export const WORLDSERVER_CONSTRUCTOR_FIELDS = [
    'id',
    'maxPlayers',
    'server',
    'ups',
    'map',
    'entities',
    'players',
    'mobs',
    'attackers',
    'items',
    'equipping',
    'hurt',
    'npcs',
    'mobAreas',
    'chestAreas',
    'groups',
    'outgoingQueues',
    'itemCount',
    'playerCount',
    'zoneGroupsReady',
] as const;

export type WorldserverConstructorField = (typeof WORLDSERVER_CONSTRUCTOR_FIELDS)[number];

export const WORLDSERVER_CALLBACK_FIELDS = [
    'init_callback',
    'connect_callback',
    'enter_callback',
    'added_callback',
    'removed_callback',
    'regen_callback',
    'attack_callback',
] as const;

export type WorldserverCallbackField = (typeof WORLDSERVER_CALLBACK_FIELDS)[number];

export interface WorldserverShadowSourcePreSlice {
    dependencyBoundaries: readonly WorldserverRuntimeDependencyBoundary[];
    constructorFields: readonly WorldserverConstructorField[];
    callbackFields: readonly WorldserverCallbackField[];
}

export const WORLDSERVER_SHADOW_SOURCE_PRE_SLICE: WorldserverShadowSourcePreSlice = {
    dependencyBoundaries: WORLDSERVER_RUNTIME_DEPENDENCY_BOUNDARIES,
    constructorFields: WORLDSERVER_CONSTRUCTOR_FIELDS,
    callbackFields: WORLDSERVER_CALLBACK_FIELDS,
};
