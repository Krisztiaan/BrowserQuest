import type { Command } from '../../ecs/commands';
import type { DomainEvent } from '../../ecs/events';
import type { WorldState } from '../../ecs/world-state';
import { normalizeIdentityKeyList, resolveIdentityKey } from '../../identity';
import { CLAIMS_STORE_RESOURCE } from '../claims/claims-resource';
import type { RectClaim } from '../claims/claims-store';
import { canEditClaim, canManageClaim } from '../claims/permissions';
import type { PlayerLike } from '../player-like';

const CLAIM_COORD_ABS_MAX = 1_000_000;
const MAX_CLAIM_AREA_TILES = 64 * 64;

export type ClaimIntentWorldHost = Readonly<{
    isValidPosition(x: number, y: number): boolean;
    persistClaimUpsert?(claim: RectClaim): void;
    persistClaimDelete?(claimId: number): void;
}>;

export type ClaimIntentLimits = Readonly<{
    maxClaimsPerOwner: number;
    maxClaimEditors: number;
}>;

type ClaimIntentResult = { ok: false; reason: string } | { ok: true };

function resolveClaimBounds(x1: number, y1: number, x2: number, y2: number): { x1: number; y1: number; x2: number; y2: number } {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
}

function validateClaimBounds({
    world,
    x1,
    y1,
    x2,
    y2,
}: {
    world: ClaimIntentWorldHost;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}): { ok: true; bounds: { x1: number; y1: number; x2: number; y2: number } } | { ok: false; reason: string } {
    const bounds = resolveClaimBounds(x1, y1, x2, y2);
    if (
        Math.abs(bounds.x1) > CLAIM_COORD_ABS_MAX
        || Math.abs(bounds.y1) > CLAIM_COORD_ABS_MAX
        || Math.abs(bounds.x2) > CLAIM_COORD_ABS_MAX
        || Math.abs(bounds.y2) > CLAIM_COORD_ABS_MAX
    ) {
        return { ok: false, reason: 'CLAIM:coords_out_of_range' };
    }

    if (!world.isValidPosition(bounds.x1, bounds.y1) || !world.isValidPosition(bounds.x2, bounds.y2)) {
        return { ok: false, reason: 'CLAIM:out_of_bounds' };
    }

    const width = bounds.x2 - bounds.x1 + 1;
    const height = bounds.y2 - bounds.y1 + 1;
    const area = width * height;
    if (!Number.isSafeInteger(area) || area <= 0 || area > MAX_CLAIM_AREA_TILES) {
        return { ok: false, reason: 'CLAIM:area_too_large' };
    }

    return { ok: true, bounds };
}

function resolveActorNameKey(player: PlayerLike): string | null {
    return resolveIdentityKey(player);
}

function normalizeEditorNameKeys(
    rawEditorNameKeys: ReadonlyArray<string>,
    ownerNameKey: string,
    maxClaimEditors: number
): string[] {
    return normalizeIdentityKeyList(rawEditorNameKeys, { exclude: ownerNameKey, maxItems: maxClaimEditors });
}

export function applyClaimCreateIntent({
    state,
    world,
    player,
    cmd,
    limits,
}: {
    state: WorldState<Command, DomainEvent>;
    world: ClaimIntentWorldHost;
    player: PlayerLike;
    cmd: Extract<Command, { type: 'CLAIM_CREATE' }>;
    limits: ClaimIntentLimits;
}): ClaimIntentResult {
    const actorNameKey = resolveActorNameKey(player);
    if (!actorNameKey) {
        return { ok: false, reason: 'PERMISSION:identity_required' };
    }

    const claims = state.resources.require(CLAIMS_STORE_RESOURCE);
    if (claims.countClaimsByOwner(actorNameKey) >= limits.maxClaimsPerOwner) {
        return { ok: false, reason: 'CLAIM:owner_quota_exceeded' };
    }

    const boundsValidation = validateClaimBounds({
        world,
        x1: cmd.x1,
        y1: cmd.y1,
        x2: cmd.x2,
        y2: cmd.y2,
    });
    if (!boundsValidation.ok) {
        return { ok: false, reason: boundsValidation.reason };
    }
    const { bounds } = boundsValidation;

    const overlap = claims.findFirstOverlappingClaim(bounds);
    if (overlap) {
        return { ok: false, reason: 'CLAIM:overlap' };
    }

    const editorNameKeys = normalizeEditorNameKeys(cmd.editorNameKeys, actorNameKey, limits.maxClaimEditors);
    let claim: RectClaim;
    try {
        claim = claims.createClaim({
            ownerName: actorNameKey,
            editorNameKeys,
            x1: bounds.x1,
            y1: bounds.y1,
            x2: bounds.x2,
            y2: bounds.y2,
        });
    } catch (err) {
        return { ok: false, reason: `CLAIM:create_failed:${String(err)}` };
    }
    world.persistClaimUpsert?.(claim);
    return { ok: true };
}

