import { Evented } from '../../shared/js/evented';

type DamageInfoType = 'received' | 'inflicted' | 'healed';

type DamageInfoColors = Record<DamageInfoType, { fill: string; stroke: string }>;

type InfoGame = {
    currentTime: number;
};

class InfoManager {
    game: InfoGame;
    infos: Record<string, DamageInfo>;
    destroyQueue: string[];

    constructor(game: InfoGame) {
        this.game = game;
        this.infos = {};
        this.destroyQueue = [];
    }

    addDamageInfo(value: number | string, x: number, y: number, type: DamageInfoType): void {
        const time = this.game.currentTime;
        const id = time + '' + String(value) + '' + x + '' + y;
        const info = new DamageInfo(id, value, x, y, DamageInfo.DURATION, type);
    
        info.onDestroy((destroyedId) => {
            this.destroyQueue.push(destroyedId);
        });
        this.infos[id] = info;
    }

    forEachInfo(callback: (info: DamageInfo) => void): void {
        Object.keys(this.infos).forEach((id) => {
            callback(this.infos[id]);
        }, this);
    }

    update(time: number): void {
        this.forEachInfo((info) => {
            info.update(time);
        });
    
        this.destroyQueue.forEach((id) => {
            delete this.infos[id];
        });
        this.destroyQueue = [];
    }
}


const damageInfoColors: DamageInfoColors = {
    "received": {
        fill: "rgb(255, 50, 50)",
        stroke: "rgb(255, 180, 180)"
    },
    "inflicted": {
        fill: "white",
        stroke: "#373737"
    },
    "healed": {
        fill: "rgb(80, 255, 80)",
        stroke: "rgb(50, 120, 50)"
    }
};


type DamageInfoEvents = {
    destroy: [id: string];
};

class DamageInfo extends Evented<DamageInfoEvents> {
    static DURATION = 1000;

    id: string;
    value: number | string;
    duration: number;
    x: number;
    y: number;
    opacity: number;
    lastTime: number;
    speed: number;
    fillColor: string;
    strokeColor: string;
    constructor(id: string, value: number | string, x: number, y: number, duration: number, type: DamageInfoType) {
        super();
        this.id = id;
        this.value = value;
        this.duration = duration;
        this.x = x;
        this.y = y;
        this.opacity = 1.0;
        this.lastTime = 0;
        this.speed = 100;
        this.fillColor = damageInfoColors[type].fill;
        this.strokeColor = damageInfoColors[type].stroke;
    }

    isTimeToAnimate(time: number): boolean {
        return (time - this.lastTime) > this.speed;
    }

    update(time: number): void {
        if (this.isTimeToAnimate(time)) {
            this.lastTime = time;
            this.tick();
        }
    }

    tick(): void {
        this.y -= 1;
        this.opacity -= 0.07;
        if (this.opacity < 0) {
            this.destroy();
        }
    }

    onDestroy(callback: (id: string) => void): void {
        this.on('destroy', callback);
    }

    destroy(): void {
        this.emit('destroy', this.id);
    }
}

export default InfoManager;
