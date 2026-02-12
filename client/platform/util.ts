const TRANSITIONEND = 'transitionend';

type RafGlobal = {
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    setTimeout: typeof setTimeout;
};

const rafGlobal = globalThis as unknown as RafGlobal;

const requestAnimFrame =
    rafGlobal.requestAnimationFrame ??
    function fallback(callback: FrameRequestCallback) {
        rafGlobal.setTimeout(callback, 1000 / 60);
    };

const isInt = function (value: unknown): boolean {
    return typeof value === 'number' && Number.isInteger(value);
};

export { TRANSITIONEND, isInt, requestAnimFrame };
