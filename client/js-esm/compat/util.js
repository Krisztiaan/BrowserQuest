const isInt = function (n) {
    return n % 1 === 0;
};

const TRANSITIONEND = 'transitionend';

const requestAnimFrame =
    globalThis.requestAnimationFrame ||
    function fallback(callback) {
        globalThis.setTimeout(callback, 1000 / 60);
    };

const getBase64Image = function (url, callback) {
    const img = new Image();
    fetch(url)
        .then(function (response) {
            if (!response.ok) {
                return null;
            }
            return response.blob();
        })
        .then(function (blob) {
            if (!blob) {
                return;
            }
            const objectUrl = URL.createObjectURL(blob);
            img.onload = function imageLoaded() {
                URL.revokeObjectURL(objectUrl);
                callback(img);
            };
            img.onerror = function imageFailed() {
                URL.revokeObjectURL(objectUrl);
            };
            img.src = objectUrl;
        })
        .catch(function () {
            // Keep silent parity with previous helper behavior.
        });
};

export { TRANSITIONEND, getBase64Image, isInt, requestAnimFrame };
