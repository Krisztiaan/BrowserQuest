import Types from '../shared/gametypes-browser';

function escapeHTML(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitize(value: string): string {
    return escapeHTML(value).replace(/[\u0000-\u001F\u007F]/g, '');
}

function utf8ByteLength(value: string): number {
    return Buffer.byteLength(value, 'utf8');
}

function hasMaxUtf8Bytes(value: string, maxBytes: number): boolean {
    return utf8ByteLength(value) <= maxBytes;
}

function limitUtf8Bytes(value: string, maxBytes: number): string {
    const outputChunks: string[] = [];
    let byteCount = 0;

    for (const ch of value) {
        const chBytes = Buffer.byteLength(ch, 'utf8');
        if (byteCount + chBytes > maxBytes) {
            break;
        }
        outputChunks.push(ch);
        byteCount += chBytes;
    }

    return outputChunks.join('');
}

function limitCodePoints(value: string, maxCodePoints: number): string {
    const outputChunks: string[] = [];
    let count = 0;

    for (const ch of value) {
        if (count >= maxCodePoints) {
            break;
        }
        outputChunks.push(ch);
        count += 1;
    }

    return outputChunks.join('');
}

function random(range: number): number {
    return Math.floor(Math.random() * range);
}

function randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function clamp(min: number, max: number, value: number): number {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
}

function randomOrientation(): number {
    const r = random(4);
    if (r === 0) return Types.Orientations.LEFT;
    if (r === 1) return Types.Orientations.RIGHT;
    if (r === 2) return Types.Orientations.UP;
    return Types.Orientations.DOWN;
}

function mixin(
    target: Record<string, unknown>,
    source: Record<string, unknown> | null | undefined
): Record<string, unknown> {
    if (!source) {
        return target;
    }

    const keys = Object.keys(source);
    for (let l = keys.length - 1; l >= 0; l -= 1) {
        const key = keys[l];
        if (!key) {
            continue;
        }
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
        }
    }
    return target;
}

function distanceTo(x: number, y: number, x2: number, y2: number): number {
    const distX = Math.abs(x - x2);
    const distY = Math.abs(y - y2);

    return distX > distY ? distX : distY;
}

const Utils = {
    sanitize,
    utf8ByteLength,
    hasMaxUtf8Bytes,
    limitUtf8Bytes,
    limitCodePoints,
    escapeHTML,
    random,
    randomRange,
    randomInt,
    clamp,
    randomOrientation,
    Mixin: mixin,
    distanceTo,
};

export default Utils;
