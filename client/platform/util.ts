const TRANSITIONEND = 'transitionend';

type RafGlobal = {
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    setTimeout: typeof setTimeout;
};

const rafGlobal: RafGlobal = globalThis;

const requestAnimFrame =
    rafGlobal.requestAnimationFrame ??
    function fallback(callback: FrameRequestCallback) {
        rafGlobal.setTimeout(callback, 1000 / 60);
    };

type IntCandidate = number | string | boolean | bigint | object | null | undefined;
const isInt = function (value: IntCandidate): boolean {
    return typeof value === 'number' && Number.isInteger(value);
};

export { TRANSITIONEND, isInt, requestAnimFrame };
