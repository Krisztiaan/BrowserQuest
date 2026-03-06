import { expect, test } from 'bun:test';
import Character from '../../../client/character';
import Mob from '../../../client/mob';
import {
    runClientSimulationSystem,
    type ClientSimulationSystemHost,
} from '../../../client/ecs/systems/client-simulation-system';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { setEntityGrid } from '../../support/mmo/client-gameplay';

function createHost({
    player,
    entities,
    enqueue,
}: {
    player: Character;
    entities: Array<Character | Mob>;
    enqueue: (command: { type: 'clientSendAggro'; mobId: number }) => void;
}): ClientSimulationSystemHost {
    return {
        started: true,
        currentTime: 1_000,
        playerAggroTimer: {
            isOver() {
                return true;
            },
        },
        player,
        playerId: typeof player.id === 'number' ? entityIdFromWire(player.id) : null,
        kernel: {
            enqueueClientCommand(command) {
                enqueue(command as { type: 'clientSendAggro'; mobId: number });
            },
        },
        renderer: null,
        camera: {
            x: 0,
            y: 0,
            gridW: 30,
            gridH: 20,
            setPosition() {},
        },
        currentZoning: null,
        zoningOrientation: null,
        sparksAnimation: null,
        targetAnimation: null,
        bubbleManager: null,
        infoManager: {
            update() {},
        },
        forEachEntity(callback) {
            for (const entity of entities) {
                callback(entity);
            }
        },
        initAnimatedTiles() {},
        endZoning() {},
        forEachAnimatedTile() {},
        checkOtherDirtyRects() {},
    };
}

test('client simulation auto-aggro enqueues AGGRO for nearby aggressive mobs while idle', () => {
    const player = new Character('player', Types.Entities.WARRIOR);
    setEntityGrid(player, 10, 10);

    const mob = new Mob(entityIdFromWire(1200), Types.Entities.SKELETON);
    setEntityGrid(mob, 11, 10);

    const commands: Array<{ type: 'clientSendAggro'; mobId: number }> = [];
    const host = createHost({
        player,
        entities: [player, mob],
        enqueue(command) {
            commands.push(command);
        },
    });

    runClientSimulationSystem(host);

    expect(commands).toContainEqual({ type: 'clientSendAggro', mobId: mob.id as number });
    expect(mob.isWaitingToAttack(player)).toBe(true);
});

test('client simulation auto-aggro is idempotent for the same mob target', () => {
    const player = new Character('player', Types.Entities.WARRIOR);
    setEntityGrid(player, 12, 10);

    const mob = new Mob(entityIdFromWire(1201), Types.Entities.SKELETON);
    setEntityGrid(mob, 13, 10);

    const commands: Array<{ type: 'clientSendAggro'; mobId: number }> = [];
    const host = createHost({
        player,
        entities: [player, mob],
        enqueue(command) {
            commands.push(command);
        },
    });

    runClientSimulationSystem(host);
    runClientSimulationSystem(host);

    expect(commands).toEqual([{ type: 'clientSendAggro', mobId: mob.id as number }]);
});
