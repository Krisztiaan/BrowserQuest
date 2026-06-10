import Camera from './camera';
import Item from './item';
import Character from './character';
import Player from './player';
import Timer from './timer';
import Detect from './platform/detect';
import Types from '../shared/gametypes-browser';
import log from './platform/log';
import { disableCanvasImageSmoothing, type PixelArtCanvasContext } from './canvas-smoothing';
import { classifyTileForOverlay, isDebugOverlayEnabled, OVERLAY_COLORS } from './debug-overlay';

type RendererContext2D = PixelArtCanvasContext;
type DrawScaledImageArg = number | RendererContext2D | CanvasImageSource;
type BoundingRect = {
    x: number;
    y: number;
    w: number;
    h: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
};
type RenderSprite = {
    image: CanvasImageSource;
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
    isLoaded?: boolean;
    animationData: Record<string, { length: number; row: number }>;
};
type RenderAnimation = {
    name: string;
    row: number;
    currentFrame: { x: number; y: number; index: number };
};
type RenderEntity = {
    id: string | number;
    x: number;
    y: number;
    kind: string | number;
    name?: string;
    nameOffsetY?: number;
    sprite?: RenderSprite | null;
    currentAnimation?: RenderAnimation | null;
    isLoaded?: boolean;
    isDirty?: boolean;
    oldDirtyRect?: BoundingRect | null;
    dirtyRect?: BoundingRect | null;
    isFading?: boolean;
    fadingAlpha?: number;
    shadowOffsetY?: number;
    flipSpriteX?: boolean;
    flipSpriteY?: boolean;
    hasShadow?(): boolean;
    isVisible?(): boolean;
};
type RenderAnimatedTile = {
    id: number;
    index: number;
    isDirty?: boolean;
    dirtyRect?: BoundingRect;
};
type BoundingEntity = {
    x: number;
    y: number;
    sprite?: { offsetX: number; offsetY: number; width: number; height: number } | null;
    hasWeapon?(): boolean;
    getWeaponName?(): string | null;
};
type RenderInfo = {
    opacity: number;
    value: string | number;
    x: number;
    y: number;
    fillColor?: string;
    strokeColor?: string;
};
type RendererGameLike = {
    map: {
        tilesets?: Array<HTMLImageElement | undefined>;
        width: number;
        tilesize: number;
        isAnimatedTile(id: number): boolean;
        isColliding(x: number, y: number): boolean;
        isDoor(x: number, y: number): boolean;
        isPlateau(x: number, y: number): boolean;
        isCheckpoint(x: number, y: number): boolean;
        renderProps?: Array<{
            depth: number;
            minTileX: number;
            minTileY: number;
            maxTileX: number;
            maxTileY: number;
            parts: Array<{ index: number; gid: number }>;
        }>;
    } | null;
    renderer?: Renderer;
    setSpriteScale(scale: number): void;
    getMouseGridPosition(): { x: number; y: number };
    kernel: { clientPathingGrid: number[][] | null };
    debugPathing: boolean;
    camera: Camera;
    cursors: Record<string, RenderSprite>;
    targetAnimation: RenderAnimation | null;
    selectedCellVisible: boolean;
    drawTarget: boolean;
    selectedX: number;
    selectedY: number;
    targetColor: string;
    mouse: { x: number; y: number };
    currentCursor: RenderSprite | null;
    shadows: Record<string, RenderSprite>;
    sprites: Record<string, RenderSprite>;
    sparksAnimation: RenderAnimation | null;
    forEachVisibleEntityByDepth(callback: (entity: RenderEntity) => void): void;
    forEachAnimatedTile(callback: (tile: RenderAnimatedTile) => void): void;
    clearTarget: boolean;
    playerId: string | number | null;
    forEachVisibleTile(callback: (id: number, index: number) => void, extra: number): void;
    forEachVisibleForegroundTile(callback: (id: number, index: number) => void, extra: number): void;
    infoManager: { forEachInfo(callback: (info: RenderInfo) => void): void };
    player: Player;
    started: boolean;
    currentTime: number;
    targetCellVisible: boolean;
};

type ViewportLike = Readonly<{
    innerWidth: number;
    innerHeight: number;
    visualViewport?: Readonly<{
        width: number;
        height: number;
    }> | null;
}>;

