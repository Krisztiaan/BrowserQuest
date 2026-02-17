import { expect, test } from 'bun:test';
import { entityIdFromWire } from '../../shared/domain/ids';
import Warrior from '../../client/warrior';
import { ClientWorldKernel } from '../../client/ecs/world-kernel';
import { runClientCommandApplySystem } from '../../client/ecs/systems/client-command-apply-system';

test('setPlayerHealth(0) marks player dead and emits playerDeath once', () => {
    const kernel = new ClientWorldKernel();
    kernel.enqueueClientCommand({ type: 'setPlayerHealth', points: 0, isRegen: false });

    const player = new Warrior('player', 'K');
    player.setMaxHitPoints(100);
    player.hitPoints = 20;

    const emitted: string[] = [];
    const playedSounds: string[] = [];
    let stoppedCombat = 0;

    const host = {
        kernel,
        started: true,
        client: null,
        playerId: entityIdFromWire(5001),
        player,
        emit(eventName: string): void {
            emitted.push(eventName);
        },
        stopPlayerCombat(): void {
            stoppedCombat += 1;
        },
        setPlayerHealth(points: number): void {
            player.hitPoints = points;
        },
        updateBars(): void {},
        tryUnlockingAchievement(): void {},
        audioManager: {
            playSound(key: string): void {
                playedSounds.push(key);
            },
        },
        storage: {
            addDamage() {},
            applyAchievementProgressSnapshot() {},
            incrementTotalKills() {},
            incrementRatCount() {},
            incrementSkeletonCount() {},
            data: { achievements: { unlocked: [] } },
        },
        app: {
            initUnlockedAchievements() {},
        },
        infoManager: { addDamageInfo() {} },
        entities: {},
    } as Parameters<typeof runClientCommandApplySystem>[0];

    runClientCommandApplySystem(host);
    runClientCommandApplySystem(host);

    expect(player.hitPoints).toBe(0);
    expect(player.isDead).toBe(true);
    expect(stoppedCombat).toBe(1);
    expect(emitted.filter((name) => name === 'playerDeath').length).toBe(1);
    expect(playedSounds).toContain('death');
});
