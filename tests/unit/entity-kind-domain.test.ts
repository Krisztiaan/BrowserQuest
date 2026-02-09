import { expect, test } from 'bun:test';
import { ENTITY_KIND_DOMAIN } from '../../shared/js/entity-kind-domain';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Types = require('../../shared/js/gametypes');

test('entity kind domain stays aligned with shared runtime gametypes contract', () => {
    for (const [kindName, [kindId, category]] of Object.entries(ENTITY_KIND_DOMAIN)) {
        expect(Types.getKindFromString(kindName)).toBe(kindId);
        expect(Types.getKindAsString(kindId)).toBe(kindName);

        if (category === 'mob') {
            expect(Types.isMob(kindId)).toBe(true);
        } else if (category === 'npc') {
            expect(Types.isNpc(kindId)).toBe(true);
        } else if (category === 'player') {
            expect(Types.isPlayer(kindId)).toBe(true);
        } else if (category === 'weapon') {
            expect(Types.isWeapon(kindId)).toBe(true);
        } else if (category === 'armor') {
            expect(Types.isArmor(kindId)).toBe(true);
        } else if (category === 'object') {
            expect(Types.isObject(kindId)).toBe(true);
        }
    }
});
