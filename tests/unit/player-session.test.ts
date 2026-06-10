import { expect, test } from 'bun:test';
import Types from '../../shared/gametypes-browser';
import { entityIdFromWire } from '../../shared/domain/ids';
import { HANDSHAKE_CONTROL } from '../../shared/connection-status';
import { attachWorldConnectionSession } from '../../server/player-session';
import type { ClientToServerProtocolAction } from '../../shared/protocol/types';
import type { Command } from '../../server/ecs/commands';
import type { PersistedPlayerProfile } from '../../server/player-persistence';

type SessionListener = (message: ClientToServerProtocolAction) => void;

function createSessionFixture({
    isActive,
    isDead,
    resolveHelloProfile,
    connectionAccountNameKey,
    enqueueCommandAccepted,
}: {
    isActive: boolean;
    isDead: boolean;
    resolveHelloProfile?: (params: {
        connectionId: string;
        requestedName: string;
        authenticatedAccountNameKey?: string;
    }) => {
        accepted: boolean;
        reason?: string;
        profile?: PersistedPlayerProfile;
    };
    connectionAccountNameKey?: string;
    enqueueCommandAccepted?: boolean | ((command: Command) => boolean);
}) {
    const sentUtf8: string[] = [];
    const closeReasons: string[] = [];
    const invalidReasons: string[] = [];
    const commands: Command[] = [];
    const releasedConnections: string[] = [];
    let listener: SessionListener | null = null;
    let onClose: (() => void) | null = null;

    const connection = {
        id: '5001',
        accountNameKey: connectionAccountNameKey,
        listen(callback: SessionListener): void {
            listener = callback;
        },
        onClose(callback: () => void): void {
            onClose = callback;
        },
        sendUTF8(payload: string): void {
            sentUtf8.push(payload);
        },
        close(reason?: string): void {
            closeReasons.push(reason ?? '');
        },
        closeInvalidPayload(reason: string): void {
            invalidReasons.push(reason);
        },
    };

    const world = {
        isPlayerActive(): boolean {
            return isActive;
        },
        enqueueCommand(command: Command): boolean {
            const accepted =
                typeof enqueueCommandAccepted === 'function' ? enqueueCommandAccepted(command) : enqueueCommandAccepted;
            if (accepted === false) {
                return false;
            }
            commands.push(command);
            return true;
        },
        getConnectionPlayerById() {
            return {
                isDead,
                emit(_eventName: 'exit') {},
            };
        },
        resolveHelloProfile,
        releaseSessionClaim(connectionId: string): void {
            releasedConnections.push(connectionId);
        },
    };

    attachWorldConnectionSession({
        connection,
        world,
        playerId: entityIdFromWire(5001),
    });

    return {
        sentUtf8,
        closeReasons,
        invalidReasons,
        commands,
        releasedConnections,
        send(message: ClientToServerProtocolAction): void {
            if (!listener) {
                throw new Error('session listener not attached');
            }
            listener(message);
        },
        close(): void {
            onClose?.();
        },
    };
}

test('player session allows HELLO re-handshake when active player is dead', () => {
    const fixture = createSessionFixture({ isActive: true, isDead: true });

    fixture.send([Types.Messages.HELLO, 'K', Types.Entities.CLOTHARMOR, Types.Entities.SWORD1]);

    expect(fixture.sentUtf8).toContain(HANDSHAKE_CONTROL.GO);
    expect(fixture.invalidReasons).toEqual([]);
    expect(fixture.closeReasons).toEqual([]);
    expect(fixture.commands.length).toBe(1);
    expect(fixture.commands[0]?.type).toBe('HELLO');
});

test('player session rejects duplicate HELLO when active player is alive', () => {
    const fixture = createSessionFixture({ isActive: true, isDead: false });

    fixture.send([Types.Messages.HELLO, 'K', Types.Entities.CLOTHARMOR, Types.Entities.SWORD1]);

    expect(fixture.invalidReasons.length).toBe(1);
    expect(fixture.invalidReasons[0]).toContain('Cannot initiate handshake twice');
    expect(fixture.commands.length).toBe(0);
});

test('player session rejects HELLO when world profile resolver denies duplicate active name', () => {
    const fixture = createSessionFixture({
        isActive: false,
        isDead: false,
        resolveHelloProfile() {
            return {
                accepted: false,
                reason: 'A player with this name is already connected.',
            };
        },
    });

    fixture.send([Types.Messages.HELLO, 'K', Types.Entities.CLOTHARMOR, Types.Entities.SWORD1]);

    expect(fixture.closeReasons).toContain('A player with this name is already connected.');
    expect(fixture.commands.length).toBe(0);
});

test('player session translates ACHIEVEMENT messages into ECS commands for active players', () => {
    const fixture = createSessionFixture({ isActive: true, isDead: false });

    fixture.send([Types.Messages.ACHIEVEMENT, 13]);

    expect(fixture.invalidReasons).toEqual([]);
    expect(fixture.commands.length).toBe(1);
    const command = fixture.commands[0];
    expect(command?.type).toBe('ACHIEVEMENT');
    if (command?.type === 'ACHIEVEMENT') {
        expect(command.achievementId).toBe(13);
    }
});

