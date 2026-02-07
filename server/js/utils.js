var Utils = {},
    Types = require('../../shared/js/gametypes');

module.exports = Utils;

Utils.sanitize = function (string) {
    return Utils.escapeHTML(String(string ?? '')).replace(/[\u0000-\u001F\u007F]/g, '');
};

Utils.utf8ByteLength = function (string) {
    return Buffer.byteLength(String(string ?? ''), 'utf8');
};

Utils.hasMaxUtf8Bytes = function (string, maxBytes) {
    return Utils.utf8ByteLength(string) <= maxBytes;
};

Utils.limitUtf8Bytes = function (string, maxBytes) {
    var input = String(string ?? '');
    var output = '';
    var byteCount = 0;

    for (var ch of input) {
        var chBytes = Buffer.byteLength(ch, 'utf8');
        if (byteCount + chBytes > maxBytes) {
            break;
        }
        output += ch;
        byteCount += chBytes;
    }

    return output;
};

Utils.limitCodePoints = function (string, maxCodePoints) {
    var input = String(string ?? '');
    var output = '';
    var count = 0;

    for (var ch of input) {
        if (count >= maxCodePoints) {
            break;
        }
        output += ch;
        count += 1;
    }

    return output;
};

Utils.escapeHTML = function (string) {
    return String(string)
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
    } else if (value > max) {
        return max;
    } else {
        return value;
    }
};

Utils.randomOrientation = function () {
    var o,
        r = Utils.random(4);

    if (r === 0) o = Types.Orientations.LEFT;
    if (r === 1) o = Types.Orientations.RIGHT;
    if (r === 2) o = Types.Orientations.UP;
    if (r === 3) o = Types.Orientations.DOWN;

    return o;
};

Utils.Mixin = function (target, source) {
    if (source) {
        for (var key, keys = Object.keys(source), l = keys.length; l--; ) {
            key = keys[l];

            if (source.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        }
    }
    return target;
};

Utils.distanceTo = function (x, y, x2, y2) {
    var distX = Math.abs(x - x2);
    var distY = Math.abs(y - y2);

    return distX > distY ? distX : distY;
};
