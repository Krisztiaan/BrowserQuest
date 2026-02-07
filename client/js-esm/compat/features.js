const FEATURE_TEST_KEY = 'browserquest_feature_test';

const canPlayMP3 = function () {
    if (typeof document === 'undefined') {
        return false;
    }

    const audio = document.createElement('audio');
    if (!audio || typeof audio.canPlayType !== 'function') {
        return false;
    }

    return audio.canPlayType('audio/mpeg;').replace(/^no$/, '') !== '';
};

const supportsLocalStorage = function () {
    try {
        if (!globalThis.localStorage) {
            return false;
        }
        globalThis.localStorage.setItem(FEATURE_TEST_KEY, FEATURE_TEST_KEY);
        globalThis.localStorage.removeItem(FEATURE_TEST_KEY);
        return true;
    } catch (e) {
        return false;
    }
};

const Modernizr = {
    audio: {
        mp3: canPlayMP3(),
    },
    localstorage: supportsLocalStorage(),
};

globalThis.Modernizr = Modernizr;

export { Modernizr, canPlayMP3, supportsLocalStorage };
export default Modernizr;