test('player session rejects legacy ATTACK opcode and does not enqueue command', () => {
    const fixture = createSessionFixture({ isActive: true, isDead: false });

    fixture.send([Types.Messages.ATTACK, 13]);

    expect(fixture.commands).toEqual([]);
    expect(fixture.invalidReasons).toContain('Legacy ATTACK opcode is unsupported. Use INTENT attack.entity.');
});

test('player session closes invalid payload when world backpressure rejects enqueue', () => {
    const fixture = createSessionFixture({ isActive: true, isDead: false, enqueueCommandAccepted: false });

    fixture.send([Types.Messages.ACHIEVEMENT, 13]);

    expect(fixture.commands).toEqual([]);
    expect(fixture.invalidReasons).toContain('Inbound command buffer saturated.');
});

test('player session enforces per-connection inbound message rate limit', () => {
    const originalDateNow = Date.now;
    let now = 1_000;
    Date.now = () => now;

    try {
        const fixture = createSessionFixture({ isActive: true, isDead: false });
        for (let i = 0; i < 120; i += 1) {
            fixture.send([Types.Messages.ACHIEVEMENT, 13]);
        }
        fixture.send([Types.Messages.ACHIEVEMENT, 13]);

        expect(fixture.commands.length).toBe(120);
        expect(fixture.invalidReasons).toContain('Inbound message rate limit exceeded.');

        now += 1000;
        fixture.send([Types.Messages.ACHIEVEMENT, 13]);
        expect(fixture.commands.length).toBe(121);
    } finally {
        Date.now = originalDateNow;
    }
});

test('player session enriches HELLO command with persisted profile payload when provided', () => {
    const fixture = createSessionFixture({
        isActive: false,
        isDead: false,
        resolveHelloProfile() {
            return {
                accepted: true,
                profile: {
                    accountNameKey: 'k',
                    nameKey: 'k',
                    displayName: 'K',
                    armorKind: Types.Entities.GOLDENARMOR,
                    weaponKind: Types.Entities.GOLDENSWORD,
                    checkpointId: 77,
                    achievements: {
                        unlockedIds: [1, 5],
                        ratCount: 2,
                        skeletonCount: 3,
                        totalKills: 4,
                        totalDmg: 5,
                        totalRevives: 1,
                    },
                    progression: {
                        gold: 0,
                        farmingLevel: 1,
                        farmingXp: 0,
                        homePlotClaimId: null,
                        inventory: [],
                    },
                },
            };
        },
    });

    fixture.send([Types.Messages.HELLO, 'K', Types.Entities.CLOTHARMOR, Types.Entities.SWORD1]);

    expect(fixture.commands.length).toBe(1);
    const command = fixture.commands[0];
    expect(command?.type).toBe('HELLO');
    if (command?.type === 'HELLO') {
        expect(command.profile?.armorKind).toBe(Types.Entities.GOLDENARMOR);
        expect(command.profile?.weaponKind).toBe(Types.Entities.GOLDENSWORD);
        expect(command.profile?.checkpointId).toBe(77);
        expect(command.profile?.achievements.unlockedIds).toEqual([1, 5]);
        expect(command.profile?.achievements.totalRevives).toBe(1);
    }
});

test('player session forwards authenticated account identity from connection to profile resolver', () => {
    const calls: Array<{ connectionId: string; requestedName: string; authenticatedAccountNameKey?: string }> = [];
    const fixture = createSessionFixture({
        isActive: false,
        isDead: false,
        connectionAccountNameKey: 'hero_account',
        resolveHelloProfile(params) {
            calls.push(params);
            return { accepted: true };
        },
    });

    fixture.send([Types.Messages.HELLO, 'Hero Display', Types.Entities.CLOTHARMOR, Types.Entities.SWORD1]);

    expect(calls).toEqual([
        {
            connectionId: '5001',
            requestedName: 'Hero Display',
            authenticatedAccountNameKey: 'hero_account',
        },
    ]);
});

test('player session releases name claim when socket closes', () => {
    const fixture = createSessionFixture({ isActive: false, isDead: false });
    fixture.close();
    expect(fixture.releasedConnections).toEqual(['5001']);
});

test('player session arms idle timeout immediately on attach', () => {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const scheduled: Array<{ delay: number }> = [];

    (globalThis as typeof globalThis & { setTimeout: typeof setTimeout }).setTimeout = ((handler, delay, ...args) => {
        void handler;
        void args;
        scheduled.push({ delay: Number(delay) });
        return 1 as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;
    (globalThis as typeof globalThis & { clearTimeout: typeof clearTimeout }).clearTimeout = ((
        _timer
    ) => {}) as typeof clearTimeout;

    try {
        createSessionFixture({ isActive: false, isDead: false });
        expect(scheduled.length).toBe(1);
        expect(scheduled[0]?.delay).toBe(1000 * 60 * 15);
    } finally {
        (globalThis as typeof globalThis & { setTimeout: typeof setTimeout }).setTimeout = originalSetTimeout;
        (globalThis as typeof globalThis & { clearTimeout: typeof clearTimeout }).clearTimeout = originalClearTimeout;
    }
});
