import { expect, test } from 'bun:test';
import {
    WORLDSERVER_CALLBACK_FIELDS,
    WORLDSERVER_CONSTRUCTOR_FIELDS,
    WORLDSERVER_RUNTIME_DEPENDENCY_BOUNDARIES,
    WORLDSERVER_SHADOW_SOURCE_PRE_SLICE,
} from '../../server/js/worldserver-types';

function hasDuplicates(values: readonly string[]): boolean {
    return new Set(values).size !== values.length;
}

test('worldserver pre-slice inventory keeps deterministic dependency/field boundaries', () => {
    expect(WORLDSERVER_RUNTIME_DEPENDENCY_BOUNDARIES.length).toBe(15);
    expect(hasDuplicates(WORLDSERVER_RUNTIME_DEPENDENCY_BOUNDARIES)).toBe(false);
    expect(WORLDSERVER_RUNTIME_DEPENDENCY_BOUNDARIES).toContain('./map');
    expect(WORLDSERVER_RUNTIME_DEPENDENCY_BOUNDARIES).toContain('./player');
    expect(WORLDSERVER_RUNTIME_DEPENDENCY_BOUNDARIES).toContain('../../shared/js/gametypes');

    expect(WORLDSERVER_CONSTRUCTOR_FIELDS.length).toBe(20);
    expect(hasDuplicates(WORLDSERVER_CONSTRUCTOR_FIELDS)).toBe(false);
    expect(WORLDSERVER_CONSTRUCTOR_FIELDS).toContain('entities');
    expect(WORLDSERVER_CONSTRUCTOR_FIELDS).toContain('outgoingQueues');
    expect(WORLDSERVER_CONSTRUCTOR_FIELDS).toContain('zoneGroupsReady');

    expect(WORLDSERVER_CALLBACK_FIELDS.length).toBe(7);
    expect(hasDuplicates(WORLDSERVER_CALLBACK_FIELDS)).toBe(false);
    expect(WORLDSERVER_CALLBACK_FIELDS).toContain('connect_callback');
    expect(WORLDSERVER_CALLBACK_FIELDS).toContain('attack_callback');

    expect(WORLDSERVER_SHADOW_SOURCE_PRE_SLICE.dependencyBoundaries).toEqual(WORLDSERVER_RUNTIME_DEPENDENCY_BOUNDARIES);
    expect(WORLDSERVER_SHADOW_SOURCE_PRE_SLICE.constructorFields).toEqual(WORLDSERVER_CONSTRUCTOR_FIELDS);
    expect(WORLDSERVER_SHADOW_SOURCE_PRE_SLICE.callbackFields).toEqual(WORLDSERVER_CALLBACK_FIELDS);
});