export function applyClaimUpdateIntent({
    state,
    world,
    player,
    cmd,
    limits,
}: {
    state: WorldState<Command, DomainEvent>;
    world: ClaimIntentWorldHost;
    player: PlayerLike;
    cmd: Extract<Command, { type: 'CLAIM_UPDATE' }>;
    limits: ClaimIntentLimits;
}): ClaimIntentResult {
    const actorNameKey = resolveActorNameKey(player);
    if (!actorNameKey) {
        return { ok: false, reason: 'PERMISSION:identity_required' };
    }

    const claims = state.resources.require(CLAIMS_STORE_RESOURCE);
    const claim = claims.getClaimById(cmd.claimId);
    if (!claim) {
        return { ok: false, reason: 'CLAIM:not_found' };
    }

    const editDecision = canEditClaim({ actorName: actorNameKey, claim });
    if (!editDecision.ok) {
        return { ok: false, reason: `PERMISSION:${editDecision.code}` };
    }

    const boundsValidation = validateClaimBounds({
        world,
        x1: cmd.x1,
        y1: cmd.y1,
        x2: cmd.x2,
        y2: cmd.y2,
    });
    if (!boundsValidation.ok) {
        return { ok: false, reason: boundsValidation.reason };
    }
    const { bounds } = boundsValidation;

    const overlap = claims.findFirstOverlappingClaim({ ...bounds, excludeClaimId: claim.id });
    if (overlap) {
        return { ok: false, reason: 'CLAIM:overlap' };
    }

    const updates: {
        id: number;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        editorNameKeys?: ReadonlyArray<string>;
    } = {
        id: claim.id,
        x1: bounds.x1,
        y1: bounds.y1,
        x2: bounds.x2,
        y2: bounds.y2,
    };

    if (cmd.editorNameKeys !== undefined) {
        const ownerDecision = canManageClaim({ actorName: actorNameKey, claim });
        if (!ownerDecision.ok) {
            return { ok: false, reason: `PERMISSION:${ownerDecision.code}` };
        }
        updates.editorNameKeys = normalizeEditorNameKeys(cmd.editorNameKeys, claim.ownerName, limits.maxClaimEditors);
    }

    let updated: RectClaim | null;
    try {
        updated = claims.updateClaim(updates);
    } catch (err) {
        return { ok: false, reason: `CLAIM:update_failed:${String(err)}` };
    }
    if (!updated) {
        return { ok: false, reason: 'CLAIM:not_found' };
    }
    world.persistClaimUpsert?.(updated);
    return { ok: true };
}

export function applyClaimDeleteIntent({
    state,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    world: ClaimIntentWorldHost;
    player: PlayerLike;
    cmd: Extract<Command, { type: 'CLAIM_DELETE' }>;
}): ClaimIntentResult {
    const actorNameKey = resolveActorNameKey(player);
    if (!actorNameKey) {
        return { ok: false, reason: 'PERMISSION:identity_required' };
    }

    const claims = state.resources.require(CLAIMS_STORE_RESOURCE);
    const claim = claims.getClaimById(cmd.claimId);
    if (!claim) {
        return { ok: false, reason: 'CLAIM:not_found' };
    }

    const decision = canManageClaim({ actorName: actorNameKey, claim });
    if (!decision.ok) {
        return { ok: false, reason: `PERMISSION:${decision.code}` };
    }

    if (!claims.deleteClaim(claim.id)) {
        return { ok: false, reason: 'CLAIM:not_found' };
    }
    world.persistClaimDelete?.(claim.id);
    return { ok: true };
}

export type ClaimIntentConfig = Readonly<{
    maxClaimsPerOwner: number;
    maxClaimEditors: number;
}>;

export const DEFAULT_CLAIM_INTENT_CONFIG: ClaimIntentConfig = Object.freeze({
    maxClaimsPerOwner: 64,
    maxClaimEditors: 16,
});
