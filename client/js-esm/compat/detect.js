import { canPlayMP3 } from 'compat/features';

const Detect = {
    supportsWebSocket: function () {
        return !!(globalThis.WebSocket || globalThis.MozWebSocket);
    },

    userAgentContains: function (string) {
        if (!globalThis.navigator || !globalThis.navigator.userAgent) {
            return false;
        }
        return globalThis.navigator.userAgent.indexOf(string) !== -1;
    },

    isTablet: function (screenWidth) {
        if (screenWidth > 640) {
            if (
                (this.userAgentContains('Android') && this.userAgentContains('Firefox')) ||
                this.userAgentContains('Mobile')
            ) {
                return true;
            }
        }
        return false;
    },

    isWindows: function () {
        return this.userAgentContains('Windows');
    },

    isChromeOnWindows: function () {
        return this.userAgentContains('Chrome') && this.userAgentContains('Windows');
    },

    canPlayMP3: function () {
        return canPlayMP3();
    },

    isSafari: function () {
        return this.userAgentContains('Safari') && !this.userAgentContains('Chrome');
    },

    isOpera: function () {
        return this.userAgentContains('Opera');
    },

    isFirefoxAndroid: function () {
        return this.userAgentContains('Android') && this.userAgentContains('Firefox');
    },
};

globalThis.Detect = Detect;

export default Detect;
