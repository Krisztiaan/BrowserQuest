import { canPlayMP3 } from './features';

const Detect = {
    supportsWebSocket: function (): boolean {
        return typeof globalThis.WebSocket === 'function';
    },

    userAgentContains: function (string: string): boolean {
        if (!globalThis.navigator || !globalThis.navigator.userAgent) {
            return false;
        }
        return globalThis.navigator.userAgent.indexOf(string) !== -1;
    },

    isTablet: function (screenWidth: number): boolean {
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

    isWindows: function (): boolean {
        return this.userAgentContains('Windows');
    },

    isChromeOnWindows: function (): boolean {
        return this.userAgentContains('Chrome') && this.userAgentContains('Windows');
    },

    canPlayMP3: function (): boolean {
        return canPlayMP3();
    },

    isSafari: function (): boolean {
        return this.userAgentContains('Safari') && !this.userAgentContains('Chrome');
    },

    isOpera: function (): boolean {
        return this.userAgentContains('Opera');
    },

    isFirefoxAndroid: function (): boolean {
        return this.userAgentContains('Android') && this.userAgentContains('Firefox');
    },
};

export default Detect;
