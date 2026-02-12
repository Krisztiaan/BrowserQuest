import { expect, test } from 'bun:test';
import { createResourceKey, WorldResources } from '../../../server/ecs/resources';

test('WorldResources stores and retrieves typed resources', () => {
    const HealthConfig = createResourceKey<{ max: number }>('HealthConfig');
    const resources = new WorldResources();

    expect(resources.has(HealthConfig)).toBe(false);
    resources.set(HealthConfig, { max: 100 });
    expect(resources.has(HealthConfig)).toBe(true);
    expect(resources.get(HealthConfig)).toEqual({ max: 100 });
    expect(resources.require(HealthConfig)).toEqual({ max: 100 });
});
