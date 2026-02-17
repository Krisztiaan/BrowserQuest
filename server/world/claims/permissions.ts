import type { RectClaim } from './claims-store';
import { normalizeIdentityKey } from '../../identity';

export type PermissionDecision = Readonly<
    | { ok: true }
    | { ok: false; code: 'claimed_no_access'; reason: string }
    | { ok: false; code: 'claimed_not_owner'; reason: string }
>;

export function canEditClaim({
    actorName,
    claim,
}: {
    actorName: string;
    claim: RectClaim | null;
}): PermissionDecision {
    if (!claim) {
        return { ok: true };
    }
    const actorNameKey = normalizeIdentityKey(actorName);
    if (!actorNameKey) {
        return { ok: false, code: 'claimed_no_access', reason: 'Actor identity is required.' };
    }
    if (claim.ownerName === actorNameKey) {
        return { ok: true };
    }
    if (claim.editorNameKeys.includes(actorNameKey)) {
        return { ok: true };
    }
    return { ok: false, code: 'claimed_no_access', reason: 'Tile is claimed and actor has no edit access.' };
}

export function canEditTile({
    actorName,
    claim,
}: {
    actorName: string;
    claim: RectClaim | null;
}): PermissionDecision {
    return canEditClaim({ actorName, claim });
}

export function canManageClaim({
    actorName,
    claim,
}: {
    actorName: string;
    claim: RectClaim | null;
}): PermissionDecision {
    if (!claim) {
        return { ok: false, code: 'claimed_not_owner', reason: 'Claim does not exist.' };
    }
    const actorNameKey = normalizeIdentityKey(actorName);
    if (!actorNameKey) {
        return { ok: false, code: 'claimed_not_owner', reason: 'Actor identity is required.' };
    }
    if (claim.ownerName === actorNameKey) {
        return { ok: true };
    }
    return { ok: false, code: 'claimed_not_owner', reason: 'Only claim owner can perform this operation.' };
}
