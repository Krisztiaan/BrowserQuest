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

export const SERVER_PLAYER_IMAGE_SRC = '/profile/preview.svg';
const SERVER_PLAYER_PREVIEW_JSON_URL = '/profile/preview.json';
export const LEGACY_THINGY_PLAYER_IMAGE_SRC = '/img/common/thingy.png';
const DEFAULT_ARMOR_SPRITE = 'clotharmor';
const DEFAULT_WEAPON_SPRITE = 'sword1';
const SHADOW_SPRITE = 'shadow16';
const IDLE_ANIMATION_INTERVAL_MS = 260;

let loadCharacterPreviewInterval: ReturnType<typeof setInterval> | null = null;

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
            loadImageAsset(`/img/1/${SHADOW_SPRITE}.png`),
            loadImageAsset(`/img/1/${encodeURIComponent(armorSpriteName)}.png`),
            loadImageAsset(`/img/1/${encodeURIComponent(weaponSpriteName)}.png`),
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

export const hydrateLoadCharacterPreview = function (playerImage: HTMLImageElement): void {
    if (loadCharacterPreviewInterval) {
        clearInterval(loadCharacterPreviewInterval);
        loadCharacterPreviewInterval = null;
    }

    void loadLoadCharacterPreviewRuntime().then((runtime) => {
        if (!runtime) {
            playerImage.src = SERVER_PLAYER_IMAGE_SRC;
            return;
        }

        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = runtime.armorSpec.width;
        previewCanvas.height = runtime.armorSpec.height;
        const context = previewCanvas.getContext('2d');
        if (!context) {
            playerImage.src = SERVER_PLAYER_IMAGE_SRC;
            return;
        }

        context.imageSmoothingEnabled = false;
        const armorOffset = getSpriteOffset(runtime.armorSpec);
        const weaponOffset = getSpriteOffset(runtime.weaponSpec);

        const drawFrame = function (frameIndex: number): void {
            const armorFrameIndex = frameIndex % getIdleDownLength(runtime.armorSpec);
            const weaponFrameIndex = frameIndex % getIdleDownLength(runtime.weaponSpec);

            context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            context.drawImage(
                runtime.shadowImage,
                0,
                0,
                runtime.shadowSpec.width,
                runtime.shadowSpec.height,
                -armorOffset.x,
                -armorOffset.y,
                runtime.shadowSpec.width,
                runtime.shadowSpec.height
            );
            context.drawImage(
                runtime.armorImage,
                runtime.armorSpec.width * armorFrameIndex,
                runtime.armorSpec.height * runtime.armorIdleRow,
                runtime.armorSpec.width,
                runtime.armorSpec.height,
                0,
                0,
                runtime.armorSpec.width,
                runtime.armorSpec.height
            );
            context.drawImage(
                runtime.weaponImage,
                runtime.weaponSpec.width * weaponFrameIndex,
                runtime.weaponSpec.height * runtime.weaponIdleRow,
                runtime.weaponSpec.width,
                runtime.weaponSpec.height,
                weaponOffset.x - armorOffset.x,
                weaponOffset.y - armorOffset.y,
                runtime.weaponSpec.width,
                runtime.weaponSpec.height
            );
            playerImage.src = previewCanvas.toDataURL('image/png');
        };

        drawFrame(0);

        if (runtime.frameCount > 1) {
            let frameIndex = 1;
            loadCharacterPreviewInterval = setInterval(function () {
                if (!document.body.classList.contains('returning')) {
                    if (loadCharacterPreviewInterval) {
                        clearInterval(loadCharacterPreviewInterval);
                        loadCharacterPreviewInterval = null;
                    }
                    return;
                }
                drawFrame(frameIndex);
                frameIndex = (frameIndex + 1) % runtime.frameCount;
            }, IDLE_ANIMATION_INTERVAL_MS);
        }
    });
};
