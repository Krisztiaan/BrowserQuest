import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { mapDomainEventToProtocolAction } from '../../../server/ecs/command-systems';

test('ENTITY_ATTACKED broadcasts ATTACK to nearby players including the attacker client', () => {
    const attackerId = entityIdFromWire(500000000);
    const targetId = entityIdFromWire(44);

    const messages = mapDomainEventToProtocolAction({
        type: 'ENTITY_ATTACKED',
        attackerId,
        targetId,
    });

    expect(messages).toEqual([
        {
            kind: 'broadcast_nearby',
            actorId: attackerId,
            action: [Types.Messages.ATTACK, attackerId, targetId],
        },
    ]);
});
