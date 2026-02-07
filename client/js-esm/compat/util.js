const isInt = function (n) {
    return n % 1 === 0;
};

const TRANSITIONEND = 'transitionend webkitTransitionEnd oTransitionEnd';

const requestAnimFrame =
    globalThis.requestAnimationFrame ||
    globalThis.webkitRequestAnimationFrame ||
    globalThis.mozRequestAnimationFrame ||
    globalThis.oRequestAnimationFrame ||
    globalThis.msRequestAnimationFrame ||
    function fallback(callback) {
        globalThis.setTimeout(callback, 1000 / 60);
    };

const getBase64Image = function (url, callback) {
    const xhr = new XMLHttpRequest();
    const img = new Image();

    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';

    xhr.onload = function onload() {
        if (this.status !== 200) return;

        const bytes = new Uint8Array(this.response);
        const chars = new Array(bytes.length);
        for (let i = 0; i < bytes.length; i += 1) {
            chars[i] = String.fromCharCode(bytes[i]);
        }

        const base64 = globalThis.btoa(chars.join(''));
        img.onload = function imageLoaded() {
            callback(img);
        };
        img.src = 'data:image/png;base64,' + base64;
    };

    xhr.send();
};

globalThis.isInt = isInt;
globalThis.TRANSITIONEND = TRANSITIONEND;
globalThis.requestAnimFrame = requestAnimFrame;
globalThis.getBase64Image = getBase64Image;

export { TRANSITIONEND, getBase64Image, isInt, requestAnimFrame };
