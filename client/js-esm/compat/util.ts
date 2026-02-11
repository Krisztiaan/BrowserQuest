const TRANSITIONEND = 'transitionend';

const requestAnimFrame =
    globalThis.requestAnimationFrame ||
    function fallback(callback) {
        globalThis.setTimeout(callback, 1000 / 60);
    };

const isInt = function (value: unknown): boolean {
    return typeof value === 'number' && Number.isInteger(value);
};

export { TRANSITIONEND, isInt, requestAnimFrame };