export function resolveViewportSize(viewport: ViewportLike): Readonly<{ width: number; height: number }> {
    const visualWidth = viewport.visualViewport?.width;
    const visualHeight = viewport.visualViewport?.height;
    const width = Number.isFinite(visualWidth) ? Number(visualWidth) : viewport.innerWidth;
    const height = Number.isFinite(visualHeight) ? Number(visualHeight) : viewport.innerHeight;

    return Object.freeze({
        width: Math.max(1, Math.floor(width)),
        height: Math.max(1, Math.floor(height)),
    });
}

class Renderer {
    game: RendererGameLike;
    context: RendererContext2D;
    background: RendererContext2D;
    foreground: RendererContext2D;
    canvas: HTMLCanvasElement;
    backcanvas: HTMLCanvasElement;
    forecanvas: HTMLCanvasElement;
    FPS = 50;
    tilesize: number;
    upscaledRendering: boolean;
    supportsSilhouettes: boolean;
    scale = 1;
    camera!: Camera;
    lastTime: Date;
    frameCount: number;
    maxFPS: number;
    realFPS: number;
    isDebugInfoVisible: boolean;
    animatedTileCount: number;
    foregroundTileCount: number;
    tablet = false;
    mobile = false;
    fixFlickeringTimer: Timer;
    tileset: HTMLImageElement | null;
    lastTargetPos: { x: number; y: number } | null;
    targetRect: BoundingRect | null;
    lastTerrainCameraX: number;
    lastTerrainCameraY: number;
    viewportWidth: number;
    viewportHeight: number;

    constructor(
        game: RendererGameLike,
        canvas: HTMLCanvasElement,
        background: HTMLCanvasElement,
        foreground: HTMLCanvasElement
    ) {
        this.game = game;
        this.context = canvas.getContext('2d') as RendererContext2D;
        this.background = background.getContext('2d') as RendererContext2D;
        this.foreground = foreground.getContext('2d') as RendererContext2D;
        this.canvas = canvas;
        this.backcanvas = background;
        this.forecanvas = foreground;
        this.viewportWidth = 1;
        this.viewportHeight = 1;

        this.initFPS();
        this.tilesize = 16;

        this.upscaledRendering = this.context.mozImageSmoothingEnabled !== undefined;
        this.supportsSilhouettes = this.upscaledRendering;

        this.rescale(this.getScaleFactor());

        this.lastTime = new Date();
        this.frameCount = 0;
        this.maxFPS = this.FPS;
        this.realFPS = 0;
        this.isDebugInfoVisible = false;

        this.animatedTileCount = 0;
        this.foregroundTileCount = 0;

        this.fixFlickeringTimer = new Timer(100);
        this.tileset = null;
        this.lastTargetPos = null;
        this.targetRect = null;
        this.lastTerrainCameraX = Number.NaN;
        this.lastTerrainCameraY = Number.NaN;
    }

    getWidth(): number {
        return this.viewportWidth;
    }

    getHeight(): number {
        return this.viewportHeight;
    }

    setTileset(tileset: HTMLImageElement | null | undefined): void {
        this.tileset = tileset ?? null;
    }

    getScaleFactor(): number {
        const w = window.innerWidth,
            h = window.innerHeight;
        let scale = 2;

        this.tablet = Detect.isTablet(w);
        this.mobile = Detect.isPhone() && !this.tablet;

        if (w > 1500 && h > 870) {
            scale = 3;
        } else {
            scale = 2;
        }

        return scale;
    }

    rescale(_factor: number): void {
        this.scale = this.getScaleFactor();

        this.createCamera();

        disableCanvasImageSmoothing(this.context);
        disableCanvasImageSmoothing(this.background);
        disableCanvasImageSmoothing(this.foreground);

        this.initFont();
        this.initFPS();

        const tilesets = this.game.map?.tilesets;
        if (!this.upscaledRendering && tilesets) {
            this.setTileset(tilesets[this.scale - 1]);
        }
        if (this.game.renderer) {
            this.game.setSpriteScale(this.scale);
        }
    }

