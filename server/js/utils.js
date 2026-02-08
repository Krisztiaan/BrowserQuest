// AUTO-GENERATED from server/js/utils.cts via bun run build:utils.
// Do not edit server/js/utils.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Types = require('../../shared/js/gametypes');
const Utils = {};
module.exports = Utils;
Utils.sanitize = function (value) {
    return Utils.escapeHTML(String(value ?? '')).replace(/[\u0000-\u001F\u007F]/g, '');
};
Utils.utf8ByteLength = function (value) {
    return Buffer.byteLength(String(value ?? ''), 'utf8');
};
Utils.hasMaxUtf8Bytes = function (value, maxBytes) {
    return Utils.utf8ByteLength(value) <= maxBytes;
};
Utils.limitUtf8Bytes = function (value, maxBytes) {
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
Utils.limitCodePoints = function (value, maxCodePoints) {
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
Utils.escapeHTML = function (value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};
Utils.random = function (range) {
    return Math.floor(Math.random() * range);
};
Utils.randomRange = function (min, max) {
    return min + Math.random() * (max - min);
};
Utils.randomInt = function (min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
};
Utils.clamp = function (min, max, value) {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
};
Utils.randomOrientation = function () {
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
Utils.Mixin = function (target, source) {
    if (source) {
        const mutableTarget = target;
        for (const key of Object.keys(source)) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                mutableTarget[key] = source[key];
            }
        }
    }
    return target;
};
Utils.distanceTo = function (x, y, x2, y2) {
    const distX = Math.abs(x - x2);
    const distY = Math.abs(y - y2);
    return distX > distY ? distX : distY;
};
