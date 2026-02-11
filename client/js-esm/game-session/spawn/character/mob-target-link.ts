type SpawnedMobTarget = {
    id: string | number;
};

type SpawnCharacterMobTargetLinkHost<TMob extends SpawnedMobTarget, TTarget extends SpawnedMobTarget> = {
    mob: TMob | null;
    targetId: string | number | null | undefined;
    resolveTarget(targetId: string | number): TTarget | null;
    createAttackLink(attacker: TMob, target: TTarget): void;
};

export function installSpawnedMobTargetLink<TMob extends SpawnedMobTarget, TTarget extends SpawnedMobTarget>(
    host: SpawnCharacterMobTargetLinkHost<TMob, TTarget>
): void {
    if (!host.mob || !host.targetId) {
        return;
    }

    const target = host.resolveTarget(host.targetId);
    if (!target) {
        return;
    }

    host.createAttackLink(host.mob, target);
}
