const Types = require('../../shared/js/gametypes') as {
    Orientations: {
        LEFT: number;
        RIGHT: number;
        UP: number;
        DOWN: number;
    };
};

type MixinTarget = Record<string, unknown>;
type MixinSource = Record<string, unknown> | null | undefined;

interface UtilsContract {
    sanitize(value: unknown): string;
    utf8ByteLength(value: unknown): number;
    hasMaxUtf8Bytes(value: unknown, maxBytes: number): boolean;
    limitUtf8Bytes(value: unknown, maxBytes: number): string;
    limitCodePoints(value: unknown, maxCodePoints: number): string;
    escapeHTML(value: unknown): string;
    random(range: number): number;
    randomRange(min: number, max: number): number;
    randomInt(min: number, max: number): number;
    clamp(min: number, max: number, value: number): number;
    randomOrientation(): number;
    Mixin<T extends MixinTarget>(target: T, source: MixinSource): T;
    distanceTo(x: number, y: number, x2: number, y2: number): number;
}

const Utils = {} as UtilsContract;

module.exports = Utils;

Utils.sanitize = function (value: unknown): string {
    return Utils.escapeHTML(String(value ?? '')).replace(/[\u0000-\u001F\u007F]/g, '');
};

Utils.utf8ByteLength = function (value: unknown): number {
    return Buffer.byteLength(String(value ?? ''), 'utf8');
};

Utils.hasMaxUtf8Bytes = function (value: unknown, maxBytes: number): boolean {
    return Utils.utf8ByteLength(value) <= maxBytes;
};

Utils.limitUtf8Bytes = function (value: unknown, maxBytes: number): string {
    const input = String(value ?? '');
    let output = '';
    let byteCount = 0;

    for (const ch of input) {
        const chBytes = Buffer.byteLength(ch, 'utf8');
        if (byteCount + chBytes > maxBytes) {
            break;
        }
        output += ch;
        byteCount += chBytes;
    }

    return output;
};

Utils.limitCodePoints = function (value: unknown, maxCodePoints: number): string {
    const input = String(value ?? '');
    let output = '';
    let count = 0;

    for (const ch of input) {
        if (count >= maxCodePoints) {
            break;
        }
        output += ch;
        count += 1;
    }

    return output;
};

Utils.escapeHTML = function (value: unknown): string {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

Utils.random = function (range: number): number {
    return Math.floor(Math.random() * range);
};

Utils.randomRange = function (min: number, max: number): number {
    return min + Math.random() * (max - min);
};

Utils.randomInt = function (min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
};

Utils.clamp = function (min: number, max: number, value: number): number {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
};

Utils.randomOrientation = function (): number {
    const r = Utils.random(4);

    if (r === 0) {
        return Types.Orientations.LEFT;
    }
    if (r === 1) {
        return Types.Orientations.RIGHT;
    }
    if (r === 2) {
        return Types.Orientations.UP;
    }
    return Types.Orientations.DOWN;
};

Utils.Mixin = function <T extends MixinTarget>(target: T, source: MixinSource): T {
    if (source) {
        const mutableTarget = target as MixinTarget;
        for (const key of Object.keys(source)) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                mutableTarget[key] = source[key];
            }
        }
    }
    return target;
};

Utils.distanceTo = function (x: number, y: number, x2: number, y2: number): number {
    const distX = Math.abs(x - x2);
    const distY = Math.abs(y - y2);

    return distX > distY ? distX : distY;
};
