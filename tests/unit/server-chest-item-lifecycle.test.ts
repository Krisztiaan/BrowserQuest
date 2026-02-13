import { expect, test } from 'bun:test';
import { entityIdFromWire } from '../../shared/domain/ids';
import { spawnStaticEntitiesForWorld } from '../../server/world/chest-item-lifecycle';

type RespawnableMob = {
    id: number;
    isDead: boolean;
    x: number;
    y: number;
    spawningX: number;
    spawningY: number;
    hitPoints: number;
    on(eventName: 'respawn', callback: () => void): void;
    setPosition(x: number, y: number): void;
    updateHitPoints(): void;
    __emitRespawn(): void;
};

function createMobFixture(id: number, x: number, y: number): RespawnableMob {
    let respawnHandler: (() => void) | null = null;

    return {
        id,
        isDead: false,
        x,
        y,
        spawningX: x,
        spawningY: y,
        hitPoints: 100,
        on(eventName, callback) {
            if (eventName === 'respawn') {
                respawnHandler = callback;
            }
        },
        setPosition(nextX, nextY) {
            this.x = nextX;
            this.y = nextY;
        },
        updateHitPoints() {
            this.hitPoints = 100;
        },
        __emitRespawn() {
            if (respawnHandler) {
                respawnHandler();
            }
        },
    };
}

test('static mob respawn resets HP and spawn position before re-adding', () => {
    const addedMobs: RespawnableMob[] = [];
    const mobsById = new Map<number, RespawnableMob>();

    spawnStaticEntitiesForWorld({
        staticEntities: { '1305': 'rat' },
        resolveKindFromString: () => 2,
        tileIndexToGridPosition: () => ({ x: 10, y: 20 }),
        isNpcKind: () => false,
        isMobKind: () => true,
        isItemKind: () => false,
        addNpc() {},
        createMob(id, _kind, x, y) {
            const mob = createMobFixture(id, x, y);
            mobsById.set(id, mob);
            return mob;
        },
        addMob(mob) {
            addedMobs.push(mob as RespawnableMob);
        },
        isChestArea: () => false,
        addMobToContainingChestArea() {},
        createItem() {
            return null;
        },
        addStaticItem() {},
    });

    const mobId = entityIdFromWire(720);
    const mob = mobsById.get(mobId);
    expect(mob).toBeDefined();
    expect(addedMobs.length).toBe(1);

    if (!mob) {
        return;
    }

    mob.isDead = true;
    mob.hitPoints = 0;
    mob.setPosition(99, 77);
    mob.__emitRespawn();

    expect(mob.isDead).toBe(false);
    expect(mob.hitPoints).toBe(100);
    expect(mob.x).toBe(11);
    expect(mob.y).toBe(20);
    expect(addedMobs.length).toBe(2);
});
