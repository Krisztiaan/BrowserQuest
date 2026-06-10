import Types from '../../shared/gametypes-browser';
import sprites from '../sprites';

type SpriteSpec = {
    width: number;
    height: number;
    offset_x?: number;
    offset_y?: number;
    animations?: Record<string, { row: number; length: number }>;
};
type PreviewPayload = {
    armorSpriteName?: string;
    weaponSpriteName?: string;
};
type PreviewPayloadSource = {
    armorSpriteName?: string;
    weaponSpriteName?: string;
};
type PreviewRuntime = {
    armorSpec: SpriteSpec;
    weaponSpec: SpriteSpec;
    shadowSpec: SpriteSpec;
    armorImage: HTMLImageElement;
    weaponImage: HTMLImageElement;
    shadowImage: HTMLImageElement;
    armorIdleRow: number;
    weaponIdleRow: number;
    frameCount: number;
};

const SERVER_PLAYER_PREVIEW_JSON_URL = '/profile/preview.json';
const DEFAULT_ARMOR_SPRITE = 'clotharmor';
const DEFAULT_WEAPON_SPRITE = 'sword1';
const SHADOW_SPRITE = 'shadow16';
const IDLE_ANIMATION_INTERVAL_MS = 260;

type PreviewController = {
    start: () => void;
    stop: () => void;
    dispose: () => void;
};

const getSpriteSpec = function (spriteName: string): SpriteSpec | null {
    const spriteSpec = sprites[spriteName];
    if (!spriteSpec) {
        return null;
    }
    if (!Number.isFinite(spriteSpec.width) || !Number.isFinite(spriteSpec.height)) {
        return null;
    }
    return spriteSpec;
};

const getSpriteOffset = function (spriteSpec: SpriteSpec): { x: number; y: number } {
    return {
        x: Number.isFinite(spriteSpec.offset_x) ? Number(spriteSpec.offset_x) : -16,
        y: Number.isFinite(spriteSpec.offset_y) ? Number(spriteSpec.offset_y) : -16,
    };
};

const getIdleDownRow = function (spriteSpec: SpriteSpec): number {
    const row = spriteSpec.animations?.idle_down?.row;
    if (typeof row !== 'number' || !Number.isFinite(row)) {
        return 0;
    }
    return Math.max(0, row);
};

const getIdleDownLength = function (spriteSpec: SpriteSpec): number {
    const length = spriteSpec.animations?.idle_down?.length;
    if (typeof length !== 'number' || !Number.isFinite(length)) {
        return 1;
    }
    return Math.max(1, Math.trunc(length));
};

const loadImageAsset = function (src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', function () {
            resolve(image);
        });
        image.addEventListener('error', function () {
            reject(new Error(`Failed to load image asset: ${src}`));
        });
        image.src = src;
    });
};

const parsePreviewPayload = function (value: unknown): PreviewPayload {
    if (!value || typeof value !== 'object') {
        return {};
    }
    const record = value as PreviewPayloadSource;
    return {
        armorSpriteName: typeof record.armorSpriteName === 'string' ? record.armorSpriteName : undefined,
        weaponSpriteName: typeof record.weaponSpriteName === 'string' ? record.weaponSpriteName : undefined,
    };
};

const resolveArmorSpriteName = function (raw: string | undefined): string {
    if (typeof raw !== 'string') {
        return DEFAULT_ARMOR_SPRITE;
    }
    const kind = Types.getKindFromString(raw);
    if (typeof kind !== 'number' || !Types.isArmor(kind)) {
        return DEFAULT_ARMOR_SPRITE;
    }
    return raw;
};

const resolveWeaponSpriteName = function (raw: string | undefined): string {
    if (typeof raw !== 'string') {
        return DEFAULT_WEAPON_SPRITE;
    }
    const kind = Types.getKindFromString(raw);
    if (typeof kind !== 'number' || !Types.isWeapon(kind)) {
        return DEFAULT_WEAPON_SPRITE;
    }
    return raw;
};

