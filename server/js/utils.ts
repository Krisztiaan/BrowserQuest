import Types from '../../shared/js/gametypes-browser';

const Utils = {
    sanitize(string: string): string {
        return this.escapeHTML(String(string ?? '')).replace(/[\u0000-\u001F\u007F]/g, '');
    },

    utf8ByteLength(string: string): number {
        return Buffer.byteLength(String(string ?? ''), 'utf8');
    },

    hasMaxUtf8Bytes(string: string, maxBytes: number): boolean {
        return this.utf8ByteLength(string) <= maxBytes;
    },

    limitUtf8Bytes(string: string, maxBytes: number): string {
        const input = String(string ?? '');
        const outputChunks: string[] = [];
        let byteCount = 0;

        for (const ch of input) {
            const chBytes = Buffer.byteLength(ch, 'utf8');
            if (byteCount + chBytes > maxBytes) {
                break;
            }
            outputChunks.push(ch);
            byteCount += chBytes;
        }

        return outputChunks.join('');
    },

    limitCodePoints(string: string, maxCodePoints: number): string {
        const input = String(string ?? '');
        const outputChunks: string[] = [];
        let count = 0;

        for (const ch of input) {
            if (count >= maxCodePoints) {
                break;
            }
            outputChunks.push(ch);
            count += 1;
        }

        return outputChunks.join('');
    },

    escapeHTML(string: string): string {
        return String(string)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    random(range: number): number {
        return Math.floor(Math.random() * range);
    },

    randomRange(min: number, max: number): number {
        return min + Math.random() * (max - min);
    },

    randomInt(min: number, max: number): number {
        return min + Math.floor(Math.random() * (max - min + 1));
    },

    clamp(min: number, max: number, value: number): number {
        if (value < min) {
            return min;
        }
        if (value > max) {
            return max;
        }
        return value;
    },

    randomOrientation(): number {
        const r = this.random(4);
        if (r === 0) return Types.Orientations.LEFT;
        if (r === 1) return Types.Orientations.RIGHT;
        if (r === 2) return Types.Orientations.UP;
        return Types.Orientations.DOWN;
    },

    Mixin(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
        if (source) {
            for (let key, keys = Object.keys(source), l = keys.length; l--; ) {
                key = keys[l];

                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    target[key] = source[key];
                }
            }
        }
        return target;
    },

    distanceTo(x: number, y: number, x2: number, y2: number): number {
        const distX = Math.abs(x - x2);
        const distY = Math.abs(y - y2);

        return distX > distY ? distX : distY;
    },
};

export default Utils;
