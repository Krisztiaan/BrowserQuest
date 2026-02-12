import Animation from './animation';
import sprites from './sprites';
import type { SpriteJson } from './sprites';
import log from './platform/log';
import { resolveImageAssetPath } from './image-assets';

type SpriteRenderData = {
    image: CanvasImageSource;
    isLoaded: boolean;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
};

class Sprite {
    name: string;
    scale: number;
    isLoaded: boolean;
    offsetX: number;
    offsetY: number;
    onload_func: (() => void) | null;

    id: string;
    filepath: string;
    animationData: SpriteJson['animations'];
    width: number;
    height: number;

    image: HTMLImageElement;
    whiteSprite: SpriteRenderData | undefined;
    silhouetteSprite: SpriteRenderData | Sprite;
    private loadTimeout: ReturnType<typeof setTimeout> | null;

    constructor(name: string, scale: number) {
        this.name = name;
        this.scale = scale;
        this.isLoaded = false;
        this.offsetX = 0;
        this.offsetY = 0;
        this.onload_func = null;

        this.id = '';
        this.filepath = '';
        this.animationData = {};
        this.width = 0;
        this.height = 0;

        this.image = new Image();
        this.silhouetteSprite = this;
        this.loadTimeout = null;

        const spriteData = sprites[name];
        if (!spriteData) {
            throw new Error('Unknown sprite: ' + name);
        }
        this.loadJSON(spriteData);
    }

    loadJSON(data: SpriteJson): void {
        this.id = data.id;
        this.filepath = resolveImageAssetPath(this.scale, this.id);
        this.animationData = data.animations;
        this.width = data.width;
        this.height = data.height;
        this.offsetX = data.offset_x ?? -16;
        this.offsetY = data.offset_y ?? -16;

        this.load();
    }

    load(): void {
        this.image = new Image();
        this.image.crossOrigin = 'Anonymous';
        this.image.src = this.filepath;

        const finalize = (result: 'loaded' | 'error' | 'timeout'): void => {
            if (this.isLoaded) {
                return;
            }
            if (this.loadTimeout) {
                clearTimeout(this.loadTimeout);
                this.loadTimeout = null;
            }

            if (result !== 'loaded') {
                // Ensure rendering doesn't crash on broken images by substituting a 1x1 transparent PNG.
                log.error(`Failed to load sprite asset (${result}): ${this.filepath}`);
                this.image.src =
                    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0f1eQAAAAASUVORK5CYII=';
            }

            this.isLoaded = true;
            this.onload_func?.();
        };

        this.image.onload = () => finalize('loaded');
        this.image.onerror = () => finalize('error');
        this.loadTimeout = setTimeout(() => finalize('timeout'), 15_000);
    }

    createAnimations(): Record<string, Animation> {
        const animations: Record<string, Animation> = {};

        for (const name in this.animationData) {
            const animation = this.animationData[name];
            animations[name] = new Animation(name, animation.length, animation.row, this.width, this.height);
        }

        return animations;
    }

    createHurtSprite(): void {
        if (!this.isLoaded || !this.image.complete || this.image.naturalWidth === 0) {
            return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const width = this.image.width;
        const height = this.image.height;

        if (!ctx) {
            return;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(this.image, 0, 0, width, height);

        // Avoid `getImageData` (tainted canvas in some browsers, and unnecessary).
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = 'rgb(255, 75, 75)';
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';

        this.whiteSprite = {
            image: canvas,
            isLoaded: true,
            offsetX: this.offsetX,
            offsetY: this.offsetY,
            width: this.width,
            height: this.height,
        };
    }

    getHurtSprite(): SpriteRenderData | undefined {
        return this.whiteSprite;
    }

    createSilhouette(): void {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const width = this.image.width;
        const height = this.image.height;

        if (!ctx) {
            this.silhouetteSprite = this;
            return;
        }

        canvas.width = width;
        canvas.height = height;

        try {
            ctx.drawImage(this.image, 0, 0, width, height);
            const data = ctx.getImageData(0, 0, width, height).data;
            const finalData = ctx.getImageData(0, 0, width, height);
            const fdata = finalData.data;

            const getIndex = function (x: number, y: number): number {
                return ((width * (y - 1)) + x - 1) * 4;
            };

            const getPosition = function (i: number): { x: number; y: number } {
                const idx = (i / 4) + 1;
                const x = idx % width;
                const y = ((idx - x) / width) + 1;
                return { x, y };
            };

            const isBlankPixel = function (i: number): boolean {
                if (i < 0 || i >= data.length) {
                    return true;
                }
                return data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 0;
            };

            const hasAdjacentPixel = function (i: number): boolean {
                const pos = getPosition(i);

                if (pos.x < width && !isBlankPixel(getIndex(pos.x + 1, pos.y))) {
                    return true;
                }
                if (pos.x > 1 && !isBlankPixel(getIndex(pos.x - 1, pos.y))) {
                    return true;
                }
                if (pos.y < height && !isBlankPixel(getIndex(pos.x, pos.y + 1))) {
                    return true;
                }
                if (pos.y > 1 && !isBlankPixel(getIndex(pos.x, pos.y - 1))) {
                    return true;
                }
                return false;
            };

            for (let i = 0; i < data.length; i += 4) {
                if (isBlankPixel(i) && hasAdjacentPixel(i)) {
                    fdata[i] = fdata[i + 1] = 255;
                    fdata[i + 2] = 150;
                    fdata[i + 3] = 150;
                }
            }
            ctx.putImageData(finalData, 0, 0);

            this.silhouetteSprite = {
                image: canvas,
                isLoaded: true,
                offsetX: this.offsetX,
                offsetY: this.offsetY,
                width: this.width,
                height: this.height,
            };
        } catch (_e) {
            this.silhouetteSprite = this;
        }
    }
}

export type { SpriteRenderData };
export default Sprite;