const loadLoadCharacterPreviewRuntime = async function (): Promise<PreviewRuntime | null> {
    const payload: PreviewPayload = {};
    try {
        const response = await fetch(SERVER_PLAYER_PREVIEW_JSON_URL, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
        });
        if (response.ok) {
            const payloadJson: unknown = await response.json();
            const parsed = parsePreviewPayload(payloadJson);
            payload.armorSpriteName = parsed.armorSpriteName;
            payload.weaponSpriteName = parsed.weaponSpriteName;
        }
    } catch {
        // use defaults
    }

    const armorSpriteName = resolveArmorSpriteName(payload.armorSpriteName);
    const weaponSpriteName = resolveWeaponSpriteName(payload.weaponSpriteName);

    const armorSpec = getSpriteSpec(armorSpriteName) ?? getSpriteSpec(DEFAULT_ARMOR_SPRITE);
    const weaponSpec = getSpriteSpec(weaponSpriteName) ?? getSpriteSpec(DEFAULT_WEAPON_SPRITE);
    const shadowSpec = getSpriteSpec(SHADOW_SPRITE);
    if (!armorSpec || !weaponSpec || !shadowSpec) {
        return null;
    }

    let shadowImage: HTMLImageElement;
    let armorImage: HTMLImageElement;
    let weaponImage: HTMLImageElement;
    try {
        [shadowImage, armorImage, weaponImage] = await Promise.all([
            loadImageAsset(`/img/1/${SHADOW_SPRITE}.webp`),
            loadImageAsset(`/img/1/${encodeURIComponent(armorSpriteName)}.webp`),
            loadImageAsset(`/img/1/${encodeURIComponent(weaponSpriteName)}.webp`),
        ]);
    } catch {
        return null;
    }

    return {
        armorSpec,
        weaponSpec,
        shadowSpec,
        armorImage,
        weaponImage,
        shadowImage,
        armorIdleRow: getIdleDownRow(armorSpec),
        weaponIdleRow: getIdleDownRow(weaponSpec),
        frameCount: Math.max(getIdleDownLength(armorSpec), getIdleDownLength(weaponSpec)),
    };
};

