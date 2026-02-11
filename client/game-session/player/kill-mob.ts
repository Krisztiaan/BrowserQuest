import type { EntityKind } from '../../../shared/entity-kind-domain';

type KillAchievement = 'HUNTER' | 'ANGRY_RATS' | 'SKULL_COLLECTOR' | 'HERO';

type PlayerKillMobHost = {
    kind: EntityKind;
    getMobName(kind: EntityKind): string;
    showNotification(message: string): void;
    incrementTotalKills(): void;
    unlockAchievement(id: KillAchievement): void;
    isRat(kind: EntityKind): boolean;
    isSkeleton(kind: EntityKind): boolean;
    isBoss(kind: EntityKind): boolean;
    incrementRatCount(): void;
    incrementSkeletonCount(): void;
};

function normalizeMobName(mobName: string): string {
    if (mobName === 'skeleton2') {
        return 'greater skeleton';
    }

    if (mobName === 'eye') {
        return 'evil eye';
    }

    if (mobName === 'deathknight') {
        return 'death knight';
    }

    return mobName;
}

function showKillNotification(host: PlayerKillMobHost, mobName: string): void {
    if (mobName === 'boss') {
        host.showNotification('You killed the skeleton king');
        return;
    }

    if (['a', 'e', 'i', 'o', 'u'].includes(mobName[0])) {
        host.showNotification('You killed an ' + mobName);
        return;
    }

    host.showNotification('You killed a ' + mobName);
}

export function handlePlayerKillMob(host: PlayerKillMobHost): void {
    const mobName = normalizeMobName(host.getMobName(host.kind));
    showKillNotification(host, mobName);

    host.incrementTotalKills();
    host.unlockAchievement('HUNTER');

    if (host.isRat(host.kind)) {
        host.incrementRatCount();
        host.unlockAchievement('ANGRY_RATS');
    }

    if (host.isSkeleton(host.kind)) {
        host.incrementSkeletonCount();
        host.unlockAchievement('SKULL_COLLECTOR');
    }

    if (host.isBoss(host.kind)) {
        host.unlockAchievement('HERO');
    }
}
