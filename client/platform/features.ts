const FEATURE_TEST_KEY = 'browserquest_feature_test';

const canPlayMP3 = function (): boolean {
    if (typeof document === 'undefined') {
        return false;
    }

    const audio = document.createElement('audio');
    if (typeof audio.canPlayType !== 'function') {
        return false;
    }

    return audio.canPlayType('audio/mpeg;').replace(/^no$/, '') !== '';
};

const supportsLocalStorage = function (): boolean {
    try {
        globalThis.localStorage.setItem(FEATURE_TEST_KEY, FEATURE_TEST_KEY);
        globalThis.localStorage.removeItem(FEATURE_TEST_KEY);
        return true;
    } catch {
        return false;
    }
};

const Modernizr = {
    audio: {
        mp3: canPlayMP3(),
    },
    localstorage: supportsLocalStorage(),
};

export { Modernizr, canPlayMP3, supportsLocalStorage };
export default Modernizr;
