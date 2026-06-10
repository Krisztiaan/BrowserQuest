import { expect, test } from 'bun:test';
import Npc from '../../client/npc';
import { ClientWorldKernel } from '../../client/ecs/world-kernel';
import { runClientCommandApplySystem } from '../../client/ecs/systems/client-command-apply-system';
import { entityIdFromWire } from '../../shared/domain/ids';
import Types from '../../shared/gametypes-browser';
import { resolveNpcContentIdFromKind } from '../../shared/content/npc-content';

test('client NPC talk sends stable content id instead of runtime entity id', () => {
    const kernel = new ClientWorldKernel();
    const npcId = entityIdFromWire(5012);
    const npc = new Npc(npcId, Types.Entities.DESERTNPC);
    const sentNpcIds: string[] = [];

    kernel.enqueueClientCommand({ type: 'clientSendNpcTalk', npcId });

    const host = {
        kernel,
        started: true,
        client: {
            sendNpcTalk(npcContentId: string): void {
                sentNpcIds.push(npcContentId);
            },
        },
        entities: {
            [String(npcId)]: npc,
        },
        playerId: null,
        player: null,
    } as Parameters<typeof runClientCommandApplySystem>[0];

    runClientCommandApplySystem(host);

    expect(sentNpcIds).toEqual(['desertnpc']);
    expect(sentNpcIds).not.toContain(String(npcId));
});

test('NPC content id resolver only accepts NPC entity kinds', () => {
    expect(resolveNpcContentIdFromKind(Types.Entities.DESERTNPC)).toBe('desertnpc');
    expect(resolveNpcContentIdFromKind(Types.Entities.CHEST)).toBeNull();
});
