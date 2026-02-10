type DamagedMob = {
    x: number;
    y: number;
};

type PlayerDamageMobHost<TMob extends DamagedMob> = {
    mob: TMob | null;
    points: number;
    addDamageInfo(points: number, x: number, y: number, kind: 'inflicted'): void;
};

export function handlePlayerDamageMob<TMob extends DamagedMob>(host: PlayerDamageMobHost<TMob>): void {
    if (!host.mob || !host.points) {
        return;
    }

    host.addDamageInfo(host.points, host.mob.x, host.mob.y - 15, 'inflicted');
}
