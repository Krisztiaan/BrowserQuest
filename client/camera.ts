import log from './platform/log';

type CameraRenderer = {
    mobile: boolean;
    tablet: boolean;
    tilesize: number;
    scale: number;
};

type CameraEntity = {
    x: number;
    y: number;
    gridX: number;
    gridY: number;
};

class Camera {
    renderer: CameraRenderer;
    x: number;
    y: number;
    gridX: number;
    gridY: number;
    offset: number;
    gridW: number;
    gridH: number;

    constructor(renderer: CameraRenderer) {
        this.renderer = renderer;
        this.x = 0;
        this.y = 0;
        this.gridX = 0;
        this.gridY = 0;
        this.offset = 0.5;
        this.gridW = 0;
        this.gridH = 0;
        this.rescale();
    }

    rescale(): void {
        const renderer = this.renderer;
        const isPhone = renderer.mobile && !renderer.tablet;

        if (isPhone) {
            const tilePx = renderer.tilesize * renderer.scale;
            const viewportW = window.innerWidth;
            const viewportH = window.innerHeight;

            const gridW = Math.floor(viewportW / tilePx);
            const gridH = Math.floor(viewportH / tilePx);

            this.gridW = Math.max(9, Math.min(29, gridW));
            this.gridH = Math.max(7, Math.min(29, gridH));
        } else {
            const factor = 2;
            this.gridW = 15 * factor;
            this.gridH = 7 * factor;
        }

        log.debug('---------');
        log.debug('Phone:' + isPhone);
        log.debug('W:' + this.gridW + ' H:' + this.gridH);
    }

    setPosition(x: number, y: number): void {
        this.x = x;
        this.y = y;

        this.gridX = Math.floor(x / 16);
        this.gridY = Math.floor(y / 16);
    }

    setGridPosition(x: number, y: number): void {
        this.gridX = x;
        this.gridY = y;

        this.x = this.gridX * 16;
        this.y = this.gridY * 16;
    }

    lookAt(entity: CameraEntity): void {
        const r = this.renderer;
        const x = Math.round(entity.x - (Math.floor(this.gridW / 2) * r.tilesize));
        const y = Math.round(entity.y - (Math.floor(this.gridH / 2) * r.tilesize));

        this.setPosition(x, y);
    }

    forEachVisiblePosition(callback: (x: number, y: number) => void, extra?: number): void {
        const extraRange = extra ?? 0;
        for (let y = this.gridY - extraRange, maxY = this.gridY + this.gridH + (extraRange * 2); y < maxY; y += 1) {
            for (let x = this.gridX - extraRange, maxX = this.gridX + this.gridW + (extraRange * 2); x < maxX; x += 1) {
                callback(x, y);
            }
        }
    }

    isVisible(entity: CameraEntity): boolean {
        return this.isVisiblePosition(entity.gridX, entity.gridY);
    }

    isVisiblePosition(x: number, y: number): boolean {
        if (
            y >= this.gridY
            && y < this.gridY + this.gridH
            && x >= this.gridX
            && x < this.gridX + this.gridW
        ) {
            return true;
        }
        return false;
    }

    focusEntity(entity: CameraEntity): void {
        const w = this.gridW - 2;
        const h = this.gridH - 2;
        const x = Math.floor((entity.gridX - 1) / w) * w;
        const y = Math.floor((entity.gridY - 1) / h) * h;

        this.setGridPosition(Math.max(0, x), Math.max(0, y));
    }
}

export default Camera;