    createCamera(): void {
        const viewport = resolveViewportSize(window);
        this.viewportWidth = viewport.width;
        this.viewportHeight = viewport.height;

        this.canvas.width = this.viewportWidth;
        this.canvas.height = this.viewportHeight;
        this.canvas.style.width = `${this.viewportWidth}px`;
        this.canvas.style.height = `${this.viewportHeight}px`;
        log.debug('#entities set to ' + this.canvas.width + ' x ' + this.canvas.height);

        this.backcanvas.width = this.viewportWidth;
        this.backcanvas.height = this.viewportHeight;
        this.backcanvas.style.width = `${this.viewportWidth}px`;
        this.backcanvas.style.height = `${this.viewportHeight}px`;
        log.debug('#background set to ' + this.backcanvas.width + ' x ' + this.backcanvas.height);

        this.forecanvas.width = this.viewportWidth;
        this.forecanvas.height = this.viewportHeight;
        this.forecanvas.style.width = `${this.viewportWidth}px`;
        this.forecanvas.style.height = `${this.viewportHeight}px`;
        log.debug('#foreground set to ' + this.forecanvas.width + ' x ' + this.forecanvas.height);

        this.camera = new Camera(this);

        this.lastTerrainCameraX = Number.NaN;
        this.lastTerrainCameraY = Number.NaN;
    }

    initFPS(): void {
        this.FPS = this.mobile ? 50 : 50;
    }

    initFont(): void {
        let fontsize = 10;

        switch (this.scale) {
            case 1:
                fontsize = 10;
                break;
            case 2:
                fontsize = Detect.isWindows() ? 10 : 13;
                break;
            case 3:
                fontsize = 20;
        }
        this.setFontSize(fontsize);
    }

    setFontSize(size: number): void {
        const font = size + 'px GraphicPixel';

        this.context.font = font;
        this.background.font = font;
    }

