import { expect, test } from 'bun:test';
import { buildPathingIgnoreList } from '../../client/runtime/pathing-ignore-list';

test('buildPathingIgnoreList always includes requester', () => {
    const requester = {
        gridX: 10,
        gridY: 11,
        target: null,
        hasTarget() {
            return false;
        },
    };

    const ignored = buildPathingIgnoreList(requester);
    expect(ignored).toEqual([requester]);
});

test('buildPathingIgnoreList includes current target when present', () => {
    const target = {
        gridX: 20,
        gridY: 21,
    };

    const requester = {
        gridX: 10,
        gridY: 11,
        target,
        hasTarget() {
            return true;
        },
    };

    const ignored = buildPathingIgnoreList(requester);
    expect(ignored).toEqual([requester, target]);
});
