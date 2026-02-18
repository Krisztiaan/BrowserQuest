const FEATURE_TEST_KEY = 'browserquest_feature_test';

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
    localstorage: supportsLocalStorage(),
};

export { Modernizr, supportsLocalStorage };
export default Modernizr;