    drawText(
        text: string | number,
        x: number,
        y: number,
        centered: boolean,
        color?: string,
        strokeColor?: string
    ): void {
        const ctx = this.context;

        let strokeSize = 3;

        switch (this.scale) {
            case 1:
            case 2:
                strokeSize = 3;
                break;
            case 3:
                strokeSize = 5;
        }

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return;
        }
        const label = String(text);
        if (label.length === 0) {
            return;
        }
        ctx.save();
        if (centered) {
            ctx.textAlign = 'center';
        }
        ctx.strokeStyle = strokeColor ?? '#373737';
        ctx.lineWidth = strokeSize;
        ctx.strokeText(label, x, y);
        ctx.fillStyle = color ?? 'white';
        ctx.fillText(label, x, y);
        ctx.restore();
    }

    drawCellRect(x: number, y: number, color: string): void {
        this.context.save();
        this.context.lineWidth = 2 * this.scale;
        this.context.strokeStyle = color;
        this.context.translate(x + 2, y + 2);
        this.context.strokeRect(0, 0, this.tilesize * this.scale - 4, this.tilesize * this.scale - 4);
        this.context.restore();
    }

    drawCellHighlight(x: number, y: number, color: string): void {
        const s = this.scale,
            ts = this.tilesize,
            tx = x * ts * s,
            ty = y * ts * s;

        this.drawCellRect(tx, ty, color);
    }

    drawTargetCell(): void {
        const mouse = this.game.getMouseGridPosition();

        if (this.game.targetCellVisible && !(mouse.x === this.game.selectedX && mouse.y === this.game.selectedY)) {
            this.drawCellHighlight(mouse.x, mouse.y, this.game.targetColor);
        }
    }

    drawPathingCells(): void {
        const grid = this.game.kernel.clientPathingGrid;

        if (grid && this.game.debugPathing) {
            for (let y = 0; y < grid.length; y += 1) {
                const row = grid[y];
                if (!row) {
                    continue;
                }
                for (let x = 0; x < row.length; x += 1) {
                    if (row[x] === 1 && this.game.camera.isVisiblePosition(x, y)) {
                        this.drawCellHighlight(x, y, 'rgba(50, 50, 255, 0.5)');
                    }
                }
            }
        }
    }

    drawDebugOverlay(): void {
        if (!isDebugOverlayEnabled()) {
            return;
        }
        const map = this.game.map;
        if (!map) {
            return;
        }
        this.game.camera.forEachVisiblePosition((x, y) => {
            const tileClass = classifyTileForOverlay(map, x, y);
            this.drawCellHighlight(x, y, OVERLAY_COLORS[tileClass]);
        });
    }

    drawSelectedCell(): void {
        const sprite = this.game.cursors['target'],
            anim = this.game.targetAnimation,
            os = this.upscaledRendering ? 1 : this.scale,
            ds = this.upscaledRendering ? this.scale : 1;

        if (this.game.selectedCellVisible) {
            if (this.mobile || this.tablet) {
                if (this.game.drawTarget) {
                    const x = this.game.selectedX,
                        y = this.game.selectedY;

                    this.drawCellHighlight(this.game.selectedX, this.game.selectedY, 'rgb(51, 255, 0)');
                    this.lastTargetPos = { x: x, y: y };
                    this.game.drawTarget = false;
                }
            } else {
                if (sprite && anim) {
                    const frame = anim.currentFrame,
                        s = this.scale,
                        frameX = frame.x * os,
                        frameY = frame.y * os,
                        w = sprite.width * os,
                        h = sprite.height * os,
                        ts = 16,
                        dx = this.game.selectedX * ts * s,
                        dy = this.game.selectedY * ts * s,
                        dw = w * ds,
                        dh = h * ds;

                    this.context.save();
                    this.context.translate(dx, dy);
                    this.context.drawImage(sprite.image, frameX, frameY, w, h, 0, 0, dw, dh);
                    this.context.restore();
                }
            }
        }
    }

    clearScaledRect(ctx: RendererContext2D, x: number, y: number, w: number, h: number): void {
        const s = this.scale;

        ctx.clearRect(x * s, y * s, w * s, h * s);
    }

    drawCursor(): void {
        const mx = this.game.mouse.x,
            my = this.game.mouse.y,
            s = this.scale,
            os = this.upscaledRendering ? 1 : this.scale;

        this.context.save();
        if (this.game.currentCursor?.isLoaded) {
            this.context.drawImage(this.game.currentCursor.image, 0, 0, 14 * os, 14 * os, mx, my, 14 * s, 14 * s);
        }
        this.context.restore();
    }

    drawScaledImage(
        ctx: RendererContext2D,
        image: CanvasImageSource,
        x: number,
        y: number,
        w: number,
        h: number,
        dx: number,
        dy: number
    ): void {
        const s = this.upscaledRendering ? 1 : this.scale;
        Array.prototype.forEach.call(arguments, function (arg: DrawScaledImageArg) {
            const isInvalidNumber = typeof arg === 'number' && (Number.isNaN(arg) || arg < 0);
            if (isInvalidNumber) {
                log.error('x:' + x + ' y:' + y + ' w:' + w + ' h:' + h + ' dx:' + dx + ' dy:' + dy, true);
                throw Error('A problem occured when trying to draw on the canvas');
            }
        });

        ctx.drawImage(
            image,
            x * s,
            y * s,
            w * s,
            h * s,
            dx * this.scale,
            dy * this.scale,
            w * this.scale,
            h * this.scale
        );
    }

    drawTile(
        ctx: RendererContext2D,
        tileid: number,
        tileset: CanvasImageSource,
        setW: number,
        gridW: number,
        cellid: number
    ): void {
        const s = this.upscaledRendering ? 1 : this.scale;
        if (tileid !== -1) {
            // -1 when tile is empty in Tiled. Don't attempt to draw it.
            this.drawScaledImage(
                ctx,
                tileset,
                getX(tileid + 1, setW / s) * this.tilesize,
                Math.floor(tileid / (setW / s)) * this.tilesize,
                this.tilesize,
                this.tilesize,
                getX(cellid + 1, gridW) * this.tilesize,
                Math.floor(cellid / gridW) * this.tilesize
            );
        }
    }

    clearTile(ctx: RendererContext2D, gridW: number, cellid: number): void {
        const s = this.scale,
            ts = this.tilesize,
            x = getX(cellid + 1, gridW) * ts * s,
            y = Math.floor(cellid / gridW) * ts * s,
            w = ts * s,
            h = w;

        ctx.clearRect(x, y, h, w);
    }

    drawEntity(entity: RenderEntity): void {
        const sprite = entity.sprite,
            shadow = this.game.shadows['small'],
            anim = entity.currentAnimation,
            os = this.upscaledRendering ? 1 : this.scale,
            ds = this.upscaledRendering ? this.scale : 1;

        if (anim && sprite) {
            const frame = anim.currentFrame,
                s = this.scale,
                x = frame.x * os,
                y = frame.y * os,
                w = sprite.width * os,
                h = sprite.height * os,
                ox = sprite.offsetX * s,
                oy = sprite.offsetY * s,
                dx = entity.x * s,
                dy = entity.y * s,
                dw = w * ds,
                dh = h * ds;

            if (entity.isFading) {
                this.context.save();
                this.context.globalAlpha = entity.fadingAlpha ?? 1;
            }

            if (!this.mobile && !this.tablet) {
                this.drawEntityName(entity);
            }

            this.context.save();
            if (entity.flipSpriteX) {
                this.context.translate(dx + this.tilesize * s, dy);
                this.context.scale(-1, 1);
            } else if (entity.flipSpriteY) {
                this.context.translate(dx, dy + dh);
                this.context.scale(1, -1);
            } else {
                this.context.translate(dx, dy);
            }

            if (entity.isVisible?.()) {
                if (entity.hasShadow?.() && shadow) {
                    this.context.drawImage(
                        shadow.image,
                        0,
                        0,
                        shadow.width * os,
                        shadow.height * os,
                        0,
                        (entity.shadowOffsetY ?? 0) * ds,
                        shadow.width * os * ds,
                        shadow.height * os * ds
                    );
                }

                this.context.drawImage(sprite.image, x, y, w, h, ox, oy, dw, dh);

                if (entity instanceof Item && entity.kind !== Types.Entities.CAKE) {
                    const sparks = this.game.sprites['sparks'],
                        sparksAnim = this.game.sparksAnimation;
                    let sparkFrame = null;
                    let sx = 0;
                    let sy = 0;
                    let sw = 0;
                    let sh = 0;

                    if (sparks && sparksAnim) {
                        sparkFrame = sparksAnim.currentFrame;
                        sx = sparks.width * sparkFrame.index * os;
                        sy = sparks.height * sparksAnim.row * os;
                        sw = sparks.width * os;
                        sh = sparks.width * os;

                        this.context.drawImage(
                            sparks.image,
                            sx,
                            sy,
                            sw,
                            sh,
                            sparks.offsetX * s,
                            sparks.offsetY * s,
                            sw * ds,
                            sh * ds
                        );
                    }
                }
            }

            if (entity instanceof Character && !entity.isDead && entity.hasWeapon()) {
                const weaponName = entity.getWeaponName();
                if (typeof weaponName === 'string') {
                    const weapon = this.game.sprites[weaponName];
                    if (weapon) {
                        const weaponAnimData = weapon.animationData[anim.name];
                        if (weaponAnimData) {
                            const index =
                                    frame.index < weaponAnimData.length
                                        ? frame.index
                                        : frame.index % weaponAnimData.length,
                                wx = weapon.width * index * os,
                                wy = weapon.height * anim.row * os,
                                ww = weapon.width * os,
                                wh = weapon.height * os;

                            this.context.drawImage(
                                weapon.image,
                                wx,
                                wy,
                                ww,
                                wh,
                                weapon.offsetX * s,
                                weapon.offsetY * s,
                                ww * ds,
                                wh * ds
                            );
                        }
                    }
                }
            }

            this.context.restore();

            if (entity.isFading) {
                this.context.restore();
            }
        }
    }

    drawEntities(dirtyOnly = false): void {
        const self = this;

        this.game.forEachVisibleEntityByDepth(function (entity: RenderEntity) {
            if (entity.isLoaded) {
                if (dirtyOnly) {
                    if (entity.isDirty) {
                        self.drawEntity(entity);

                        entity.isDirty = false;
                        entity.oldDirtyRect = entity.dirtyRect;
                        entity.dirtyRect = null;
                    }
                } else {
                    self.drawEntity(entity);
                }
            }
        });
    }

    drawRenderProp(prop: { parts: Array<{ index: number; gid: number }> }): void {
        const map = this.game.map;
        const tileset = this.tileset;
        if (!map || !tileset) {
            return;
        }
        const tilesetwidth = tileset.width / map.tilesize;
        for (let i = 0; i < prop.parts.length; i += 1) {
            const part = prop.parts[i];
            if (!part) {
                continue;
            }
            this.drawTile(this.context, part.gid - 1, tileset, tilesetwidth, map.width, part.index);
        }
    }

    getVisibleDepthSortedProps(extra = 1): Array<{
        depth: number;
        minTileX: number;
        minTileY: number;
        maxTileX: number;
        maxTileY: number;
        parts: Array<{ index: number; gid: number }>;
    }> {
        const map = this.game.map;
        if (!map?.renderProps) {
            return [];
        }
        const minX = this.camera.gridX - extra;
        const minY = this.camera.gridY - extra;
        const maxX = this.camera.gridX + this.camera.gridW + extra;
        const maxY = this.camera.gridY + this.camera.gridH + extra;
        return map.renderProps.filter(
            (prop) => prop.maxTileX >= minX && prop.minTileX < maxX && prop.maxTileY >= minY && prop.minTileY < maxY
        );
    }

    drawDepthSortedEntitiesAndProps(): void {
        const map = this.game.map;
        if (!map) {
            return;
        }

        const visibleProps = this.getVisibleDepthSortedProps();
        const visibleEntities: RenderEntity[] = [];
        this.game.forEachVisibleEntityByDepth(function (entity: RenderEntity) {
            if (entity.isLoaded) {
                visibleEntities.push(entity);
            }
        });

        let propIndex = 0;
        for (let entityIndex = 0; entityIndex < visibleEntities.length; entityIndex += 1) {
            const entity = visibleEntities[entityIndex];
            if (!entity) {
                continue;
            }
            const entityDepth = Math.floor(entity.y / map.tilesize);
            while (propIndex < visibleProps.length) {
                const prop = visibleProps[propIndex];
                if (!prop || prop.depth > entityDepth) {
                    break;
                }
                this.drawRenderProp(prop);
                propIndex += 1;
            }
            this.drawEntity(entity);
        }

        while (propIndex < visibleProps.length) {
            const prop = visibleProps[propIndex];
            if (prop) {
                this.drawRenderProp(prop);
            }
            propIndex += 1;
        }
    }

    drawDirtyEntities(): void {
        this.drawEntities(true);
    }

    clearDirtyRect(r: BoundingRect | null | undefined): void {
        if (!r) {
            return;
        }
        this.context.clearRect(r.x, r.y, r.w, r.h);
    }

    clearDirtyRects(): void {
        const self = this;
        let count = 0;

        this.game.forEachVisibleEntityByDepth(function (entity: RenderEntity) {
            if (entity.isDirty && entity.oldDirtyRect) {
                self.clearDirtyRect(entity.oldDirtyRect);
                count += 1;
            }
        });

        this.game.forEachAnimatedTile(function (tile: RenderAnimatedTile) {
            if (tile.isDirty) {
                self.clearDirtyRect(tile.dirtyRect);
                count += 1;
            }
        });

        if (this.game.clearTarget && this.lastTargetPos) {
            const last = this.lastTargetPos,
                rect = this.getTargetBoundingRect(last.x, last.y);

            this.clearDirtyRect(rect);
            this.game.clearTarget = false;
            count += 1;
        }

        if (count > 0) {
            //log.debug("count:"+count);
        }
    }

    getEntityBoundingRect(entity: BoundingEntity): BoundingRect {
        const rect: BoundingRect = { x: 0, y: 0, w: 0, h: 0, left: 0, right: 0, top: 0, bottom: 0 },
            s = this.scale;
        let spr = entity.sprite;

        if (entity instanceof Player && entity.hasWeapon()) {
            const weaponName = entity.getWeaponName();
            if (typeof weaponName === 'string') {
                const weapon = this.game.sprites[weaponName];
                if (weapon) {
                    spr = weapon;
                }
            }
        }

        if (spr) {
            rect.x = (entity.x + spr.offsetX - this.camera.x) * s;
            rect.y = (entity.y + spr.offsetY - this.camera.y) * s;
            rect.w = spr.width * s;
            rect.h = spr.height * s;
            rect.left = rect.x;
            rect.right = rect.x + rect.w;
            rect.top = rect.y;
            rect.bottom = rect.y + rect.h;
        }
        return rect;
    }

    getTileBoundingRect(tile: RenderAnimatedTile): BoundingRect {
        const rect: BoundingRect = { x: 0, y: 0, w: 0, h: 0, left: 0, right: 0, top: 0, bottom: 0 };
        const map = this.game.map;
        if (!map) {
            return rect;
        }
        const gridW = map.width,
            s = this.scale,
            ts = this.tilesize,
            cellid = tile.index;

        rect.x = (getX(cellid + 1, gridW) * ts - this.camera.x) * s;
        rect.y = (Math.floor(cellid / gridW) * ts - this.camera.y) * s;
        rect.w = ts * s;
        rect.h = ts * s;
        rect.left = rect.x;
        rect.right = rect.x + rect.w;
        rect.top = rect.y;
        rect.bottom = rect.y + rect.h;

        return rect;
    }

    getTargetBoundingRect(x?: number, y?: number): BoundingRect {
        const rect: BoundingRect = { x: 0, y: 0, w: 0, h: 0, left: 0, right: 0, top: 0, bottom: 0 },
            s = this.scale,
            ts = this.tilesize,
            tx = x ?? this.game.selectedX,
            ty = y ?? this.game.selectedY;

        rect.x = (tx * ts - this.camera.x) * s;
        rect.y = (ty * ts - this.camera.y) * s;
        rect.w = ts * s;
        rect.h = ts * s;
        rect.left = rect.x;
        rect.right = rect.x + rect.w;
        rect.top = rect.y;
        rect.bottom = rect.y + rect.h;

        return rect;
    }

    isIntersecting(rect1: BoundingRect, rect2: BoundingRect): boolean {
        return !(
            rect2.left > rect1.right ||
            rect2.right < rect1.left ||
            rect2.top > rect1.bottom ||
            rect2.bottom < rect1.top
        );
    }

    drawEntityName(entity: RenderEntity): void {
        this.context.save();
        if (entity.name && entity instanceof Player) {
            const color = entity.id === this.game.playerId ? '#fcda5c' : 'white';
            this.drawText(
                entity.name,
                (entity.x + 8) * this.scale,
                (entity.y + entity.nameOffsetY) * this.scale,
                true,
                color
            );
        }
        this.context.restore();
    }

    drawTerrain(): void {
        const self = this;
        const m = this.game.map;
        if (!m) {
            return;
        }
        const tileset = this.tileset;
        if (!tileset) {
            return;
        }
        const tilesetwidth = tileset.width / m.tilesize;

        this.game.forEachVisibleTile(function (id: number, index: number) {
            // Keep a base terrain underlay even for animated ground tiles.
            // This prevents faint seams when animated frames contain transparent edge pixels.
            self.drawTile(self.background, id, tileset, tilesetwidth, m.width, index);
        }, 1);
    }

    drawAnimatedTiles(dirtyOnly = false): void {
        const self = this;
        const m = this.game.map;
        if (!m) {
            return;
        }
        const tileset = this.tileset;
        if (!tileset) {
            return;
        }
        const tilesetwidth = tileset.width / m.tilesize;

        this.animatedTileCount = 0;
        this.game.forEachAnimatedTile(function (tile: RenderAnimatedTile) {
            if (dirtyOnly) {
                if (tile.isDirty) {
                    self.drawTile(self.context, tile.id, tileset, tilesetwidth, m.width, tile.index);
                    tile.isDirty = false;
                }
            } else {
                self.drawTile(self.context, tile.id, tileset, tilesetwidth, m.width, tile.index);
                self.animatedTileCount += 1;
            }
        });
    }

    drawDirtyAnimatedTiles(): void {
        this.drawAnimatedTiles(true);
    }

    drawForegroundTiles(ctx: RendererContext2D): void {
        const self = this;
        const m = this.game.map;
        if (!m) {
            return;
        }
        const tileset = this.tileset;
        if (!tileset) {
            return;
        }
        const tilesetwidth = tileset.width / m.tilesize;

        this.foregroundTileCount = 0;
        this.game.forEachVisibleForegroundTile(function (id: number, index: number) {
            self.drawTile(ctx, id, tileset, tilesetwidth, m.width, index);
            self.foregroundTileCount += 1;
        }, 1);
    }

    drawBackground(ctx: RendererContext2D, color: string): void {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, this.getWidth(), this.getHeight());
    }

    drawFPS(): void {
        const nowTime = new Date(),
            diffTime = nowTime.getTime() - this.lastTime.getTime();

        if (diffTime >= 1000) {
            this.realFPS = this.frameCount;
            this.frameCount = 0;
            this.lastTime = nowTime;
        }
        this.frameCount++;

        //this.drawText("FPS: " + this.realFPS + " / " + this.maxFPS, 30, 30, false);
        this.drawText('FPS: ' + this.realFPS, 30, 30, false);
    }

    drawDebugInfo(): void {
        if (this.isDebugInfoVisible) {
            this.drawFPS();
            this.drawText('A: ' + this.animatedTileCount, 100, 30, false);
            this.drawText('F: ' + this.foregroundTileCount, 140, 30, false);
        }
    }

    drawCombatInfo(): void {
        const self = this;

        switch (this.scale) {
            case 2:
                this.setFontSize(20);
                break;
            case 3:
                this.setFontSize(30);
                break;
        }
        this.game.infoManager.forEachInfo(function (info: RenderInfo) {
            self.context.save();
            self.context.globalAlpha = info.opacity;
            self.drawText(
                info.value,
                (info.x + 8) * self.scale,
                Math.floor(info.y * self.scale),
                true,
                info.fillColor,
                info.strokeColor
            );
            self.context.restore();
        });
        this.initFont();
    }

    setCameraView(ctx: RendererContext2D): void {
        ctx.translate(-this.camera.x * this.scale, -this.camera.y * this.scale);
    }

    clearScreen(ctx: RendererContext2D): void {
        ctx.clearRect(0, 0, this.getWidth(), this.getHeight());
    }

    getPlayerImage(callback?: (imageDataUrl: string) => void): void {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        disableCanvasImageSmoothing(ctx);

        const os = this.upscaledRendering ? 1 : this.scale;
        const player = this.game.player;
        const sprite = player.getArmorSprite();
        const spriteAnim = sprite.animationData['idle_down'];
        if (!spriteAnim) {
            return;
        }

        const weaponName = player.getWeaponName();
        if (typeof weaponName !== 'string') {
            return;
        }
        const weapon = this.game.sprites[weaponName];
        const shadow = this.game.shadows['small'];
        if (!weapon || !shadow) {
            return;
        }

        // character
        const row = spriteAnim.row;
        const w = sprite.width * os;
        const h = sprite.height * os;
        const y = row * h;

        // weapon
        const ww = weapon.width * os;
        const wh = weapon.height * os;
        const wy = wh * row;
        const offsetX = (weapon.offsetX - sprite.offsetX) * os;
        const offsetY = (weapon.offsetY - sprite.offsetY) * os;

        // shadow
        const sw = shadow.width * os;
        const sh = shadow.height * os;
        const ox = -sprite.offsetX * os;
        const oy = -sprite.offsetY * os;

        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);

        ctx.drawImage(shadow.image, 0, 0, sw, sh, ox, oy, sw, sh);
        ctx.drawImage(sprite.image, 0, y, w, h, 0, 0, w, h);
        ctx.drawImage(weapon.image, 0, wy, ww, wh, offsetX, offsetY, ww, wh);

        callback?.(canvas.toDataURL('image/png'));
    }

    renderStaticCanvases(): void {
        this.redrawTerrainLayer(true);

        if (this.mobile || this.tablet) {
            this.clearScreen(this.foreground);
            this.foreground.save();
            this.setCameraView(this.foreground);
            this.drawForegroundTiles(this.foreground);
            this.foreground.restore();
        }
    }

    renderFrame(): void {
        if (this.mobile || this.tablet) {
            this.renderFrameMobile();
        } else {
            this.renderFrameDesktop();
        }
    }

    renderFrameDesktop(): void {
        this.redrawTerrainLayer(false);
        this.clearScreen(this.context);

        this.context.save();
        this.setCameraView(this.context);
        this.drawAnimatedTiles();

        if (this.game.started) {
            this.drawSelectedCell();
            this.drawTargetCell();
        }

        //this.drawOccupiedCells();
        this.drawPathingCells();
        this.drawDepthSortedEntitiesAndProps();
        this.drawCombatInfo();
        this.drawForegroundTiles(this.context);
        this.drawDebugOverlay();
        this.context.restore();

        // Overlay UI elements
        this.drawCursor();
        this.drawDebugInfo();
    }

    renderFrameMobile(): void {
        this.redrawTerrainLayer(false);
        this.clearDirtyRects();
        this.preventFlickeringBug();

        this.context.save();
        this.setCameraView(this.context);

        this.drawDirtyAnimatedTiles();
        this.drawSelectedCell();
        this.drawDepthSortedEntitiesAndProps();
        this.context.restore();
    }

    preventFlickeringBug(): void {
        if (this.fixFlickeringTimer.isOver(this.game.currentTime)) {
            this.background.fillRect(0, 0, 0, 0);
            this.context.fillRect(0, 0, 0, 0);
            this.foreground.fillRect(0, 0, 0, 0);
        }
    }

    redrawTerrainLayer(force: boolean): void {
        if (!force && this.lastTerrainCameraX === this.camera.x && this.lastTerrainCameraY === this.camera.y) {
            return;
        }

        this.drawBackground(this.background, '#000');
        this.background.save();
        this.setCameraView(this.background);
        this.drawTerrain();
        this.background.restore();

        this.lastTerrainCameraX = this.camera.x;
        this.lastTerrainCameraY = this.camera.y;
    }
}

const getX = function (id: number, w: number): number {
    if (id === 0) {
        return 0;
    }
    return id % w === 0 ? w - 1 : (id % w) - 1;
};

export default Renderer;
