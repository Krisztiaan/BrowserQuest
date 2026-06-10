import type { NpcDefinitions, NpcDialogueResult } from './shop-state';

function normalizeId(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function resolveNpcDialogue(npcDefinitions: NpcDefinitions, npcId: string): NpcDialogueResult {
    const normalizedNpcId = normalizeId(npcId);
    if (!normalizedNpcId) {
        return { accepted: false, reason: 'invalid_npc' };
    }
    const npc = npcDefinitions[normalizedNpcId];
    if (!npc) {
        return { accepted: false, reason: 'unknown_npc' };
    }
    const text = npc.dialogue[0];
    if (typeof text !== 'string' || text.trim().length === 0) {
        return { accepted: false, reason: 'missing_dialogue' };
    }
    return { accepted: true, npcId: normalizedNpcId, displayName: npc.displayName, text };
}