export const hydrateLoadCharacterPreview = function (previewCanvas: HTMLCanvasElement): void {
    const context = previewCanvas.getContext('2d');
    if (!context) {
        return;
    }
    context.imageSmoothingEnabled = false;

    let intervalHandle: ReturnType<typeof setInterval> | null = null;
    let wantsRunning = false;
    let disposed = false;
    let runtimePromise: Promise<PreviewRuntime | null> | null = null;
    let runtime: PreviewRuntime | null = null;
    let runtimeToken = 0;

    const stopInterval = function (): void {
        if (intervalHandle) {
            clearInterval(intervalHandle);
            intervalHandle = null;
        }
    };

    const clearPreview = function (): void {
        context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    };

    const drawRuntimeFrame = function (activeRuntime: PreviewRuntime, frameIndex: number): void {
        const armorOffset = getSpriteOffset(activeRuntime.armorSpec);
        const weaponOffset = getSpriteOffset(activeRuntime.weaponSpec);
        const armorFrameIndex = frameIndex % getIdleDownLength(activeRuntime.armorSpec);
        const weaponFrameIndex = frameIndex % getIdleDownLength(activeRuntime.weaponSpec);

        context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        context.drawImage(
            activeRuntime.shadowImage,
            0,
            0,
            activeRuntime.shadowSpec.width,
            activeRuntime.shadowSpec.height,
            -armorOffset.x,
            -armorOffset.y,
            activeRuntime.shadowSpec.width,
            activeRuntime.shadowSpec.height
        );
        context.drawImage(
            activeRuntime.armorImage,
            activeRuntime.armorSpec.width * armorFrameIndex,
            activeRuntime.armorSpec.height * activeRuntime.armorIdleRow,
            activeRuntime.armorSpec.width,
            activeRuntime.armorSpec.height,
            0,
            0,
            activeRuntime.armorSpec.width,
            activeRuntime.armorSpec.height
        );
        context.drawImage(
            activeRuntime.weaponImage,
            activeRuntime.weaponSpec.width * weaponFrameIndex,
            activeRuntime.weaponSpec.height * activeRuntime.weaponIdleRow,
            activeRuntime.weaponSpec.width,
            activeRuntime.weaponSpec.height,
            weaponOffset.x - armorOffset.x,
            weaponOffset.y - armorOffset.y,
            activeRuntime.weaponSpec.width,
            activeRuntime.weaponSpec.height
        );
    };

    const ensureRuntime = function (): Promise<PreviewRuntime | null> {
        runtimePromise ??= loadLoadCharacterPreviewRuntime();
        return runtimePromise.then((loadedRuntime) => {
            if (!loadedRuntime) {
                return null;
            }
            if (
                previewCanvas.width !== loadedRuntime.armorSpec.width ||
                previewCanvas.height !== loadedRuntime.armorSpec.height
            ) {
                previewCanvas.width = loadedRuntime.armorSpec.width;
                previewCanvas.height = loadedRuntime.armorSpec.height;
                context.imageSmoothingEnabled = false;
            }
            return loadedRuntime;
        });
    };

    const controller: PreviewController = {
        start: function (): void {
            if (disposed) {
                return;
            }
            wantsRunning = true;
            if (intervalHandle || runtime) {
                return;
            }
            const startToken = runtimeToken + 1;
            runtimeToken = startToken;
            void ensureRuntime().then((loadedRuntime) => {
                if (disposed || !wantsRunning || runtimeToken !== startToken) {
                    return;
                }
                if (!loadedRuntime) {
                    clearPreview();
                    return;
                }
                runtime = loadedRuntime;
                drawRuntimeFrame(runtime, 0);
                if (runtime.frameCount <= 1) {
                    return;
                }

                let frameIndex = 1;
                intervalHandle = setInterval(function () {
                    if (!wantsRunning || disposed || !runtime) {
                        stopInterval();
                        return;
                    }
                    drawRuntimeFrame(runtime, frameIndex);
                    frameIndex = (frameIndex + 1) % runtime.frameCount;
                }, IDLE_ANIMATION_INTERVAL_MS);
            });
        },
        stop: function (): void {
            wantsRunning = false;
            runtime = null;
            runtimeToken += 1;
            stopInterval();
        },
        dispose: function (): void {
            if (disposed) {
                return;
            }
            disposed = true;
            wantsRunning = false;
            runtime = null;
            runtimeToken += 1;
            stopInterval();
            clearPreview();
        },
    };

    const parchment = document.getElementById('parchment');
    const isPreviewVisible = function (): boolean {
        if (!parchment) {
            return false;
        }
        const body = document.body;
        return (
            body.classList.contains('returning') &&
            parchment.classList.contains('loadcharacter') &&
            !body.classList.contains('game')
        );
    };

    const syncLifecycle = function (): void {
        if (isPreviewVisible()) {
            controller.start();
        } else {
            controller.stop();
        }
    };

    const classObserver = new MutationObserver(function (): void {
        syncLifecycle();
    });
    classObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    if (parchment) {
        classObserver.observe(parchment, { attributes: true, attributeFilter: ['class'] });
    }

    const onVisibilityChange = function (): void {
        if (document.hidden) {
            controller.stop();
            return;
        }
        syncLifecycle();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onPageHide = function (): void {
        controller.stop();
    };
    window.addEventListener('pagehide', onPageHide);

    syncLifecycle();

    const disposePreview = function (): void {
        classObserver.disconnect();
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('pagehide', onPageHide);
        controller.dispose();
    };

    window.addEventListener('beforeunload', disposePreview, { once: true });
};
