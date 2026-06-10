import { expect, test } from 'bun:test';
import { GameModuleRegistry } from '../../../shared/modules/module-registry';
import type { ModuleManifest } from '../../../shared/modules/module-registry';

test('module registry rejects duplicate module ids', () => {
    const registry = new GameModuleRegistry();
    const modA: ModuleManifest = { id: 'core.a', register() {} };
    const modA2: ModuleManifest = { id: 'core.a', register() {} };
    expect(() => registry.registerModules([modA, modA2])).toThrow(/Duplicate module id/);
});

test('module registry orders modules deterministically by dependency graph', () => {
    const registry = new GameModuleRegistry();
    const order: string[] = [];

    const modA: ModuleManifest = {
        id: 'core.a',
        register() {
            order.push('core.a');
        },
    };
    const modB: ModuleManifest = {
        id: 'core.b',
        deps: ['core.a'],
        register() {
            order.push('core.b');
        },
    };
    const modC: ModuleManifest = {
        id: 'core.c',
        deps: ['core.b'],
        register() {
            order.push('core.c');
        },
    };

    registry.registerModules([modC, modB, modA]);
    expect(registry.moduleOrder).toEqual(['core.a', 'core.b', 'core.c']);
    expect(order).toEqual(['core.a', 'core.b', 'core.c']);
});

test('module registry rejects unknown dependencies', () => {
    const registry = new GameModuleRegistry();
    const modA: ModuleManifest = { id: 'core.a', deps: ['missing.dep'], register() {} };
    expect(() => registry.registerModules([modA])).toThrow(/Unknown module dependency/);
});

test('module registry rejects dependency cycles', () => {
    const registry = new GameModuleRegistry();
    const modA: ModuleManifest = { id: 'core.a', deps: ['core.b'], register() {} };
    const modB: ModuleManifest = { id: 'core.b', deps: ['core.a'], register() {} };
    expect(() => registry.registerModules([modA, modB])).toThrow(/cycle/i);
});

test('module registry rejects duplicate handler registrations', () => {
    const registry = new GameModuleRegistry();
    const modA: ModuleManifest = {
        id: 'core.a',
        register(r: GameModuleRegistry) {
            r.registerIntentHandler('move.step', () => {});
            r.registerIntentHandler('move.step', () => {});
        },
    };
    expect(() => registry.registerModules([modA])).toThrow(/Duplicate intent handler/);
});
